// ============================================================
// CaptionContext.tsx
// 役割：アプリ全体で共有する状態を管理するコンテキスト
//       字幕履歴・アクセシビリティ設定をAsyncStorageに保存する
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ============================================================
// 型定義
// ============================================================

// アクセシビリティ（視認性）設定
export type AccessibilitySettings = {
  fontSize: "small" | "normal" | "large" | "xlarge"; // 文字サイズ
  fontBold: boolean;            // 太字にするかどうか
  textColor: string;            // 字幕テキストの色
  bgOpacity: number;            // 字幕背景の透明度（0.0〜1.0）
  highContrast: boolean;        // ハイコントラストモード
  showTimestamp: boolean;       // タイムスタンプ表示
  language: string;             // 認識言語コード
};

// 一つの字幕エントリ（認識されたテキスト1件）
export type CaptionEntry = {
  id: string;
  text: string;
  timestamp: string; // ISO文字列（JSON保存のため）
};

// 字幕セッション（開始から停止までの1回分）
export type Session = {
  id: string;
  startedAt: string;         // セッション開始時刻（ISO文字列）
  captions: CaptionEntry[];  // このセッションの字幕一覧
};

// コンテキストで提供する値の型
type CaptionContextValue = {
  // アクセシビリティ設定
  settings: AccessibilitySettings;
  updateSettings: (partial: Partial<AccessibilitySettings>) => void;

  // 現在のセッションの字幕（メイン画面で使用）
  currentCaptions: CaptionEntry[];
  setCurrentCaptions: React.Dispatch<React.SetStateAction<CaptionEntry[]>>;

  // 履歴セッション一覧
  sessions: Session[];
  saveSession: (captions: CaptionEntry[]) => void;  // セッションを履歴に保存
  deleteSession: (id: string) => void;              // セッションを履歴から削除

  // フォントサイズを数値に変換するヘルパー
  getFontSize: () => number;
};

// ============================================================
// AsyncStorageのキー定義
// ============================================================
const STORAGE_KEYS = {
  SETTINGS: "@captionbridge_settings",   // アクセシビリティ設定の保存キー
  SESSIONS: "@captionbridge_sessions",   // 履歴セッションの保存キー
};

// ============================================================
// デフォルトのアクセシビリティ設定値
// ============================================================
const DEFAULT_SETTINGS: AccessibilitySettings = {
  fontSize: "normal",      // 標準文字サイズ
  fontBold: false,          // 太字なし
  textColor: "#FFFFFF",     // 白い文字
  bgOpacity: 0.85,          // 背景は少し透明
  highContrast: false,      // ハイコントラストなし
  showTimestamp: true,      // タイムスタンプあり
  language: "ja-JP",        // 日本語認識
};

// ============================================================
// コンテキストの作成
// ============================================================
const CaptionContext = createContext<CaptionContextValue | null>(null);

// ============================================================
// CaptionProviderコンポーネント
// アプリ全体をこのプロバイダーで包むことで、どこからでも設定・履歴にアクセスできる
// ============================================================
export function CaptionProvider({ children }: { children: React.ReactNode }) {
  // アクセシビリティ設定の状態
  const [settings, setSettings] = useState<AccessibilitySettings>(DEFAULT_SETTINGS);
  // 現在の字幕セッション
  const [currentCaptions, setCurrentCaptions] = useState<CaptionEntry[]>([]);
  // 保存された履歴セッション一覧
  const [sessions, setSessions] = useState<Session[]>([]);

  // ========== アプリ起動時：AsyncStorageから設定と履歴を読み込む ==========
  useEffect(() => {
    const loadData = async () => {
      try {
        // 設定を読み込む
        const savedSettings = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (savedSettings) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
        }
        // 履歴を読み込む
        const savedSessions = await AsyncStorage.getItem(STORAGE_KEYS.SESSIONS);
        if (savedSessions) {
          setSessions(JSON.parse(savedSessions));
        }
      } catch (err) {
        // 読み込み失敗時はデフォルト値をそのまま使用する
        console.log("設定の読み込みに失敗しました:", err);
      }
    };
    loadData();
  }, []);

  // ========== アクセシビリティ設定を更新してAsyncStorageに保存する ==========
  const updateSettings = useCallback(
    async (partial: Partial<AccessibilitySettings>) => {
      const newSettings = { ...settings, ...partial };
      setSettings(newSettings);
      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.SETTINGS,
          JSON.stringify(newSettings)
        );
      } catch (err) {
        console.log("設定の保存に失敗しました:", err);
      }
    },
    [settings]
  );

  // ========== 現在の字幕をセッションとして履歴に保存する ==========
  const saveSession = useCallback(
    async (captions: CaptionEntry[]) => {
      // 1件以上字幕がある場合のみ保存する
      if (captions.length === 0) return;

      const newSession: Session = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        startedAt: new Date().toISOString(),
        captions,
      };

      // 最新のセッションを先頭に追加し、最大50件まで保持する
      const updatedSessions = [newSession, ...sessions].slice(0, 50);
      setSessions(updatedSessions);

      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.SESSIONS,
          JSON.stringify(updatedSessions)
        );
      } catch (err) {
        console.log("履歴の保存に失敗しました:", err);
      }
    },
    [sessions]
  );

  // ========== 指定したセッションを履歴から削除する ==========
  const deleteSession = useCallback(
    async (id: string) => {
      const updatedSessions = sessions.filter((s) => s.id !== id);
      setSessions(updatedSessions);
      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.SESSIONS,
          JSON.stringify(updatedSessions)
        );
      } catch (err) {
        console.log("履歴の削除に失敗しました:", err);
      }
    },
    [sessions]
  );

  // ========== フォントサイズ文字列を実際の数値に変換する ==========
  const getFontSize = useCallback((): number => {
    const sizes = {
      small: 16,    // 小
      normal: 22,   // 中（標準）
      large: 28,    // 大
      xlarge: 36,   // 特大（弱視の方向け）
    };
    return sizes[settings.fontSize];
  }, [settings.fontSize]);

  return (
    <CaptionContext.Provider
      value={{
        settings,
        updateSettings,
        currentCaptions,
        setCurrentCaptions,
        sessions,
        saveSession,
        deleteSession,
        getFontSize,
      }}
    >
      {children}
    </CaptionContext.Provider>
  );
}

// ============================================================
// useCaptionContext
// コンポーネント内でコンテキストにアクセスするためのカスタムフック
// ============================================================
export function useCaptionContext(): CaptionContextValue {
  const ctx = useContext(CaptionContext);
  if (!ctx) {
    throw new Error("useCaptionContext は CaptionProvider の内側で使用してください");
  }
  return ctx;
}
