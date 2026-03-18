// ============================================================
// index.tsx
// 役割：アプリのメイン画面（字幕表示画面）
//       音声を認識してリアルタイムで字幕を表示する
// ============================================================

import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import {
  SpeechRecognizer,
  SpeechRecognizerRef,
} from "@/components/SpeechRecognizer";

// ============================================================
// 字幕データの型定義
// ============================================================
type CaptionEntry = {
  id: string;        // 一意のID（重複を避けるため）
  text: string;      // 認識されたテキスト
  timestamp: Date;   // 認識された時刻
};

// ============================================================
// メイン画面コンポーネント
// ============================================================
export default function MainScreen() {
  // 端末の安全な表示エリアの余白を取得（ノッチ・ホームバー対応）
  const insets = useSafeAreaInsets();

  // ========== 状態管理 ==========
  const [isListening, setIsListening] = useState(false);    // 録音中かどうか
  const [interimText, setInterimText] = useState("");        // 認識途中のテキスト
  const [captions, setCaptions] = useState<CaptionEntry[]>([]); // 確定した字幕の履歴
  const [statusMessage, setStatusMessage] = useState("マイクボタンを押して開始"); // 画面下部のステータス
  const [copied, setCopied] = useState(false);               // コピー完了フラグ
  const [error, setError] = useState<string | null>(null);   // エラーメッセージ

  // ========== 参照（Ref）==========
  const scrollRef = useRef<ScrollView>(null);       // 字幕エリアのスクロール制御用
  const speechRef = useRef<SpeechRecognizerRef>(null); // 音声認識コンポーネントの操作用

  // ========== アニメーション値 ==========
  const pulseAnim = useSharedValue(1);   // マイクボタンのパルス（拡大縮小）
  const glowAnim = useSharedValue(0);    // マイクボタンのグロー（光の強さ）
  const btnScale = useSharedValue(1);   // ボタンタップ時の拡大縮小

  // 音声波形バーのアニメーション値（5本分）
  const waveAnims = [
    useSharedValue(0.3),
    useSharedValue(0.5),
    useSharedValue(0.7),
    useSharedValue(0.4),
    useSharedValue(0.6),
  ];

  // ========== アニメーション制御 ==========
  // 録音状態に応じてアニメーションを開始・停止する
  useEffect(() => {
    if (isListening) {
      // 録音中：パルスアニメーションを繰り返す
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // -1 = 無限に繰り返す
        true
      );

      // 録音中：グローアニメーションを繰り返す
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800 }),
          withTiming(0.4, { duration: 800 })
        ),
        -1,
        true
      );

      // 録音中：音声波形バーのアニメーションを繰り返す
      waveAnims.forEach((anim, i) => {
        anim.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 300 + i * 80, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.15, { duration: 300 + i * 80, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        );
      });
    } else {
      // 録音停止：アニメーションを元に戻す
      pulseAnim.value = withTiming(1, { duration: 300 });
      glowAnim.value = withTiming(0, { duration: 300 });
      waveAnims.forEach((anim) => {
        anim.value = withTiming(0.3, { duration: 400 });
      });
    }
  }, [isListening]);

  // ========== アニメーションスタイル ==========
  // パルスアニメーション（拡大縮小）
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  // グローアニメーション（透明度）
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowAnim.value,
  }));

  // ボタンタップ時の縮小アニメーション
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  // 音声波形バーのアニメーション（縦方向の拡大縮小）
  const waveStyles = waveAnims.map((anim) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => ({
      scaleY: anim.value,
    }))
  );

  // ========== イベントハンドラー ==========

  // マイクボタンをタップした時の処理（録音開始/停止の切り替え）
  const handleToggle = useCallback(async () => {
    // ボタンタップのアニメーション
    btnScale.value = withSequence(
      withSpring(0.92, { damping: 10, stiffness: 400 }),
      withSpring(1, { damping: 10, stiffness: 400 })
    );

    // スマホに触覚フィードバック（バイブレーション）を送る
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (isListening) {
      // 録音中の場合：停止する
      speechRef.current?.stopListening();
      setIsListening(false);
      setInterimText("");
      setStatusMessage("マイクボタンを押して開始");
    } else {
      // 停止中の場合：開始する
      setError(null);
      setInterimText("");
      setStatusMessage("認識中...");
      speechRef.current?.startListening();
    }
  }, [isListening]);

  // 音声認識が開始された時の処理
  const handleSpeechStart = useCallback(() => {
    setIsListening(true);
    setStatusMessage("聞いています...");
    setError(null);
  }, []);

  // 音声認識が終了した時の処理
  const handleSpeechEnd = useCallback(() => {
    setIsListening(false);
    setInterimText("");
    setStatusMessage("マイクボタンを押して開始");
  }, []);

  // 音声認識の結果を受け取った時の処理
  const handleResult = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      // 確定した字幕を履歴に追加する
      const entry: CaptionEntry = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        text: text.trim(),
        timestamp: new Date(),
      };
      setCaptions((prev) => [...prev, entry]);
      setInterimText("");
      // 新しい字幕が追加されたら自動スクロールする
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } else {
      // 認識途中のテキストを表示する（確定ではない）
      setInterimText(text);
    }
  }, []);

  // エラーが発生した時の処理（エラーの種類に応じて日本語メッセージを表示）
  const handleError = useCallback((err: string) => {
    setIsListening(false);
    setInterimText("");
    if (err === "not_supported") {
      setError("お使いのデバイスは音声認識に非対応です");
    } else if (err === "not-allowed" || err === "permission_denied") {
      setError("マイクの使用を許可してください");
    } else if (err === "network") {
      setError("インターネット接続を確認してください");
    } else if (err === "no-speech") {
      // 音声なし（無音）の場合はエラーではなくステータスをリセットするだけ
      setStatusMessage("マイクボタンを押して開始");
      return;
    } else {
      setError(`認識エラー: ${err}`);
    }
    setStatusMessage("マイクボタンを押して開始");
  }, []);

  // コピーボタンをタップした時の処理
  const handleCopy = useCallback(async () => {
    // すべての字幕テキストを改行でつなげてコピーする
    const allText = captions.map((c) => c.text).join("\n");
    if (!allText) return;
    await Clipboard.setStringAsync(allText);
    // 成功の触覚フィードバック
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    // コピー完了を2秒間表示する
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [captions]);

  // クリアボタンをタップした時の処理（字幕をすべて消す）
  const handleClear = useCallback(async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCaptions([]);
    setInterimText("");
  }, []);

  // ========== 画面表示の計算 ==========
  // Webの場合は固定余白、スマホの場合は端末の安全エリアを使用
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // 字幕エリアに表示する内容があるか確認
  const hasContent = captions.length > 0 || interimText.length > 0;

  // ========== 画面のレンダリング ==========
  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>

      {/* バックグラウンドで動く音声認識コンポーネント（画面には表示されない） */}
      <SpeechRecognizer
        ref={speechRef}
        language="ja-JP"
        onResult={handleResult}
        onStart={handleSpeechStart}
        onEnd={handleSpeechEnd}
        onError={handleError}
      />

      {/* ===== ヘッダーエリア ===== */}
      <View style={styles.header}>
        <View>
          {/* アプリ名（英語） */}
          <Text style={styles.appTitle}>CaptionBridge</Text>
          {/* アプリ名（日本語） */}
          <Text style={styles.appSubtitle}>キャプションブリッジ</Text>
        </View>
        {/* 設定ボタン（右上の歯車アイコン）→ 設定画面へ移動 */}
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push("/settings")}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="settings" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ===== 字幕表示エリア ===== */}
      <View style={styles.captionArea}>
        {!hasContent ? (
          // 字幕がない時の空の状態表示
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="microphone-outline"
              size={48}
              color={Colors.textMuted}
            />
            <Text style={styles.emptyText}>音声を認識すると</Text>
            <Text style={styles.emptyText}>ここに字幕が表示されます</Text>
          </View>
        ) : (
          // 字幕がある時はスクロール可能なリストで表示
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.captionScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* 確定した字幕を順番に表示 */}
            {captions.map((entry) => (
              <View key={entry.id} style={styles.captionBubble}>
                {/* 字幕テキスト */}
                <Text style={styles.captionText}>{entry.text}</Text>
                {/* 認識時刻 */}
                <Text style={styles.captionTime}>
                  {entry.timestamp.toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </Text>
              </View>
            ))}

            {/* 認識途中のテキスト（まだ確定していない、薄い色で表示） */}
            {interimText ? (
              <View style={[styles.captionBubble, styles.interimBubble]}>
                <Text style={[styles.captionText, styles.interimText]}>
                  {interimText}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>

      {/* ===== エラーメッセージバー ===== */}
      {error ? (
        <View style={styles.errorBar}>
          <Ionicons name="warning-outline" size={16} color={Colors.recordingRed} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* ===== コントロールバー（操作ボタン群） ===== */}
      <View style={styles.controls}>

        {/* クリアボタン（左側：字幕を全部消す） */}
        <TouchableOpacity
          style={[styles.sideBtn, !hasContent && styles.sideBtnDisabled]}
          onPress={handleClear}
          disabled={!hasContent} // 字幕がない時はボタンを無効化
        >
          <Feather
            name="trash-2"
            size={22}
            color={hasContent ? Colors.textSecondary : Colors.textMuted}
          />
        </TouchableOpacity>

        {/* マイクボタン（中央：録音開始/停止） */}
        <View style={styles.micWrapper}>

          {/* グロー効果（ボタンの光の輪） */}
          <Reanimated.View
            style={[
              styles.micGlow,
              isListening ? styles.micGlowActive : styles.micGlowIdle,
              glowStyle,
            ]}
          />

          {/* パルスリング（外側の点滅する輪） */}
          <Reanimated.View
            style={[
              styles.micPulse,
              isListening ? styles.micPulseActive : styles.micPulseIdle,
              pulseStyle,
            ]}
          />

          {/* ボタン本体 */}
          <Reanimated.View style={btnStyle}>
            <Pressable
              style={[
                styles.micBtn,
                isListening ? styles.micBtnActive : styles.micBtnIdle,
              ]}
              onPress={handleToggle}
            >
              {isListening ? (
                // 録音中：音声波形アニメーションを表示
                <View style={styles.waveContainer}>
                  {waveStyles.map((ws, i) => (
                    <Reanimated.View key={i} style={[styles.waveBar, ws]} />
                  ))}
                </View>
              ) : (
                // 停止中：マイクアイコンを表示
                <MaterialCommunityIcons name="microphone" size={34} color="#fff" />
              )}
            </Pressable>
          </Reanimated.View>
        </View>

        {/* コピーボタン（右側：字幕テキストをコピー） */}
        <TouchableOpacity
          style={[styles.sideBtn, !hasContent && styles.sideBtnDisabled]}
          onPress={handleCopy}
          disabled={!hasContent} // 字幕がない時はボタンを無効化
        >
          <Ionicons
            name={copied ? "checkmark-circle" : "copy-outline"}
            size={22}
            color={
              copied
                ? Colors.success          // コピー完了時は緑色
                : hasContent
                  ? Colors.textSecondary  // 字幕あり時は白色
                  : Colors.textMuted      // 字幕なし時は薄い色
            }
          />
        </TouchableOpacity>
      </View>

      {/* ===== ステータステキスト（現在の状態を表示） ===== */}
      <Text style={styles.statusText}>{statusMessage}</Text>
    </View>
  );
}

// ============================================================
// スタイル定義
// ============================================================
const styles = StyleSheet.create({
  // 画面全体のコンテナ
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
  },

  // ヘッダー部分（タイトルと設定ボタン）
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingBottom: 16,
  },
  appTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.accent,
    marginTop: 2,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },

  // 字幕表示エリア（画面の大部分を占める）
  captionArea: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    marginBottom: 16,
  },

  // 字幕がない時の空の状態
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 24,
  },

  // 字幕スクロールエリア
  captionScroll: {
    padding: 16,
    gap: 12,
  },

  // 各字幕のバブル（吹き出し風）
  captionBubble: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },

  // 認識途中の字幕バブル（ティール色の枠線付き）
  interimBubble: {
    borderColor: Colors.accent,
    borderWidth: 1,
    backgroundColor: "rgba(78, 205, 196, 0.08)",
  },

  // 字幕テキスト（大きめフォントで読みやすく）
  captionText: {
    fontSize: 22,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 32,
  },

  // 認識途中テキスト（少し薄い色）
  interimText: {
    color: Colors.textSecondary,
  },

  // 時刻表示テキスト
  captionTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },

  // エラーメッセージバー
  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 71, 87, 0.12)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 71, 87, 0.3)",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.recordingRed,
    flex: 1,
  },

  // コントロールバー（操作ボタンが並ぶ行）
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },

  // 左右のサイドボタン（クリア・コピー）
  sideBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sideBtnDisabled: {
    opacity: 0.4, // 無効状態は薄く表示
  },

  // マイクボタンの外側ラッパー（グロー・パルスを重ねるため）
  micWrapper: {
    width: 90,
    height: 90,
    alignItems: "center",
    justifyContent: "center",
  },

  // グロー効果（ボタンの背後に広がる光）
  micGlow: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  micGlowActive: {
    // 録音中：赤いグロー
    backgroundColor: Colors.recordingGlow,
    shadowColor: Colors.recordingRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 12,
  },
  micGlowIdle: {
    // 停止中：ティールのグロー
    backgroundColor: Colors.accentGlow,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
  },

  // パルスリング（外側の輪）
  micPulse: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  micPulseActive: {
    borderWidth: 2,
    borderColor: Colors.recordingRed, // 録音中：赤い輪
  },
  micPulseIdle: {
    borderWidth: 2,
    borderColor: Colors.accent, // 停止中：ティールの輪
  },

  // マイクボタン本体
  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  micBtnIdle: {
    backgroundColor: Colors.accent, // 停止中：ティール色
  },
  micBtnActive: {
    backgroundColor: Colors.recordingRed, // 録音中：赤色
  },

  // 音声波形アニメーションのコンテナ
  waveContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 32,
  },

  // 音声波形の各バー（5本）
  waveBar: {
    width: 4,
    height: 28,
    borderRadius: 3,
    backgroundColor: "#fff",
  },

  // ステータステキスト（現在の状態説明）
  statusText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    paddingBottom: 8,
  },
});
