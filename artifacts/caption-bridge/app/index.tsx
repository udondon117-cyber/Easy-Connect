import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
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

type CaptionEntry = {
  id: string;
  text: string;
  timestamp: Date;
};

export default function MainScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState("マイクボタンを押して開始");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const speechRef = useRef<SpeechRecognizerRef>(null);

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

  useEffect(() => {
    if (isListening) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800 }),
          withTiming(0.4, { duration: 800 })
        ),
        -1,
        true
      );
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
      pulseAnim.value = withTiming(1, { duration: 300 });
      glowAnim.value = withTiming(0, { duration: 300 });
      waveAnims.forEach((anim) => {
        anim.value = withTiming(0.3, { duration: 400 });
      });
    }
  }, [isListening]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowAnim.value,
  }));

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  const waveStyles = waveAnims.map((anim) =>
    useAnimatedStyle(() => ({
      scaleY: anim.value,
    }))
  );

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

  const handleSpeechStart = useCallback(() => {
    setIsListening(true);
    setStatusMessage("聞いています...");
    setError(null);
  }, []);

  const handleSpeechEnd = useCallback(() => {
    setIsListening(false);
    setInterimText("");
    setStatusMessage("マイクボタンを押して開始");
  }, []);

  const handleResult = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      const entry: CaptionEntry = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        text: text.trim(),
        timestamp: new Date(),
      };
      setCaptions((prev) => [...prev, entry]);
      setInterimText("");
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } else {
      setInterimText(text);
    }
  }, []);

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
      setStatusMessage("マイクボタンを押して開始");
      return;
    } else {
      setError(`認識エラー: ${err}`);
    }
    setStatusMessage("マイクボタンを押して開始");
  }, []);

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

  const handleClear = useCallback(async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCaptions([]);
    setInterimText("");
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const hasContent = captions.length > 0 || interimText.length > 0;

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
      <SpeechRecognizer
        ref={speechRef}
        language="ja-JP"
        onResult={handleResult}
        onStart={handleSpeechStart}
        onEnd={handleSpeechEnd}
        onError={handleError}
      />

      {/* ヘッダー */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>CaptionBridge</Text>
          <Text style={styles.appSubtitle}>キャプションブリッジ</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push("/settings")}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="settings" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* 字幕エリア */}
      <View style={styles.captionArea}>
        {!hasContent ? (
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
            {captions.map((entry) => (
              <View key={entry.id} style={styles.captionBubble}>
                <Text style={styles.captionText}>{entry.text}</Text>
                <Text style={styles.captionTime}>
                  {entry.timestamp.toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </Text>
              </View>
            ))}
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

      {/* エラー表示 */}
      {error ? (
        <View style={styles.errorBar}>
          <Ionicons name="warning-outline" size={16} color={Colors.recordingRed} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* コントロールバー */}
      <View style={styles.controls}>
        {/* クリアボタン */}
        <TouchableOpacity
          style={[styles.sideBtn, !hasContent && styles.sideBtnDisabled]}
          onPress={handleClear}
          disabled={!hasContent}
        >
          <Feather
            name="trash-2"
            size={22}
            color={hasContent ? Colors.textSecondary : Colors.textMuted}
          />
        </TouchableOpacity>

        {/* マイクボタン（中央） */}
        <View style={styles.micWrapper}>
          {/* グロー */}
          <Reanimated.View
            style={[
              styles.micGlow,
              isListening ? styles.micGlowActive : styles.micGlowIdle,
              glowStyle,
            ]}
          />
          {/* パルスリング */}
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
                <View style={styles.waveContainer}>
                  {waveStyles.map((ws, i) => (
                    <Reanimated.View
                      key={i}
                      style={[styles.waveBar, ws]}
                    />
                  ))}
                </View>
              ) : (
                <MaterialCommunityIcons
                  name="microphone"
                  size={34}
                  color="#fff"
                />
              )}
            </Pressable>
          </Reanimated.View>
        </View>

        {/* コピーボタン */}
        <TouchableOpacity
          style={[styles.sideBtn, !hasContent && styles.sideBtnDisabled]}
          onPress={handleCopy}
          disabled={!hasContent}
        >
          <Ionicons
            name={copied ? "checkmark-circle" : "copy-outline"}
            size={22}
            color={
              copied
                ? Colors.success
                : hasContent
                ? Colors.textSecondary
                : Colors.textMuted
            }
          />
        </TouchableOpacity>
      </View>

      {/* ステータス */}
      <Text style={styles.statusText}>{statusMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  captionArea: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    marginBottom: 16,
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
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  interimBubble: {
    borderColor: Colors.accent,
    borderWidth: 1,
    backgroundColor: "rgba(78, 205, 196, 0.08)",
  },
  captionText: {
    fontSize: 22,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 32,
  },
  interimText: {
    color: Colors.textSecondary,
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
    paddingHorizontal: 16,
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
});
