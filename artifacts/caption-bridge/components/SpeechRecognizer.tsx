// ============================================================
// SpeechRecognizer.tsx
// 役割：Android・iOS・Webで動く音声認識コンポーネント
//
// 【方針】
// expo-speech-recognition はExpo Goに含まれないネイティブモジュールのため使用しない。
// react-native-webview の中でWeb Speech APIを動かすことで
// Expo Goのまま Galaxy (Android) で音声認識を実現する。
//
// 【追加機能】
// Web Audio APIでリアルタイム音量レベルを取得し親コンポーネントへ送信する。
// Android Web Speech APIはsilenceで自動停止するため自動再起動ロジックを実装。
// ============================================================

import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";

// ============================================================
// WebView内で動くHTMLエンジン
// - Web Speech API で音声認識
// - Web Audio API でリアルタイム音量レベル取得
// - 無音で自動停止した場合は自動再起動
// ============================================================
const SPEECH_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
<script>
  var recognition = null;
  var audioCtx = null;
  var analyser = null;
  var levelTimer = null;
  var shouldRestart = false;
  var currentLang = 'ja-JP';
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  // ===== 重複排除：最後に送信した確定テキストと時刻を記録する =====
  // Android Web Speech APIは同じフレーズを「確定前」「確定後」で2回送ることがある
  var lastFinalSent = '';
  var lastFinalSentTime = 0;

  // React Nativeへメッセージを送信する
  function sendMsg(data) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    } catch(e) {}
  }

  // ========== 音量レベル取得（Web Audio API）==========
  function startAudioAnalysis() {
    try {
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(function(stream) {
          try {
            var Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) { startSimulatedLevels(); return; }
            audioCtx = new Ctx();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 32;
            var source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            var buf = new Uint8Array(analyser.frequencyBinCount);
            levelTimer = setInterval(function() {
              try {
                analyser.getByteFrequencyData(buf);
                var len = buf.length;
                var step = Math.max(1, Math.floor(len / 5));
                var bands = [];
                for (var i = 0; i < 5; i++) {
                  bands.push(Math.min(1.0, (buf[i * step] || 0) / 180.0));
                }
                sendMsg({ type: 'level', bands: bands });
              } catch(e) {}
            }, 60);
          } catch(e) { startSimulatedLevels(); }
        })
        .catch(function() { startSimulatedLevels(); });
    } catch(e) { startSimulatedLevels(); }
  }

  // getUserMediaが使えない場合はダミーレベルを送信する
  function startSimulatedLevels() {
    var base = [0.4, 0.6, 0.8, 0.5, 0.7];
    levelTimer = setInterval(function() {
      var bands = base.map(function(b) {
        return Math.max(0.1, Math.min(1.0, b + (Math.random() - 0.5) * 0.5));
      });
      sendMsg({ type: 'level', bands: bands });
    }, 100);
  }

  function stopAudioAnalysis() {
    if (levelTimer) { clearInterval(levelTimer); levelTimer = null; }
    try { if (audioCtx) { audioCtx.close(); audioCtx = null; } } catch(e) {}
    analyser = null;
    // 波形をゼロにリセットする
    sendMsg({ type: 'level', bands: [0, 0, 0, 0, 0] });
  }

  // ========== 音声認識 ==========
  function buildRecognition(lang) {
    if (!SpeechRecognition) {
      sendMsg({ type: 'error', code: 'not-supported' });
      return null;
    }
    var r = new SpeechRecognition();
    r.lang = lang || 'ja-JP';
    r.continuous = false;       // Android WebViewはcontinuous:trueが不安定なためfalseで自動再起動する
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = function() {
      sendMsg({ type: 'start' });
    };

    // 認識終了時：shouldRestartがtrueなら自動的に再起動する
    r.onend = function() {
      if (shouldRestart) {
        // 無音停止後、200ms待ってから再起動する
        setTimeout(function() {
          if (shouldRestart) {
            try {
              recognition = buildRecognition(currentLang);
              if (recognition) recognition.start();
            } catch(e) {
              sendMsg({ type: 'error', code: 'restart-failed' });
            }
          }
        }, 200);
      } else {
        stopAudioAnalysis();
        sendMsg({ type: 'end' });
      }
    };

    r.onerror = function(e) {
      var code = e.error || 'unknown';
      // no-speechは無音検出なので再起動するだけにする
      if (code === 'no-speech') return;
      // ネットワークエラーは再試行する
      if (code === 'network' && shouldRestart) {
        setTimeout(function() {
          if (shouldRestart) {
            try {
              recognition = buildRecognition(currentLang);
              if (recognition) recognition.start();
            } catch(ex) {}
          }
        }, 1000);
        return;
      }
      sendMsg({ type: 'error', code: code });
    };

    r.onresult = function(e) {
      var interim = '';
      var finalText = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalText += t;
        } else {
          interim += t;
        }
      }
      if (finalText) {
        // ===== エンジンレベルの重複排除 =====
        // Android は「確定前」→「確定後」で同一テキストを2回送る場合がある
        // 正規化（空白統一）してから3秒以内の完全一致はスキップする
        var normFinal = finalText.trim().replace(/\s+/g, ' ');
        var now = Date.now();
        if (normFinal && !(normFinal === lastFinalSent && now - lastFinalSentTime < 3000)) {
          lastFinalSent = normFinal;
          lastFinalSentTime = now;
          sendMsg({ type: 'result', text: finalText, isFinal: true });
        }
      }
      if (interim) {
        sendMsg({ type: 'result', text: interim, isFinal: false });
      }
    };

    return r;
  }

  // androidMode=true のとき getUserMedia を使わずシミュレートモードで波形を出す
  // 理由：AndroidのWebViewではgetUserMediaとWeb Speech APIが
  //       同時にマイクを取り合って認識が失敗するため
  function startRecognition(lang, androidMode) {
    currentLang = lang || 'ja-JP';
    shouldRestart = true;
    try {
      if (recognition) {
        try { recognition.stop(); } catch(e) {}
        recognition = null;
      }
      recognition = buildRecognition(currentLang);
      if (!recognition) return;
      recognition.start();
      if (androidMode) {
        // AndroidはgetUserMediaを呼ばずにダミー波形を使う
        startSimulatedLevels();
      } else {
        startAudioAnalysis();
      }
    } catch(err) {
      sendMsg({ type: 'error', code: 'start-failed' });
    }
  }

  function stopRecognition() {
    shouldRestart = false;
    if (recognition) {
      try { recognition.stop(); } catch(e) {}
      recognition = null;
    }
    stopAudioAnalysis();
    sendMsg({ type: 'end' });
  }

  // React Nativeからのメッセージを処理する（Android/iOS両対応）
  function handleMsg(data) {
    try {
      var msg = JSON.parse(data);
      if (msg.type === 'start') {
        startRecognition(msg.lang);
      } else if (msg.type === 'stop') {
        stopRecognition();
      }
    } catch(e) {}
  }

  document.addEventListener('message', function(e) { handleMsg(e.data); });
  window.addEventListener('message', function(e) { handleMsg(e.data); });
</script>
</body>
</html>`;

// ============================================================
// 外部から呼び出せる関数の型定義
// ============================================================
export interface SpeechRecognizerRef {
  startListening: () => void;
  stopListening: () => void;
}

// ============================================================
// 親コンポーネントから受け取るプロパティの型定義
// ============================================================
interface Props {
  language: string;
  onResult: (text: string, isFinal: boolean) => void;
  onStart: () => void;
  onEnd: () => void;
  onError: (error: string) => void;
  onAudioLevel?: (levels: number[]) => void; // リアルタイム音量レベル（5バンド）
}

// Webプラットフォーム用のSpeechRecognitionインスタンス
let webRecognition: any = null;

// ============================================================
// SpeechRecognizerコンポーネント本体
// ============================================================
export const SpeechRecognizer = forwardRef<SpeechRecognizerRef, Props>(
  ({ language, onResult, onStart, onEnd, onError, onAudioLevel }, ref) => {
    const webViewRef = useRef<WebView>(null);

    // ========== WebViewからのメッセージを処理する ==========
    const handleMessage = useCallback((event: any) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        switch (msg.type) {
          case 'start':
            onStart();
            break;
          case 'end':
            onEnd();
            break;
          case 'error':
            onError(msg.code || 'unknown');
            break;
          case 'result':
            if (msg.text) onResult(msg.text, msg.isFinal);
            break;
          case 'level':
            // リアルタイム音量レベルを親コンポーネントへ伝える
            if (onAudioLevel && Array.isArray(msg.bands)) {
              onAudioLevel(msg.bands);
            }
            break;
        }
      } catch {
        // 不正なメッセージは無視する
      }
    }, [onStart, onEnd, onError, onResult, onAudioLevel]);

    // ========== 親コンポーネントから呼べる関数を公開する ==========
    useImperativeHandle(ref, () => ({
      startListening: () => {
        if (Platform.OS === 'web') {
          startWebSpeech(language, onResult, onStart, onEnd, onError);
        } else {
          // androidMode=true を渡して getUserMedia 競合を防ぐ
          webViewRef.current?.injectJavaScript(
            `startRecognition('${language || 'ja-JP'}', true); true;`
          );
        }
      },
      stopListening: () => {
        if (Platform.OS === 'web') {
          stopWebSpeech(onEnd);
        } else {
          webViewRef.current?.injectJavaScript('stopRecognition(); true;');
        }
      },
    }));

    // Webプラットフォームはネイティブで動くためWebViewは不要
    if (Platform.OS === 'web') {
      return null;
    }

    // Android/iOS：画面右下の角に透明配置する
    // 【重要】top:-200 のような画面外配置だとAndroidがマイクを与えない
    // 画面内（bottom:0, right:0）に100x100で配置してopacity:0で隠す
    return (
      <View style={styles.hidden} pointerEvents="none">
        <WebView
          ref={webViewRef}
          source={{ html: SPEECH_HTML, baseUrl: 'https://localhost/' }}
          onMessage={handleMessage}
          // AndroidのWebViewメディア権限（マイク）を自動で許可する
          // これはネイティブ権限とは別のWebView固有の権限チェック
          // @ts-ignore onPermissionRequestはAndroid専用のWebViewプロパティ（型定義に未掲載）
          onPermissionRequest={(event: any) => {
            event.nativeEvent.grant(event.nativeEvent.resources);
          }}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          // キャッシュを無効にしてHTML変更を即反映させる
          cacheEnabled={false}
          style={styles.webview}
        />
      </View>
    );
  }
);

// ============================================================
// Webプラットフォーム用：window.SpeechRecognitionを直接操作する
// ============================================================
function startWebSpeech(
  language: string,
  onResult: (text: string, isFinal: boolean) => void,
  onStart: () => void,
  onEnd: () => void,
  onError: (error: string) => void,
) {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) { onError('not-supported'); return; }
  if (webRecognition) {
    try { webRecognition.stop(); } catch {}
    webRecognition = null;
  }
  webRecognition = new SR();
  webRecognition.lang = language || 'ja-JP';
  webRecognition.continuous = true;
  webRecognition.interimResults = true;
  webRecognition.maxAlternatives = 1;
  webRecognition.onstart = () => onStart();
  webRecognition.onend = () => onEnd();
  webRecognition.onerror = (e: any) => onError(e.error || 'unknown');
  webRecognition.onresult = (e: any) => {
    let interim = '';
    let finalText = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t;
      else interim += t;
    }
    if (finalText) onResult(finalText, true);
    if (interim) onResult(interim, false);
  };
  webRecognition.start();
}

function stopWebSpeech(onEnd: () => void) {
  if (webRecognition) {
    try { webRecognition.stop(); } catch {}
    webRecognition = null;
  }
}

const styles = StyleSheet.create({
  // 画面右下の角にサイズ100x100で透明配置する
  // 【注意】top:-200等の画面外配置はAndroidがWebViewのマイクを遮断するため禁止
  // opacity:0で視覚的に隠しつつ、Androidのビュー描画ツリー内に残す
  hidden: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 100,
    height: 100,
    opacity: 0,
  },
  webview: {
    width: 100,
    height: 100,
    backgroundColor: 'transparent',
  },
});
