// ============================================================
// SpeechRecognizer.tsx
// 役割：iOS・Android・Webで動くネイティブ音声認識コンポーネント
//
// 【修正理由】
// iOSのWebView（WKWebView）はWeb Speech APIをサポートしていない。
// そのため expo-speech-recognition（Appleのネイティブ音声認識エンジン使用）に切り替えた。
// → iPhone・iPad・Androidで確実に動く
// ============================================================

import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import React, { forwardRef, useCallback, useImperativeHandle } from "react";
import { Platform } from "react-native";

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

// ============================================================
// SpeechRecognizerコンポーネント
// UIを持たない「透明な」コンポーネントとして動作する
// forwardRefで親からstartListening/stopListeningを呼べるようにする
// ============================================================
export const SpeechRecognizer = forwardRef<SpeechRecognizerRef, Props>(
  ({ language, onResult, onStart, onEnd, onError }, ref) => {

    // ========== ネイティブ音声認識イベントの登録 ==========
    // 各イベントはexpo-speech-recognitionが自動的に管理する

    // 認識が開始した時のイベント
    useSpeechRecognitionEvent("start", () => {
      onStart();
    });

    // 認識が終了した時のイベント
    useSpeechRecognitionEvent("end", () => {
      onEnd();
    });

    // エラーが発生した時のイベント
    // iOS/Androidのエラーコードを受け取り、親に伝える
    useSpeechRecognitionEvent("error", (event) => {
      const errorCode = event.error ?? "unknown";
      onError(errorCode);
    });

    // 音声認識の結果を受け取った時のイベント
    useSpeechRecognitionEvent("result", (event) => {
      // 認識結果の1番目の候補テキストを取得する
      const transcript = event.results?.[0]?.transcript ?? "";
      if (!transcript) return;

      if (event.isFinal) {
        // 確定した結果を親に通知する
        onResult(transcript, true);
      } else {
        // 認識途中の結果を親に通知する（リアルタイム表示用）
        onResult(transcript, false);
      }
    });

    // ========== 親コンポーネントから呼べる関数を公開する ==========
    useImperativeHandle(ref, () => ({

      // 音声認識を開始する（マイク許可リクエストも自動で行う）
      startListening: async () => {
        try {
          // まずマイクと音声認識のパーミッション（使用許可）を確認・要求する
          const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

          if (!granted) {
            // ユーザーが許可しなかった場合はエラーを通知する
            onError("not-allowed");
            return;
          }

          // ネイティブの音声認識を開始する
          ExpoSpeechRecognitionModule.start({
            lang: language || "ja-JP",  // 認識言語（デフォルト：日本語）
            interimResults: true,        // 認識途中の結果も取得する
            continuous: true,            // 停止するまで連続して認識し続ける
            maxAlternatives: 1,          // 候補は1つだけ取得する
          });
        } catch (err) {
          // 予期しないエラーが発生した場合
          onError("start-failed");
        }
      },

      // 音声認識を停止する
      stopListening: () => {
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {
          // すでに停止している場合はエラーを無視する
        }
      },
    }));

    // このコンポーネントはUIを持たない（画面に何も表示しない）
    return null;
  }
);
