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
  // TTFファイルへの直接パスでフォントをロードする（.fontプロパティより確実）
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    // ベクターアイコンフォントを明示的なパスで指定する
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    'Ionicons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    'MaterialCommunityIcons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    'Feather': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf'),
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
              </Stack>
            </GestureHandlerRootView>
          </CaptionProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
