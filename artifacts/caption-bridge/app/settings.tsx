// ============================================================
// settings.tsx
// 役割：アプリの設定画面
//       認識言語・文字サイズ・動作設定などを変更できる
// ============================================================

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

// ============================================================
// 型定義
// ============================================================

// 認識可能な言語の定義
type Language = {
  code: string;   // 言語コード（例: "ja-JP"）
  label: string;  // 日本語での表示名
  native: string; // 英語での表示名
};

// 対応している認識言語のリスト
const LANGUAGES: Language[] = [
  { code: "ja-JP", label: "日本語", native: "Japanese" },
  { code: "en-US", label: "英語（アメリカ）", native: "English (US)" },
  { code: "zh-CN", label: "中国語（簡体）", native: "Chinese (Simplified)" },
  { code: "ko-KR", label: "韓国語", native: "Korean" },
  { code: "fr-FR", label: "フランス語", native: "French" },
];

// 文字サイズの種類
type FontSize = "small" | "normal" | "large" | "xlarge";

// 文字サイズの選択肢定義
const FONT_SIZES: { key: FontSize; label: string; size: number }[] = [
  { key: "small", label: "小", size: 16 },
  { key: "normal", label: "中", size: 22 },
  { key: "large", label: "大", size: 28 },
  { key: "xlarge", label: "特大", size: 34 },
];

// ============================================================
// 設定画面コンポーネント
// ============================================================
export default function SettingsScreen() {
  // 端末の安全な表示エリアの余白を取得
  const insets = useSafeAreaInsets();

  // ========== 設定値の状態管理 ==========
  const [selectedLang, setSelectedLang] = useState("ja-JP");        // 選択中の言語
  const [fontSize, setFontSize] = useState<FontSize>("normal");      // 選択中の文字サイズ
  const [continuousMode, setContinuousMode] = useState(true);        // 継続認識モードのオン/オフ
  const [showTimestamp, setShowTimestamp] = useState(true);          // タイムスタンプ表示のオン/オフ

  // プラットフォームに応じた上下の余白を計算
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>

      {/* ===== ヘッダーエリア ===== */}
      <View style={styles.header}>
        {/* 戻るボタン（左矢印アイコン）→ メイン画面に戻る */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>

        {/* 画面タイトル */}
        <Text style={styles.headerTitle}>設定</Text>

        {/* 右側のスペース調整用（中央揃えのため） */}
        <View style={{ width: 40 }} />
      </View>

      {/* ===== スクロール可能な設定リスト ===== */}
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ===== セクション1：認識言語の選択 ===== */}
        <Text style={styles.sectionLabel}>認識言語</Text>
        <View style={styles.card}>
          {LANGUAGES.map((lang, idx) => (
            <React.Fragment key={lang.code}>
              {/* 各言語の選択行 */}
              <Pressable
                style={({ pressed }) => [
                  styles.langRow,
                  pressed && styles.rowPressed, // タップ時に背景を明るくする
                ]}
                onPress={() => setSelectedLang(lang.code)}
              >
                <View>
                  <Text style={styles.langLabel}>{lang.label}</Text>
                  <Text style={styles.langNative}>{lang.native}</Text>
                </View>
                {/* 選択中の言語にチェックマークを表示 */}
                {selectedLang === lang.code ? (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />
                ) : (
                  <Ionicons name="ellipse-outline" size={22} color={Colors.textMuted} />
                )}
              </Pressable>
              {/* 区切り線（最後の項目には表示しない） */}
              {idx < LANGUAGES.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ===== セクション2：字幕の文字サイズ選択 ===== */}
        <Text style={styles.sectionLabel}>字幕の文字サイズ</Text>
        <View style={styles.card}>
          <View style={styles.fontSizeRow}>
            {/* 各文字サイズのボタン */}
            {FONT_SIZES.map((f) => (
              <Pressable
                key={f.key}
                style={[
                  styles.fontSizeBtn,
                  fontSize === f.key && styles.fontSizeBtnActive, // 選択中は強調表示
                ]}
                onPress={() => setFontSize(f.key)}
              >
                {/* サイズラベル（小・中・大・特大） */}
                <Text
                  style={[
                    styles.fontSizeBtnText,
                    { fontSize: f.size > 28 ? 18 : f.size > 20 ? 16 : 14 },
                    fontSize === f.key && styles.fontSizeBtnTextActive,
                  ]}
                >
                  {f.label}
                </Text>
                {/* サンプル文字「あ」でサイズ感を表示 */}
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

        {/* ===== セクション3：動作設定 ===== */}
        <Text style={styles.sectionLabel}>動作設定</Text>
        <View style={styles.card}>

          {/* 継続認識モードのオン/オフ切り替え */}
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

          {/* タイムスタンプ表示のオン/オフ切り替え */}
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

        {/* ===== セクション4：アプリ情報 ===== */}
        <Text style={styles.sectionLabel}>アプリについて</Text>
        <View style={styles.card}>
          {/* アプリ名の表示 */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>アプリ名</Text>
            <Text style={styles.infoValue}>CaptionBridge (キャプションブリッジ)</Text>
          </View>
          <View style={styles.divider} />
          {/* バージョン番号 */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>バージョン</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          {/* アプリの目的 */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>目的</Text>
            <Text style={styles.infoValue}>高齢者・障害者向けアクセシビリティ</Text>
          </View>
        </View>

      </ScrollView>
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
  },

  // ヘッダーエリア（戻るボタン・タイトル）
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

  // スクロールエリアの内側余白
  scroll: {
    padding: 20,
    gap: 8,
  },

  // セクションラベル（「認識言語」「字幕の文字サイズ」など）
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

  // 設定項目のカード（角丸の枠）
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },

  // 言語選択の各行
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceHigh, // タップ時の背景色
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

  // 項目間の区切り線
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },

  // 文字サイズ選択ボタンの横並びエリア
  fontSizeRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },

  // 各文字サイズボタン
  fontSizeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceHigh,
    alignItems: "center",
    gap: 4,
  },
  fontSizeBtnActive: {
    backgroundColor: Colors.accent, // 選択中はティール色
  },
  fontSizeBtnText: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  fontSizeBtnTextActive: {
    color: Colors.background, // 選択中は文字色を反転
  },
  fontSizePreview: {
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },

  // トグルスイッチの行（動作設定）
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

  // アプリ情報の各行
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
