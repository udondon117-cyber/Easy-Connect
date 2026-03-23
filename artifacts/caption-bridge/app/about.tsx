// ============================================================
// about.tsx
// 役割：アプリ紹介画面（アクセシビリティとコンセプトを伝える）
// ============================================================

import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

// ============================================================
// 機能カード用データ
// ============================================================
const FEATURES = [
  {
    icon: "mic" as const,
    title: "リアルタイム字幕",
    desc: "マイクで拾った音声を即座にテキスト変換。会話・テレビ・ポッドキャストに。",
  },
  {
    icon: "music" as const,
    title: "音楽認識",
    desc: "♪ボタンを押すだけで、流れている曲名・アーティストを自動特定してSpotifyへ繋ぐ。",
  },
  {
    icon: "copy" as const,
    title: "字幕のコピー",
    desc: "字幕を長押しすると1行コピー、コピーボタンで全文コピー。メモや翻訳に使える。",
  },
  {
    icon: "clock" as const,
    title: "履歴の保存",
    desc: "過去の字幕セッションを自動保存。後から見返すことができる。",
  },
];

const ROADMAP = [
  {
    icon: "layers" as const,
    title: "透明オーバーレイ字幕（開発中）",
    desc: "他のアプリの上に透明な字幕を重ねて表示するPiPモード。カスタムAPKビルドで実現予定。",
    badge: "近日公開",
  },
  {
    icon: "radio" as const,
    title: "Auracast対応（研究中）",
    desc: "Bluetooth LE Audioを使った補聴器・会場スピーカーの音声を直接字幕化する機能。",
    badge: "将来",
  },
  {
    icon: "volume-2" as const,
    title: "内部音声キャプチャ（開発中）",
    desc: "マイクではなくスマホの再生音（動画・ポッドキャスト等）を直接テキスト化する機能。",
    badge: "近日公開",
  },
];

// ============================================================
// About 画面
// ============================================================
export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

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
        <Text style={styles.headerTitle}>このアプリについて</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* メインメッセージカード */}
        <View style={styles.messageCard}>
          <Text style={styles.messageQuote}>
            {"誰でも直感的に使える、\n究極にシンプルなデザイン。\n\nそのシンプルさが、\n結果として高齢者や難聴者の\n大きな助けになります。"}
          </Text>
          <View style={styles.messageDivider} />
          <Text style={styles.appName}>CaptionBridge</Text>
          <Text style={styles.appNameJa}>キャプションブリッジ</Text>
        </View>

        {/* アクセシビリティミッション */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アクセシビリティへの想い</Text>
          <Text style={styles.sectionText}>
            {"聴覚障害をお持ちの方、高齢で聞き取りが難しくなった方、騒がしい場所でもコミュニケーションしたい方、外国語の音声を理解したい方。\n\nそのすべての方に、言葉の橋渡しを。\nCaptionBridgeはそのために作られました。"}
          </Text>
        </View>

        {/* 現在の機能 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>現在の機能</Text>
          <View style={styles.featureList}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureItem}>
                <View style={styles.featureIcon}>
                  <Feather name={f.icon} size={20} color={Colors.accent} />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ロードマップ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>今後の予定</Text>
          <View style={styles.featureList}>
            {ROADMAP.map((r) => (
              <View key={r.title} style={styles.featureItem}>
                <View style={[styles.featureIcon, styles.roadmapIcon]}>
                  <Feather name={r.icon} size={20} color={Colors.textSecondary} />
                </View>
                <View style={styles.featureText}>
                  <View style={styles.roadmapTitleRow}>
                    <Text style={[styles.featureTitle, styles.roadmapTitle]}>{r.title}</Text>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{r.badge}</Text>
                    </View>
                  </View>
                  <Text style={styles.featureDesc}>{r.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* バージョン情報 */}
        <View style={styles.versionCard}>
          <Text style={styles.versionLabel}>バージョン</Text>
          <Text style={styles.versionNum}>1.0.8</Text>
          <Text style={styles.versionNote}>Expo Go (SDK 54) / React Native 0.81</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ============================================================
// スタイル
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
    paddingHorizontal: 16,
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
    fontSize: 17,
    fontWeight: "600",
    color: Colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 24,
  },

  // メインメッセージ
  messageCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.accent + "40",
    alignItems: "center",
    gap: 16,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  messageQuote: {
    fontSize: 16,
    lineHeight: 28,
    color: Colors.text,
    textAlign: "center",
  },
  messageDivider: {
    height: 1,
    width: "60%",
    backgroundColor: Colors.accent + "50",
  },
  appName: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.accent,
    letterSpacing: -0.5,
  },
  appNameJa: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: -8,
  },

  // セクション
  section: {
    gap: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 26,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // 機能リスト
  featureList: {
    gap: 10,
  },
  featureItem: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "flex-start",
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accent + "20",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  roadmapIcon: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureText: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
  },
  featureDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textMuted,
  },
  roadmapTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  roadmapTitle: {
    color: Colors.textSecondary,
  },
  badge: {
    backgroundColor: Colors.accent + "25",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: "600",
  },

  // バージョン
  versionCard: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  versionLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  versionNum: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.text,
  },
  versionNote: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
