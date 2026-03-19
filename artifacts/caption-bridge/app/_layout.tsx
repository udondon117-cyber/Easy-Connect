// ============================================================
// _layout.tsx
// 役割：アプリ全体の共通レイアウト
//
// 【フォント文字化け修正について】
// @expo/vector-icons の .font プロパティを useFonts に渡す方法は
// Expo Go SDK 52 で動作しない場合がある。
// TTF ファイルへの直接 require パスを使うことで確実にロードする。
// パス：@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/
// ============================================================

import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  NotoSansJP_400Regular,
  NotoSansJP_700Bold,
} from "@expo-google-fonts/noto-sans-jp";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CaptionProvider } from "@/contexts/CaptionContext";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  // TTFファイルへの直接パスでフォントをロードする
  // 【重要】node_modules パスは pnpm ワークスペースのシムリンク構造上
  //         Expo Go の Metro バンドラーで解決できない場合がある。
  //         assets/fonts/ にコピーしたファイルを参照することで確実にロードする。
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    // 日本語フォント（中国語フォントへの誤フォールバックを防ぐ）
    NotoSansJP_400Regular,
    NotoSansJP_700Bold,
    // アイコンフォントは assets/fonts/ からロードする（pnpm symlink 問題を回避）
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    'Ionicons': require('../assets/fonts/Ionicons.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    'MaterialCommunityIcons': require('../assets/fonts/MaterialCommunityIcons.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    'Feather': require('../assets/fonts/Feather.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <CaptionProvider>
            <GestureHandlerRootView
              style={{ flex: 1, backgroundColor: Colors.background }}
            >
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: Colors.background },
                  animation: "fade",
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="history" />
                <Stack.Screen name="accessibility" />
                <Stack.Screen name="about" />
                <Stack.Screen name="auracast" />
              </Stack>
            </GestureHandlerRootView>
          </CaptionProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
