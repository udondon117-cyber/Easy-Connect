// ============================================================
// _layout.tsx
// 役割：アプリ全体の共通レイアウトを定義するルートファイル
//       フォントの読み込み、テーマ設定、ナビゲーション構造を管理する
// ============================================================

import {
  Inter_400Regular,   // 標準フォント（本文用）
  Inter_600SemiBold,  // やや太めフォント（ラベル用）
  Inter_700Bold,      // 太字フォント（タイトル用）
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import Colors from "@/constants/colors";

// アプリが完全に準備できるまでスプラッシュ画面を表示し続ける
SplashScreen.preventAutoHideAsync();

// React Queryのクライアントを作成（APIリクエスト管理用）
const queryClient = new QueryClient();

export default function RootLayout() {
  // Google Fontsの読み込み（Inter書体を使用）
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,   // 通常テキスト
    Inter_600SemiBold,  // 強調テキスト
    Inter_700Bold,      // タイトルテキスト
  });

  // フォントの読み込みが完了したらスプラッシュ画面を非表示にする
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // フォントがまだ読み込まれていない場合は何も表示しない（スプラッシュが表示される）
  if (!fontsLoaded && !fontError) return null;

  return (
    // 端末の画面サイズに合わせて安全な表示領域を提供する
    <SafeAreaProvider>
      {/* アプリのクラッシュを検知して、エラー画面を表示するコンポーネント */}
      <ErrorBoundary>
        {/* APIリクエストの状態管理プロバイダー */}
        <QueryClientProvider client={queryClient}>
          {/* スワイプ・タップなどのジェスチャーを処理するプロバイダー */}
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
            {/* 画面遷移（スタックナビゲーション）の設定 */}
            <Stack
              screenOptions={{
                headerShown: false,                          // ヘッダーバーを非表示にする
                contentStyle: { backgroundColor: Colors.background }, // 背景色をダークに設定
                animation: "fade",                           // 画面遷移アニメーションをフェードに設定
              }}
            >
              {/* メイン字幕画面 */}
              <Stack.Screen name="index" />
              {/* 設定画面 */}
              <Stack.Screen name="settings" />
            </Stack>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
