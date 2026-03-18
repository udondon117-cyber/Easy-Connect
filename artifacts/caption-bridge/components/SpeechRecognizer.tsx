// ============================================================
// SpeechRecognizer.tsx
// 役割：WebViewを使ってブラウザのWeb Speech APIを呼び出し、
//       音声認識の結果をReact Nativeへ渡すコンポーネント
// ============================================================

import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import WebView, { WebViewMessageEvent } from "react-native-webview";

// 外部から呼び出せる関数（開始・停止）の型定義
export interface SpeechRecognizerRef {
  startListening: () => void; // 音声認識を開始する
  stopListening: () => void;  // 音声認識を停止する
}

// 親コンポーネントから受け取るプロパティの型定義
interface Props {
  language: string;                                        // 認識する言語コード（例: "ja-JP"）
  onResult: (text: string, isFinal: boolean) => void;     // 認識結果を受け取るコールバック
  onStart: () => void;                                     // 認識開始時のコールバック
  onEnd: () => void;                                       // 認識終了時のコールバック
  onError: (error: string) => void;                       // エラー発生時のコールバック
}

// ============================================================
// WebViewに埋め込むHTML + JavaScript
// ブラウザのSpeechRecognition APIを使って音声を認識する
// ============================================================
const SPEECH_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
<script>
  var recognition = null; // 音声認識オブジェクト
  var isRunning = false;  // 現在認識中かどうか

  // 音声認識を初期化する関数
  function initRecognition(lang) {
    // SpeechRecognitionはブラウザによって名前が異なるため両方対応
    var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      // 非対応デバイスの場合はエラーを通知
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'not_supported' }));
      return;
    }

    recognition = new SpeechRec();
    recognition.lang = lang || 'ja-JP'; // 認識言語を設定
    recognition.continuous = true;       // 連続して認識し続ける
    recognition.interimResults = true;   // 確定前の途中結果も取得する
    recognition.maxAlternatives = 1;     // 候補は1つだけ取得

    // 認識開始時の処理
    recognition.onstart = function() {
      isRunning = true;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'start' }));
    };

    // 認識終了時の処理
    recognition.onend = function() {
      isRunning = false;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'end' }));
    };

    // エラー発生時の処理
    recognition.onerror = function(event) {
      isRunning = false;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: event.error }));
    };

    // 認識結果を受け取った時の処理
    recognition.onresult = function(event) {
      var interimTranscript = ''; // 認識途中のテキスト
      var finalTranscript = '';   // 確定したテキスト

      for (var i = event.resultIndex; i < event.results.length; i++) {
        var transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript; // 確定テキストに追加
        } else {
          interimTranscript += transcript; // 途中テキストに追加
        }
      }

      // 確定テキストをReact Nativeへ送信
      if (finalTranscript) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'result', text: finalTranscript, isFinal: true
        }));
      }

      // 途中テキストをReact Nativeへ送信
      if (interimTranscript) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'result', text: interimTranscript, isFinal: false
        }));
      }
    };
  }

  // React NativeからのコマンドをWebViewで受け取る処理
  function handleCommand(data) {
    var cmd = data.command;
    var lang = data.lang || 'ja-JP';
    if (cmd === 'init') {
      initRecognition(lang);           // 初期化コマンド
    } else if (cmd === 'start') {
      if (!recognition) initRecognition(lang);
      try { recognition.start(); } catch(e) {} // 認識開始
    } else if (cmd === 'stop') {
      if (recognition && isRunning) {
        try { recognition.stop(); } catch(e) {} // 認識停止
      }
    }
  }

  // Android用のメッセージ受信リスナー
  document.addEventListener('message', function(e) {
    try { handleCommand(JSON.parse(e.data)); } catch(err) {}
  });
  // iOS用のメッセージ受信リスナー
  window.addEventListener('message', function(e) {
    try { handleCommand(JSON.parse(e.data)); } catch(err) {}
  });

  // 起動時に日本語で初期化する
  initRecognition('ja-JP');
</script>
</body>
</html>
`;

// ============================================================
// SpeechRecognizerコンポーネント本体
// forwardRefを使うと、親コンポーネントからstartListening/stopListeningを呼べる
// ============================================================
export const SpeechRecognizer = forwardRef<SpeechRecognizerRef, Props>(
  ({ language, onResult, onStart, onEnd, onError }, ref) => {
    const webViewRef = useRef<WebView>(null); // WebViewへの参照

    // 親から呼び出せる関数を公開する
    useImperativeHandle(ref, () => ({
      // 音声認識を開始するJavaScriptをWebViewに注入する
      startListening: () => {
        webViewRef.current?.injectJavaScript(
          `try { handleCommand({ command: 'start', lang: '${language}' }); } catch(e) {} true;`
        );
      },
      // 音声認識を停止するJavaScriptをWebViewに注入する
      stopListening: () => {
        webViewRef.current?.injectJavaScript(
          `try { handleCommand({ command: 'stop' }); } catch(e) {} true;`
        );
      },
    }));

    // WebViewからのメッセージを受け取って対応するコールバックを呼ぶ
    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "start") onStart();           // 認識開始通知
        else if (data.type === "end") onEnd();          // 認識終了通知
        else if (data.type === "error") onError(data.error); // エラー通知
        else if (data.type === "result") onResult(data.text, data.isFinal); // 結果通知
      } catch {
        // JSON解析エラーは無視する
      }
    };

    // Webプラットフォームではこのコンポーネントは使わない（Web Speech APIを直接使用）
    if (Platform.OS === "web") return null;

    return (
      // WebViewは画面に表示せず、バックグラウンドで動かす
      <View style={styles.hidden}>
        <WebView
          ref={webViewRef}
          originWhitelist={["*"]}              // すべてのオリジンを許可
          source={{ html: SPEECH_HTML }}        // 音声認識HTMLを読み込む
          onMessage={handleMessage}             // メッセージ受信時の処理
          mediaPlaybackRequiresUserAction={false} // マイクの自動使用を許可
          allowsInlineMediaPlayback              // インラインメディア再生を許可
          javaScriptEnabled                      // JavaScriptを有効にする
          domStorageEnabled                      // DOMストレージを有効にする
          style={styles.webview}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  // WebViewを画面外に隠す（1x1ピクセル、透明）
  hidden: {
    width: 1,
    height: 1,
    position: "absolute",
    bottom: 0,
    right: 0,
    opacity: 0,
  },
  webview: {
    width: 1,
    height: 1,
  },
});
