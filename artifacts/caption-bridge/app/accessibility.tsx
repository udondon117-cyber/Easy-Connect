// ============================================================
// accessibility.tsx
// 役割：視認性（アクセシビリティ）の詳細設定画面
//       弱視の方でも読みやすくなるよう、字幕の見た目を細かく調整できる
// ============================================================

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
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
import { useCaptionContext } from "@/contexts/CaptionContext";

// ============================================================
// 設定項目の定義
// ============================================================

// 文字サイズの選択肢
const FONT_SIZES = [
  { key: "small" as const, label: "小", px: 16 },
  { key: "normal" as const, label: "中", px: 22 },
  { key: "large" as const, label: "大", px: 28 },
  { key: "xlarge" as const, label: "特大", px: 36 },
];

// テキストカラーの選択肢（弱視・色覚特性に対応）
const TEXT_COLORS = [
  { color: "#FFFFFF", label: "白" },
  { color: "#FFFF00", label: "黄" },
  { color: "#00FF88", label: "緑" },
  { color: "#4ECDC4", label: "青緑" },
  { color: "#FFB347", label: "橙" },
];

// 背景透明度の選択肢（0が完全透明、1が完全不透明）
const BG_OPACITIES = [
  { value: 0.5, label: "薄め" },
  { value: 0.7, label: "普通" },
  { value: 0.85, label: "濃い" },
  { value: 1.0, label: "最大" },
];

// ============================================================
// アクセシビリティ設定画面コンポーネント
// ============================================================
export default function AccessibilityScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, getFontSize } = useCaptionContext();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // 現在の設定でプレビューの背景色を計算する
  const previewBgColor = settings.highContrast
    ? `rgba(0, 0, 0, ${settings.bgOpacity})`
    : `rgba(20, 20, 35, ${settings.bgOpacity})`;

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
        <Text style={styles.headerTitle}>視認性の設定</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 20 }]}
      >

        {/* ===== ライブプレビュー ===== */}
        {/* 設定を変えると、ここのサンプル表示がリアルタイムで変わる */}
        <View style={[styles.previewContainer, { backgroundColor: previewBgColor }]}>
          <Text
            style={[
              styles.previewText,
              {
                fontSize: getFontSize(),
                color: settings.textColor,
                fontFamily: settings.fontBold ? "Inter_700Bold" : "Inter_400Regular",
              },
            ]}
          >
            字幕のサンプルテキスト
          </Text>
          <Text
            style={[
              styles.previewSubText,
              {
                color: settings.textColor,
                opacity: 0.6,
              },
            ]}
          >
            ここに音声の字幕が表示されます
          </Text>
        </View>

        {/* ===== セクション1：文字サイズ ===== */}
        <Text style={styles.sectionLabel}>文字サイズ</Text>
        <View style={styles.card}>
          <View style={styles.sizeRow}>
            {FONT_SIZES.map((f) => (
              <Pressable
                key={f.key}
                style={[
                  styles.sizeBtn,
                  settings.fontSize === f.key && styles.sizeBtnActive,
                ]}
                onPress={() => updateSettings({ fontSize: f.key })}
              >
                {/* ラベル（小・中・大・特大） */}
                <Text
                  style={[
                    styles.sizeBtnLabel,
                    settings.fontSize === f.key && styles.sizeBtnLabelActive,
                  ]}
                >
                  {f.label}
                </Text>
                {/* サンプル文字 */}
                <Text
                  style={[
                    styles.sizeBtnSample,
                    { fontSize: Math.min(f.px * 0.7, 20) },
                    settings.fontSize === f.key && styles.sizeBtnLabelActive,
                  ]}
                >
                  あ
                </Text>
                {/* ピクセル数の参考値 */}
                <Text
                  style={[
                    styles.sizeBtnPx,
                    settings.fontSize === f.key && styles.sizeBtnLabelActive,
                  ]}
                >
                  {f.px}pt
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ===== セクション2：テキストカラー ===== */}
        <Text style={styles.sectionLabel}>テキストカラー</Text>
        <View style={styles.card}>
          <View style={styles.colorRow}>
            {TEXT_COLORS.map(({ color, label }) => (
              <Pressable
                key={color}
                style={[
                  styles.colorBtn,
                  { backgroundColor: color },
                  settings.textColor === color && styles.colorBtnSelected,
                ]}
                onPress={() => updateSettings({ textColor: color })}
              >
                {/* 選択中はチェックマークを表示 */}
                {settings.textColor === color && (
                  <Ionicons name="checkmark" size={16} color="#000" />
                )}
                <Text style={styles.colorLabel}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ===== セクション3：背景の透明度 ===== */}
        <Text style={styles.sectionLabel}>字幕背景の濃さ</Text>
        <View style={styles.card}>
          <View style={styles.opacityRow}>
            {BG_OPACITIES.map(({ value, label }) => (
              <Pressable
                key={value}
                style={[
                  styles.opacityBtn,
                  settings.bgOpacity === value && styles.opacityBtnActive,
                ]}
                onPress={() => updateSettings({ bgOpacity: value })}
              >
                {/* 実際の透明度を背景色で視覚的に表現 */}
                <View
                  style={[
                    styles.opacityPreview,
                    { opacity: value },
                  ]}
                />
                <Text
                  style={[
                    styles.opacityLabel,
                    settings.bgOpacity === value && styles.opacityLabelActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ===== セクション4：表示オプション ===== */}
        <Text style={styles.sectionLabel}>表示オプション</Text>
        <View style={styles.card}>

          {/* 太字表示のオン/オフ */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleIcon}>あ</Text>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.toggleLabel}>太字で表示</Text>
                <Text style={styles.toggleDesc}>文字を太くして読みやすくする</Text>
              </View>
            </View>
            <Switch
              value={settings.fontBold}
              onValueChange={(val) => updateSettings({ fontBold: val })}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.divider} />

          {/* ハイコントラストモードのオン/オフ */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              {/* コントラストアイコンを数字で代替 */}
              <View style={styles.contrastIcon}>
                <View style={styles.contrastIconLeft} />
                <View style={styles.contrastIconRight} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.toggleLabel}>ハイコントラスト</Text>
                <Text style={styles.toggleDesc}>背景を純黒にしてコントラストを最大化</Text>
              </View>
            </View>
            <Switch
              value={settings.highContrast}
              onValueChange={(val) => updateSettings({ highContrast: val })}
              trackColor={{ false: Colors.border, true: Colors.accentSecondary }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.divider} />

          {/* タイムスタンプ表示のオン/オフ */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="time-outline" size={20} color={Colors.accentSecondary} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.toggleLabel}>時刻を表示</Text>
                <Text style={styles.toggleDesc}>各字幕に認識時刻を表示する</Text>
              </View>
            </View>
            <Switch
              value={settings.showTimestamp}
              onValueChange={(val) => updateSettings({ showTimestamp: val })}
              trackColor={{ false: Colors.border, true: Colors.accentSecondary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ===== アクセシビリティの説明 ===== */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.accent} />
          <Text style={styles.infoText}>
            これらの設定は自動的に保存されます。{"\n"}
            変更はすぐにプレビューに反映されます。
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

// ============================================================
// スタイル定義
// ============================================================
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

  // ライブプレビューエリア
  previewContainer: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 100,
    justifyContent: "center",
  },
  previewText: {
    lineHeight: 44,
  },
  previewSubText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },

  // セクションラベル
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

  // カード
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },

  // 文字サイズ選択
  sizeRow: {
    flexDirection: "row",
    padding: 10,
    gap: 8,
  },
  sizeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surfaceHigh,
    alignItems: "center",
    gap: 3,
  },
  sizeBtnActive: {
    backgroundColor: Colors.accent,
  },
  sizeBtnLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  sizeBtnLabelActive: {
    color: Colors.background,
  },
  sizeBtnSample: {
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  sizeBtnPx: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },

  // テキストカラー選択
  colorRow: {
    flexDirection: "row",
    padding: 14,
    gap: 10,
    justifyContent: "center",
  },
  colorBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  colorBtnSelected: {
    borderWidth: 3,
    borderColor: Colors.text,
  },
  colorLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#000",
    textShadowColor: "rgba(255,255,255,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // 背景透明度選択
  opacityRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },
  opacityBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceHigh,
    alignItems: "center",
    gap: 6,
  },
  opacityBtnActive: {
    backgroundColor: Colors.accent,
  },
  opacityPreview: {
    width: 28,
    height: 16,
    borderRadius: 4,
    backgroundColor: "#333",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  opacityLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  opacityLabelActive: {
    color: Colors.background,
    fontFamily: "Inter_600SemiBold",
  },

  // トグルスイッチ行
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
  toggleIcon: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.accent,
    width: 24,
    textAlign: "center",
  },
  contrastIcon: {
    width: 24,
    height: 20,
    flexDirection: "row",
    borderRadius: 4,
    overflow: "hidden",
  },
  contrastIconLeft: {
    flex: 1,
    backgroundColor: "#000",
  },
  contrastIconRight: {
    flex: 1,
    backgroundColor: "#fff",
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
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },

  // 説明ボックス
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(78, 205, 196, 0.08)",
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(78, 205, 196, 0.2)",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
