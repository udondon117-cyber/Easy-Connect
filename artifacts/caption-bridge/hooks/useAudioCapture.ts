// ============================================================
// useAudioCapture.ts
// 役割：内部音声キャプチャのJavaScriptブリッジ
//       AudioCaptureModule（Kotlin）を安全に呼び出す
//       3秒ごとにPCMチャンクをAPIサーバーへ送り字幕テキストを受け取る
//       対象：YouTube・ポッドキャスト等のデバイス内部音声
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { DeviceEventEmitter, NativeModules, Platform } from "react-native";

const { AudioCaptureModule } = NativeModules;

// Android専用・ネイティブモジュールが存在する場合のみ有効
const isSupported = Platform.OS === "android" && !!AudioCaptureModule;

interface UseAudioCaptureOptions {
  apiDomain?: string;
  language?: string;
  targetLanguage?: string; // 追加: 翻訳先言語コード
  onCaption: (text: string) => void;
  onError?: (error: string) => void;
}

export function useAudioCapture({
  apiDomain,
  language = "ja",
  targetLanguage, // 追加
  onCaption,
  onError,
}: UseAudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const isCapturingRef = useRef(false);

  // 最新のコールバックをrefで保持する（stale closure回避）
  const onCaptionRef = useRef(onCaption);
  const onErrorRef = useRef(onError);
  useEffect(() => { onCaptionRef.current = onCaption; }, [onCaption]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // コンポーネントのアンマウント時にキャプチャを停止する
  useEffect(() => {
    return () => {
      if (isCapturingRef.current && isSupported) {
        AudioCaptureModule.stopCapture();
        DeviceEventEmitter.removeAllListeners("AudioCaptureChunk");
      }
    };
  }, []);

  // PCMチャンクをAPIサーバーへ送り字幕テキストを受け取る
  const sendChunkForCaption = useCallback(
    async (base64Pcm: string) => {
      if (!apiDomain) return;
      try {
        // ローカルIPまたはlocalhostの場合はhttpを使用し、Replitの場合はhttpsを使用する
        const protocol = (apiDomain.includes("localhost") || /^\d+\.\d+\.\d+\.\d+/.test(apiDomain)) ? "http" : "https";
        // Replit環境特有のパス "/api-server" を除外し、共通の "/api/transcribe" に統一
        const cleanDomain = apiDomain.replace(/\/$/, "");
        const url = `${protocol}://${cleanDomain}/api/transcribe`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioPcmBase64: base64Pcm,
            sampleRate: 16000,
            language,
            targetLanguage, // 追加
          }),
        });
        if (!response.ok) return;
        const data = await response.json() as { text?: string };
        if (data.text && data.text.trim()) {
          // refを通して最新のcallbackを呼ぶ
          onCaptionRef.current(data.text.trim());
        }
      } catch {
        // ネットワークエラーは次のチャンクで自動リトライするので無視する
      }
    },
    [apiDomain, language]
  );

  // 内部音声キャプチャを開始する
  const startCapture = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      const msg = "内部音声キャプチャはAndroid専用です";
      setLastError(msg);
      onErrorRef.current?.(msg);
      return false;
    }

    try {
      // MediaProjection許可ダイアログを表示してユーザーの承認を待つ
      await AudioCaptureModule.requestCapture();

      // 字幕用チャンクイベントをリスンする
      DeviceEventEmitter.removeAllListeners("AudioCaptureChunk");
      DeviceEventEmitter.addListener("AudioCaptureChunk", (base64Pcm: string) => {
        sendChunkForCaption(base64Pcm);
      });

      AudioCaptureModule.startCapture();
      setIsCapturing(true);
      setLastError(null);
      isCapturingRef.current = true;

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastError(msg);
      onErrorRef.current?.(msg);
      return false;
    }
  }, [sendChunkForCaption]);

  // 内部音声キャプチャを停止する
  const stopCapture = useCallback(() => {
    if (!isSupported) return;
    AudioCaptureModule.stopCapture();
    DeviceEventEmitter.removeAllListeners("AudioCaptureChunk");
    setIsCapturing(false);
    isCapturingRef.current = false;
  }, []);

  return {
    isSupported,
    isCapturing,
    lastError,
    startCapture,
    stopCapture,
  };
}
