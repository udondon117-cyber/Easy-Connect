import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import WebView, { WebViewMessageEvent } from "react-native-webview";

export interface SpeechRecognizerRef {
  startListening: () => void;
  stopListening: () => void;
}

interface Props {
  language: string;
  onResult: (text: string, isFinal: boolean) => void;
  onStart: () => void;
  onEnd: () => void;
  onError: (error: string) => void;
}

const SPEECH_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
<script>
  var recognition = null;
  var isRunning = false;

  function initRecognition(lang) {
    var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: 'not_supported' }));
      return;
    }
    recognition = new SpeechRec();
    recognition.lang = lang || 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = function() {
      isRunning = true;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'start' }));
    };
    recognition.onend = function() {
      isRunning = false;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'end' }));
    };
    recognition.onerror = function(event) {
      isRunning = false;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', error: event.error }));
    };
    recognition.onresult = function(event) {
      var interimTranscript = '';
      var finalTranscript = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      if (finalTranscript) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'result', text: finalTranscript, isFinal: true }));
      }
      if (interimTranscript) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'result', text: interimTranscript, isFinal: false }));
      }
    };
  }

  function handleCommand(data) {
    var cmd = data.command;
    var lang = data.lang || 'ja-JP';
    if (cmd === 'init') {
      initRecognition(lang);
    } else if (cmd === 'start') {
      if (!recognition) initRecognition(lang);
      try { recognition.start(); } catch(e) {}
    } else if (cmd === 'stop') {
      if (recognition && isRunning) {
        try { recognition.stop(); } catch(e) {}
      }
    }
  }

  document.addEventListener('message', function(e) {
    try { handleCommand(JSON.parse(e.data)); } catch(err) {}
  });
  window.addEventListener('message', function(e) {
    try { handleCommand(JSON.parse(e.data)); } catch(err) {}
  });

  initRecognition('ja-JP');
</script>
</body>
</html>
`;

export const SpeechRecognizer = forwardRef<SpeechRecognizerRef, Props>(
  ({ language, onResult, onStart, onEnd, onError }, ref) => {
    const webViewRef = useRef<WebView>(null);

    useImperativeHandle(ref, () => ({
      startListening: () => {
        webViewRef.current?.injectJavaScript(
          `try { handleCommand({ command: 'start', lang: '${language}' }); } catch(e) {} true;`
        );
      },
      stopListening: () => {
        webViewRef.current?.injectJavaScript(
          `try { handleCommand({ command: 'stop' }); } catch(e) {} true;`
        );
      },
    }));

    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "start") onStart();
        else if (data.type === "end") onEnd();
        else if (data.type === "error") onError(data.error);
        else if (data.type === "result") onResult(data.text, data.isFinal);
      } catch {}
    };

    if (Platform.OS === "web") return null;

    return (
      <View style={styles.hidden}>
        <WebView
          ref={webViewRef}
          originWhitelist={["*"]}
          source={{ html: SPEECH_HTML }}
          onMessage={handleMessage}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          javaScriptEnabled
          domStorageEnabled
          style={styles.webview}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
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
