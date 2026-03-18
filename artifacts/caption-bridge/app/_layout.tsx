// ============================================================
// _layout.tsx
// 役割：アプリ全体の共通レイアウトを定義するルートファイル
//       フォント・テーマ・状態管理・ナビゲーション構造を管理する
// ============================================================

import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CaptionProvider } from "@/contexts/CaptionContext";
import Colors from "@/constants/colors";

// アプリが完全に準備できるまでスプラッシュ画面を表示し続ける
SplashScreen.preventAutoHideAsync();

// React Queryのクライアント（APIリクエスト管理用）
const queryClient = new QueryClient();

export default function RootLayout() {
  // Google Fontsの読み込み（Inter書体）
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,   // 通常テキスト
    Inter_600SemiBold,  // 強調テキスト
    Inter_700Bold,      // タイトル・太字テキスト
  });

  // フォント読み込み完了後にスプラッシュ画面を隠す
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // フォント未読み込みの間は何も表示しない
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          {/* CaptionProviderで全画面を包む（字幕履歴・設定を全画面で共有） */}
          <CaptionProvider>
            <GestureHandlerRootView
              style={{ flex: 1, backgroundColor: Colors.background }}
            >
              {/* スタックナビゲーション（画面遷移の設定） */}
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: Colors.background },
                  animation: "fade",
                }}
              >
                <Stack.Screen name="index" />         {/* メイン字幕画面 */}
                <Stack.Screen name="settings" />      {/* 設定画面 */}
                <Stack.Screen name="history" />       {/* 履歴画面 */}
                <Stack.Screen name="accessibility" /> {/* 視認性設定画面 */}
              </Stack>
            </GestureHandlerRootView>
          </CaptionProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
