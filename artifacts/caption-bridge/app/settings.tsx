import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

type Language = { code: string; label: string; native: string };

const LANGUAGES: Language[] = [
  { code: "ja-JP", label: "日本語", native: "Japanese" },
  { code: "en-US", label: "英語（アメリカ）", native: "English (US)" },
  { code: "zh-CN", label: "中国語（簡体）", native: "Chinese (Simplified)" },
  { code: "ko-KR", label: "韓国語", native: "Korean" },
  { code: "fr-FR", label: "フランス語", native: "French" },
];

type FontSize = "small" | "normal" | "large" | "xlarge";
const FONT_SIZES: { key: FontSize; label: string; size: number }[] = [
  { key: "small", label: "小", size: 16 },
  { key: "normal", label: "中", size: 22 },
  { key: "large", label: "大", size: 28 },
  { key: "xlarge", label: "特大", size: 34 },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [selectedLang, setSelectedLang] = useState("ja-JP");
  const [fontSize, setFontSize] = useState<FontSize>("normal");
  const [continuousMode, setContinuousMode] = useState(true);
  const [showTimestamp, setShowTimestamp] = useState(true);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>設定</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 認識言語 */}
        <Text style={styles.sectionLabel}>認識言語</Text>
        <View style={styles.card}>
          {LANGUAGES.map((lang, idx) => (
            <React.Fragment key={lang.code}>
              <Pressable
                style={({ pressed }) => [
                  styles.langRow,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => setSelectedLang(lang.code)}
              >
                <View>
                  <Text style={styles.langLabel}>{lang.label}</Text>
                  <Text style={styles.langNative}>{lang.native}</Text>
                </View>
                {selectedLang === lang.code ? (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />
                ) : (
                  <Ionicons name="ellipse-outline" size={22} color={Colors.textMuted} />
                )}
              </Pressable>
              {idx < LANGUAGES.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* 文字サイズ */}
        <Text style={styles.sectionLabel}>字幕の文字サイズ</Text>
        <View style={styles.card}>
          <View style={styles.fontSizeRow}>
            {FONT_SIZES.map((f) => (
              <Pressable
                key={f.key}
                style={[
                  styles.fontSizeBtn,
                  fontSize === f.key && styles.fontSizeBtnActive,
                ]}
                onPress={() => setFontSize(f.key)}
              >
                <Text
                  style={[
                    styles.fontSizeBtnText,
                    { fontSize: f.size > 28 ? 18 : f.size > 20 ? 16 : 14 },
                    fontSize === f.key && styles.fontSizeBtnTextActive,
                  ]}
                >
                  {f.label}
                </Text>
                <Text
                  style={[
                    styles.fontSizePreview,
                    { fontSize: Math.min(f.size, 20) },
                    fontSize === f.key && styles.fontSizeBtnTextActive,
                  ]}
                >
                  あ
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 動作設定 */}
        <Text style={styles.sectionLabel}>動作設定</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <MaterialCommunityIcons
                name="microphone-outline"
                size={20}
                color={Colors.accent}
              />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.toggleLabel}>継続認識モード</Text>
                <Text style={styles.toggleDesc}>停止するまで自動で認識し続ける</Text>
              </View>
            </View>
            <Switch
              value={continuousMode}
              onValueChange={setContinuousMode}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Feather name="clock" size={20} color={Colors.accentSecondary} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.toggleLabel}>タイムスタンプ表示</Text>
                <Text style={styles.toggleDesc}>各字幕に時刻を表示する</Text>
              </View>
            </View>
            <Switch
              value={showTimestamp}
              onValueChange={setShowTimestamp}
              trackColor={{ false: Colors.border, true: Colors.accentSecondary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* アプリ情報 */}
        <Text style={styles.sectionLabel}>アプリについて</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>アプリ名</Text>
            <Text style={styles.infoValue}>CaptionBridge (キャプションブリッジ)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>バージョン</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>目的</Text>
            <Text style={styles.infoValue}>高齢者・障害者向けアクセシビリティ</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  scroll: {
    padding: 20,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceHigh,
  },
  langLabel: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  langNative: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  fontSizeRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },
  fontSizeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceHigh,
    alignItems: "center",
    gap: 4,
  },
  fontSizeBtnActive: {
    backgroundColor: Colors.accent,
  },
  fontSizeBtnText: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  fontSizeBtnTextActive: {
    color: Colors.background,
  },
  fontSizePreview: {
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toggleInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  toggleDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoLabel: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    maxWidth: "55%",
    textAlign: "right",
  },
});
