// ============================================================
// _layout.tsx
// 役割：アプリ全体の共通レイアウトを定義するルートファイル
//       フォント・テーマ・状態管理・ナビゲーション構造を管理する
//
// 【フォント読み込みの注意点】
// @expo-google-fonts/inter の useFonts はスプレッド演算子との
// 組み合わせが不安定なため、expo-font の useFonts を使用する。
// ベクターアイコン（Ionicons・Feather・MaterialCommunityIcons）は
// .font プロパティを使って明示的に読み込む。
// ============================================================

import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
// ベクターアイコンのフォントファイルを明示的に読み込む
// これを忘れると ⊠（豆腐文字）が表示される
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// expo-font の汎用 useFonts を使用（スプレッドと相性が良い）
import { useFonts } from "expo-font";
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
  // expo-font の useFonts でInter書体とベクターアイコンを一括読み込みする
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    // @expo/vector-icons の各フォントファイルをスプレッドで展開する
    ...Ionicons.font,                // { 'Ionicons': require('...ttf') }
    ...Feather.font,                 // { 'Feather': require('...ttf') }
    ...MaterialCommunityIcons.font,  // { 'MaterialCommunityIcons': require('...ttf') }
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
