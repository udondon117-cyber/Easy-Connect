// ============================================================
// useOverlay.ts
// 役割：AndroidシステムオーバーレイのJavaScriptブリッジ
//       NativeModules.OverlayModuleを安全に呼び出す
//       Expo Go環境では無効（カスタムAPKのみ動作）
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { NativeModules, Platform } from "react-native";

// ネイティブモジュールが利用可能か確認する
const { OverlayModule } = NativeModules;
const isSupported = Platform.OS === "android" && !!OverlayModule;

export function useOverlay() {
  const [isOverlayActive, setIsOverlayActive] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const activeRef = useRef(false);

  // 初回マウント時に権限状態を確認する
  useEffect(() => {
    if (!isSupported) return;
    OverlayModule.canDrawOverlays().then((can: boolean) => {
      setHasPermission(can);
    });
  }, []);

  // 「他のアプリの上に重ねて表示」権限があるか確認する
  const checkPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    const can: boolean = await OverlayModule.canDrawOverlays();
    setHasPermission(can);
    return can;
  }, []);

  // システム設定画面を開いて権限を要求する
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    const already = await OverlayModule.canDrawOverlays();
    if (already) {
      setHasPermission(true);
      return true;
    }
    OverlayModule.requestPermission();
    return false;
  }, []);

  // オーバーレイを起動する（権限がなければ設定画面を開く）
  const showOverlay = useCallback(async (initialText?: string): Promise<boolean> => {
    if (!isSupported) return false;
    const can = await OverlayModule.canDrawOverlays();
    if (!can) {
      OverlayModule.requestPermission();
      return false;
    }
    OverlayModule.showOverlay();
    if (initialText) {
      setTimeout(() => OverlayModule.updateCaption(initialText), 300);
    }
    setIsOverlayActive(true);
    activeRef.current = true;
    return true;
  }, []);

  // 不透明度を更新する
  const setOpacity = useCallback((opacity: number) => {
    if (!isSupported) return;
    OverlayModule.setOpacity(opacity);
  }, []);

  // オーバーレイを停止する
  const hideOverlay = useCallback(() => {
    if (!isSupported) return;
    OverlayModule.hideOverlay();
    setIsOverlayActive(false);
    activeRef.current = false;
  }, []);

  // 表示中の字幕テキストを更新する
  const updateCaption = useCallback((text: string) => {
    if (!isSupported || !activeRef.current) return;
    OverlayModule.updateCaption(text);
  }, []);

  return {
    isSupported,
    isOverlayActive,
    hasPermission,
    checkPermission,
    requestPermission,
    showOverlay,
    hideOverlay,
    updateCaption,
    setOpacity,
  };
}
