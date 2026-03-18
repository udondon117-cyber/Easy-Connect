// ============================================================
// SpeechRecognizer.tsx
// 役割：Android・iOS・Webで動く音声認識コンポーネント
//
// 【方針】
// expo-speech-recognition はExpo Goに含まれないネイティブモジュールのため使用しない。
// Android WebView は Web Speech API をサポートしているため、
// react-native-webview を使ってAndroidで確実に動く実装にした。
// Webプラットフォームではwindow.SpeechRecognitionを直接使用する。
// ============================================================

import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";

// ============================================================
// WebView内で動くHTML（音声認識エンジン）
// AndroidのWebViewのWeb Speech APIを利用する
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
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  // React Nativeへメッセージを送信する
  function sendMessage(data) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
  }

  // 音声認識を開始する
  function startRecognition(lang) {
    if (!SpeechRecognition) {
      sendMessage({ type: 'error', code: 'not-supported' });
      return;
    }
    try {
      // 既存の認識セッションがあれば先に停止する
      if (recognition) {
        try { recognition.stop(); } catch(e) {}
        recognition = null;
      }

      recognition = new SpeechRecognition();
      recognition.lang = lang || 'ja-JP';  // 日本語固定
      recognition.continuous = true;        // 継続認識モード
      recognition.interimResults = true;    // 途中経過も取得する
      recognition.maxAlternatives = 1;      // 候補は1件のみ

      // 認識開始イベント
      recognition.onstart = function() {
        sendMessage({ type: 'start' });
      };

      // 認識終了イベント
      recognition.onend = function() {
        sendMessage({ type: 'end' });
      };

      // エラーイベント
      recognition.onerror = function(e) {
        sendMessage({ type: 'error', code: e.error || 'unknown' });
      };

      // 認識結果イベント（途中・確定）
      recognition.onresult = function(e) {
        var interim = '';
        var finalText = '';
        for (var i = e.resultIndex; i < e.results.length; i++) {
          var transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            finalText += transcript;
          } else {
            interim += transcript;
          }
        }
        if (finalText) {
          sendMessage({ type: 'result', text: finalText, isFinal: true });
        }
        if (interim) {
          sendMessage({ type: 'result', text: interim, isFinal: false });
        }
      };

      recognition.start();
    } catch(err) {
      sendMessage({ type: 'error', code: 'start-failed' });
    }
  }

  // 音声認識を停止する
  function stopRecognition() {
    if (recognition) {
      try { recognition.stop(); } catch(e) {}
      recognition = null;
    }
    sendMessage({ type: 'end' });
  }

  // React Nativeからのメッセージを処理する
  function handleMessage(data) {
    try {
      var msg = JSON.parse(data);
      if (msg.type === 'start') {
        startRecognition(msg.lang);
      } else if (msg.type === 'stop') {
        stopRecognition();
      }
    } catch(e) {}
  }

  // Android / iOS それぞれのメッセージ受信に対応する
  document.addEventListener('message', function(e) { handleMessage(e.data); });
  window.addEventListener('message', function(e) { handleMessage(e.data); });
</script>
</body>
</html>`;

// ============================================================
// 外部から呼び出せる関数の型定義
// ============================================================
export interface SpeechRecognizerRef {
  startListening: () => void; // 音声認識を開始する
  stopListening: () => void;  // 音声認識を停止する
}

// ============================================================
// 親コンポーネントから受け取るプロパティの型定義
// ============================================================
interface Props {
  language: string;                                     // 認識する言語コード（例: "ja-JP"）
  onResult: (text: string, isFinal: boolean) => void;  // 認識結果を受け取るコールバック
  onStart: () => void;                                  // 認識開始時のコールバック
  onEnd: () => void;                                    // 認識終了時のコールバック
  onError: (error: string) => void;                    // エラー発生時のコールバック
}

// Webプラットフォーム用のSpeechRecognitionインスタンス
let webRecognition: any = null;

// ============================================================
// SpeechRecognizerコンポーネント
// UIを持たない（またはほぼ非表示の）コンポーネントとして動作する
// ============================================================
export const SpeechRecognizer = forwardRef<SpeechRecognizerRef, Props>(
  ({ language, onResult, onStart, onEnd, onError }, ref) => {
    const webViewRef = useRef<WebView>(null);

    // ========== WebViewからのメッセージを受け取る ==========
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
        }
      } catch {
        // 不正なメッセージは無視する
      }
    }, [onStart, onEnd, onError, onResult]);

    // ========== 親コンポーネントから呼べる関数を公開する ==========
    useImperativeHandle(ref, () => ({

      // 音声認識を開始する
      startListening: () => {
        if (Platform.OS === 'web') {
          // Webプラットフォーム：window.SpeechRecognitionを直接使用する
          startWebSpeech(language, onResult, onStart, onEnd, onError);
        } else {
          // Android/iOS：WebViewにJavaScriptを注入して開始する
          webViewRef.current?.injectJavaScript(
            `startRecognition('${language || 'ja-JP'}'); true;`
          );
        }
      },

      // 音声認識を停止する
      stopListening: () => {
        if (Platform.OS === 'web') {
          stopWebSpeech(onEnd);
        } else {
          webViewRef.current?.injectJavaScript('stopRecognition(); true;');
        }
      },
    }));

    // Webプラットフォームの場合はWebViewは不要（UIなし）
    if (Platform.OS === 'web') {
      return null;
    }

    // Android/iOS：画面外に配置した非表示WebView
    return (
      <View style={styles.hidden} pointerEvents="none">
        <WebView
          ref={webViewRef}
          source={{ html: SPEECH_HTML }}
          onMessage={handleMessage}
          // マイクなどのメディア権限を自動で許可する（Androidのみ有効）
          onPermissionRequest={(event) => {
            event.nativeEvent.grant(event.nativeEvent.resources);
          }}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
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
  if (!SR) {
    onError('not-supported');
    return;
  }
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
  // 画面の外に押し出して完全に非表示にする
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
    top: -100,
    left: -100,
  },
  webview: {
    width: 1,
    height: 1,
  },
});
