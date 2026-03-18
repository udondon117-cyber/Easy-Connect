// ============================================================
// index.tsx
// 役割：アプリのメイン画面（字幕表示画面）
//       音声をリアルタイムで認識して字幕を表示する
//       ミニオーバーレイモードで字幕を小窓に縮小して動かせる
// ============================================================

import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
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
import { SpeechRecognizer, SpeechRecognizerRef } from "@/components/SpeechRecognizer";
import { CaptionEntry, useCaptionContext } from "@/contexts/CaptionContext";

// ============================================================
// メイン画面コンポーネント
// ============================================================
export default function MainScreen() {
  const insets = useSafeAreaInsets();

  // コンテキストから設定・字幕保存関数を取得する
  const { settings, getFontSize, saveSession } = useCaptionContext();

  // ========== 状態管理 ==========
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState("マイクボタンを押して開始");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMiniMode, setIsMiniMode] = useState(false); // ミニオーバーレイモードのフラグ

  // ========== 参照 ==========
  const scrollRef = useRef<ScrollView>(null);
  const speechRef = useRef<SpeechRecognizerRef>(null);

  // ========== アニメーション値（react-native-reanimated） ==========
  const pulseAnim = useSharedValue(1);
  const glowAnim = useSharedValue(0);
  const btnScale = useSharedValue(1);
  const waveAnims = [
    useSharedValue(0.3),
    useSharedValue(0.5),
    useSharedValue(0.7),
    useSharedValue(0.4),
    useSharedValue(0.6),
  ];

  // ミニオーバーレイのドラッグ位置（react-nativeのAnimated.ValueXY）
  const panPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // ========== ミニオーバーレイのドラッグ操作（PanResponder）==========
  const panResponder = useRef(
    PanResponder.create({
      // タッチが動いたときに反応する
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3,
      // ドラッグ開始時：現在位置をオフセットとして設定する
      onPanResponderGrant: () => {
        panPosition.setOffset({
          x: (panPosition.x as any)._value,
          y: (panPosition.y as any)._value,
        });
      },
      // ドラッグ中：位置を更新する
      onPanResponderMove: Animated.event(
        [null, { dx: panPosition.x, dy: panPosition.y }],
        { useNativeDriver: false }
      ),
      // ドラッグ終了：オフセットを平坦化して位置を確定する
      onPanResponderRelease: () => {
        panPosition.flattenOffset();
      },
    })
  ).current;

  // ========== 録音状態に応じてアニメーションを制御 ==========
  useEffect(() => {
    if (isListening) {
      // 録音中：パルス・グロー・波形アニメーションを繰り返す
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ),
        -1, true
      );
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800 }),
          withTiming(0.4, { duration: 800 })
        ),
        -1, true
      );
      waveAnims.forEach((anim, i) => {
        anim.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 300 + i * 80, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.15, { duration: 300 + i * 80, easing: Easing.inOut(Easing.ease) })
          ),
          -1, true
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

  // アニメーションスタイル
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseAnim.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowAnim.value }));
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));
  const waveStyles = waveAnims.map((anim) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => ({ scaleY: anim.value }))
  );

  // ========== イベントハンドラー ==========

  // マイクボタン：録音開始/停止の切り替え
  const handleToggle = useCallback(async () => {
    btnScale.value = withSequence(
      withSpring(0.92, { damping: 10, stiffness: 400 }),
      withSpring(1, { damping: 10, stiffness: 400 })
    );
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (isListening) {
      speechRef.current?.stopListening();
      setIsListening(false);
      setInterimText("");
      setStatusMessage("マイクボタンを押して開始");
    } else {
      setError(null);
      setInterimText("");
      setStatusMessage("認識中...");
      speechRef.current?.startListening();
    }
  }, [isListening]);

  // 音声認識開始時の処理
  const handleSpeechStart = useCallback(() => {
    setIsListening(true);
    setStatusMessage("聞いています...");
    setError(null);
  }, []);

  // 音声認識終了時の処理（セッションを自動保存する）
  const handleSpeechEnd = useCallback(() => {
    setIsListening(false);
    setInterimText("");
    setStatusMessage("マイクボタンを押して開始");
    // 認識結果がある場合のみ履歴に保存する（captions参照が古いためfunctional update使用）
    setCaptions((current) => {
      if (current.length > 0) {
        saveSession(current);
      }
      return current;
    });
  }, [saveSession]);

  // 音声認識の結果を受け取る
  const handleResult = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      // 確定した字幕を追加する
      const entry: CaptionEntry = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        text: text.trim(),
        timestamp: new Date().toISOString(),
      };
      setCaptions((prev) => [...prev, entry]);
      setInterimText("");
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } else {
      // 認識中のテキスト（まだ確定していない）
      setInterimText(text);
    }
  }, []);

  // エラーを受け取ってわかりやすい日本語メッセージに変換する
  // expo-speech-recognition のエラーコードに対応
  const handleError = useCallback((err: string) => {
    setIsListening(false);
    setInterimText("");

    if (err === "no-speech") {
      // 無音の場合はエラーではなくステータスをリセットするだけ
      setStatusMessage("マイクボタンを押して開始");
      return;
    }

    // エラーコードに応じた日本語メッセージを設定する
    const messages: Record<string, string> = {
      // マイク・音声認識の許可が拒否された
      "not-allowed":          "⚙️ 設定 → プライバシー → マイク → Expo Go をオンにしてください",
      "permission_denied":    "⚙️ 設定 → プライバシー → マイク → Expo Go をオンにしてください",
      // ネットワーク関連
      "network":              "📶 インターネット接続を確認してください",
      // オーディオキャプチャ失敗（マイクが他のアプリに使われている可能性）
      "audio-capture":        "🎙️ マイクにアクセスできません。他のアプリを閉じてから試してください",
      // サービス不許可
      "service-not-allowed":  "⚙️ 設定 → プライバシー → 音声認識 → Expo Go をオンにしてください",
      // 開始失敗
      "start-failed":         "🎙️ 音声認識の開始に失敗しました。もう一度お試しください",
      // 言語非対応
      "language-not-supported": "🌐 この言語には対応していません。設定から別の言語を選んでください",
      // 中断
      "aborted":              "音声認識が中断されました",
    };

    const message = messages[err] ?? `音声認識エラー（${err}）。もう一度お試しください`;
    setError(message);
    setStatusMessage("マイクボタンを押して開始");
  }, []);

  // コピーボタン：すべての字幕をクリップボードにコピーする
  const handleCopy = useCallback(async () => {
    const allText = captions.map((c) => c.text).join("\n");
    if (!allText) return;
    await Clipboard.setStringAsync(allText);
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [captions]);

  // シェアボタン：字幕テキストを他のアプリで共有する
  const handleShare = useCallback(async () => {
    const allText = captions.map((c) => c.text).join("\n");
    if (!allText) return;
    try {
      await Share.share({
        message: allText,
        title: "CaptionBridgeの字幕",
      });
    } catch {}
  }, [captions]);

  // クリアボタン：字幕をすべて消す
  const handleClear = useCallback(async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCaptions([]);
    setInterimText("");
  }, []);

  // ミニモードの切り替え（字幕を小窓に縮小する）
  const handleToggleMiniMode = useCallback(async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (!isMiniMode) {
      // ミニモードに入る時：画面中央下部にリセット
      panPosition.setValue({ x: 0, y: 0 });
    }
    setIsMiniMode((prev) => !prev);
  }, [isMiniMode]);

  // ========== 計算値 ==========
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const hasContent = captions.length > 0 || interimText.length > 0;

  // 視認性設定からスタイルを構築する
  const captionFontSize = getFontSize();
  const captionFontFamily = settings.fontBold ? "Inter_700Bold" : "Inter_400Regular";
  const captionBgColor = settings.highContrast
    ? `rgba(0, 0, 0, ${settings.bgOpacity})`
    : `rgba(14, 14, 22, ${settings.bgOpacity})`;

  // 最新の字幕テキスト（ミニモード用）
  const latestCaption = captions.length > 0
    ? captions[captions.length - 1].text
    : interimText || "音声を待っています...";

  // ============================================================
  // ミニオーバーレイモードの描画
  // ============================================================
  if (isMiniMode) {
    return (
      <View style={styles.miniContainer}>
        {/* バックグラウンドで音声認識は継続する */}
        <SpeechRecognizer
          ref={speechRef}
          language={settings.language}
          onResult={handleResult}
          onStart={handleSpeechStart}
          onEnd={handleSpeechEnd}
          onError={handleError}
        />

        {/* ドラッグ可能な字幕ウィンドウ */}
        <Animated.View
          style={[
            styles.miniOverlay,
            { backgroundColor: captionBgColor },
            {
              transform: [
                { translateX: panPosition.x },
                { translateY: panPosition.y },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* ドラッグハンドル（上部の小さなバー）*/}
          <View style={styles.miniDragHandle} />

          {/* 字幕テキスト */}
          <Text
            style={[
              styles.miniCaptionText,
              {
                fontSize: Math.min(captionFontSize, 20),
                color: settings.textColor,
                fontFamily: captionFontFamily,
              },
            ]}
            numberOfLines={3}
          >
            {latestCaption}
          </Text>

          {/* ミニモードのコントロールバー */}
          <View style={styles.miniControls}>
            {/* 録音ボタン */}
            <TouchableOpacity
              style={[
                styles.miniBtn,
                isListening && styles.miniBtnActive,
              ]}
              onPress={handleToggle}
            >
              <MaterialCommunityIcons
                name={isListening ? "stop" : "microphone"}
                size={16}
                color={isListening ? Colors.recordingRed : Colors.accent}
              />
            </TouchableOpacity>

            {/* 認識中インジケーター */}
            {isListening && (
              <View style={styles.miniIndicator}>
                <View style={styles.miniDot} />
                <Text style={styles.miniStatus}>認識中</Text>
              </View>
            )}

            {/* 展開ボタン（フル画面に戻る） */}
            <TouchableOpacity
              style={styles.miniBtn}
              onPress={handleToggleMiniMode}
            >
              <Ionicons name="expand" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    );
  }

  // ============================================================
  // 通常モードの描画
  // ============================================================
  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>

      {/* バックグラウンドで動く音声認識コンポーネント */}
      <SpeechRecognizer
        ref={speechRef}
        language={settings.language}
        onResult={handleResult}
        onStart={handleSpeechStart}
        onEnd={handleSpeechEnd}
        onError={handleError}
      />

      {/* ===== ヘッダー ===== */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>CaptionBridge</Text>
          <Text style={styles.appSubtitle}>キャプションブリッジ</Text>
        </View>

        {/* ヘッダー右側のボタン群 */}
        <View style={styles.headerRight}>
          {/* 履歴ボタン */}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.push("/history")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* 設定ボタン */}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.push("/settings")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="settings" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ===== 字幕表示エリア ===== */}
      <View style={[styles.captionArea, { backgroundColor: captionBgColor }]}>
        {!hasContent ? (
          // 字幕がない時の案内表示
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
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.captionScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* 確定した字幕の一覧 */}
            {captions.map((entry) => (
              <View key={entry.id} style={styles.captionBubble}>
                <Text
                  style={[
                    styles.captionText,
                    {
                      fontSize: captionFontSize,
                      color: settings.textColor,
                      fontFamily: captionFontFamily,
                    },
                  ]}
                >
                  {entry.text}
                </Text>
                {/* タイムスタンプ（設定でオン/オフ可能）*/}
                {settings.showTimestamp && (
                  <Text style={styles.captionTime}>
                    {new Date(entry.timestamp).toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </Text>
                )}
              </View>
            ))}

            {/* 認識途中のテキスト（薄い色で表示） */}
            {interimText ? (
              <View style={[styles.captionBubble, styles.interimBubble]}>
                <Text
                  style={[
                    styles.captionText,
                    styles.interimText,
                    {
                      fontSize: captionFontSize,
                      color: settings.textColor,
                      fontFamily: captionFontFamily,
                      opacity: 0.6,
                    },
                  ]}
                >
                  {interimText}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>

      {/* ===== エラーメッセージ ===== */}
      {error ? (
        <View style={styles.errorBar}>
          <Ionicons name="warning-outline" size={16} color={Colors.recordingRed} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* ===== コントロールバー ===== */}
      <View style={styles.controls}>

        {/* 左側：クリアボタン */}
        <TouchableOpacity
          style={[styles.sideBtn, !hasContent && styles.sideBtnDisabled]}
          onPress={handleClear}
          disabled={!hasContent}
        >
          <Feather
            name="trash-2"
            size={20}
            color={hasContent ? Colors.textSecondary : Colors.textMuted}
          />
        </TouchableOpacity>

        {/* 中央：マイクボタン */}
        <View style={styles.micWrapper}>
          <Reanimated.View style={[styles.micGlow, isListening ? styles.micGlowActive : styles.micGlowIdle, glowStyle]} />
          <Reanimated.View style={[styles.micPulse, isListening ? styles.micPulseActive : styles.micPulseIdle, pulseStyle]} />
          <Reanimated.View style={btnStyle}>
            <Pressable
              style={[styles.micBtn, isListening ? styles.micBtnActive : styles.micBtnIdle]}
              onPress={handleToggle}
            >
              {isListening ? (
                <View style={styles.waveContainer}>
                  {waveStyles.map((ws, i) => (
                    <Reanimated.View key={i} style={[styles.waveBar, ws]} />
                  ))}
                </View>
              ) : (
                <MaterialCommunityIcons name="microphone" size={34} color="#fff" />
              )}
            </Pressable>
          </Reanimated.View>
        </View>

        {/* 右側：コピー・シェア・ミニモードのボタングループ */}
        <View style={styles.rightButtons}>
          {/* コピーボタン */}
          <TouchableOpacity
            style={[styles.smallBtn, !hasContent && styles.sideBtnDisabled]}
            onPress={handleCopy}
            disabled={!hasContent}
          >
            <Ionicons
              name={copied ? "checkmark-circle" : "copy-outline"}
              size={18}
              color={copied ? Colors.success : hasContent ? Colors.textSecondary : Colors.textMuted}
            />
          </TouchableOpacity>

          {/* シェアボタン */}
          <TouchableOpacity
            style={[styles.smallBtn, !hasContent && styles.sideBtnDisabled]}
            onPress={handleShare}
            disabled={!hasContent}
          >
            <Ionicons
              name="share-outline"
              size={18}
              color={hasContent ? Colors.textSecondary : Colors.textMuted}
            />
          </TouchableOpacity>

          {/* ミニモードボタン（字幕を小窓に縮小する） */}
          <TouchableOpacity style={styles.smallBtn} onPress={handleToggleMiniMode}>
            <Ionicons name="contract-outline" size={18} color={Colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ===== ステータステキスト ===== */}
      <Text style={styles.statusText}>{statusMessage}</Text>
    </View>
  );
}

// ============================================================
// スタイル定義
// ============================================================
const styles = StyleSheet.create({
  // ===== 通常モード =====
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingBottom: 14,
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
  headerRight: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  captionArea: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    marginBottom: 14,
  },
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
  captionScroll: {
    padding: 16,
    gap: 12,
  },
  captionBubble: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  interimBubble: {
    borderColor: Colors.accent,
    borderWidth: 1,
    backgroundColor: "rgba(78, 205, 196, 0.06)",
  },
  captionText: {
    lineHeight: 34,
  },
  interimText: {
    // 認識途中はopacityで薄くする（本体スタイルで設定）
  },
  captionTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
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
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
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
    opacity: 0.4,
  },
  rightButtons: {
    flexDirection: "column",
    gap: 6,
    alignItems: "center",
  },
  smallBtn: {
    width: 38,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  micWrapper: {
    width: 90,
    height: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  micGlow: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  micGlowActive: {
    backgroundColor: Colors.recordingGlow,
    shadowColor: Colors.recordingRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 12,
  },
  micGlowIdle: {
    backgroundColor: Colors.accentGlow,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
  },
  micPulse: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  micPulseActive: {
    borderWidth: 2,
    borderColor: Colors.recordingRed,
  },
  micPulseIdle: {
    borderWidth: 2,
    borderColor: Colors.accent,
  },
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
    backgroundColor: Colors.accent,
  },
  micBtnActive: {
    backgroundColor: Colors.recordingRed,
  },
  waveContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 32,
  },
  waveBar: {
    width: 4,
    height: 28,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  statusText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    paddingBottom: 8,
  },

  // ===== ミニオーバーレイモード =====
  // 背景（他のコンテンツが見えるように透明）
  miniContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },
  // ドラッグ可能な字幕ウィンドウ
  miniOverlay: {
    position: "absolute",
    bottom: 120,
    left: 20,
    right: 20,
    borderRadius: 18,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(78, 205, 196, 0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
  },
  // ドラッグのためのハンドル（上部の小さなバー）
  miniDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignSelf: "center",
  },
  miniCaptionText: {
    lineHeight: 26,
  },
  miniControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  miniBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  miniBtnActive: {
    backgroundColor: "rgba(255, 71, 87, 0.2)",
  },
  miniIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.recordingRed,
  },
  miniStatus: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
});
