// ============================================================
// settings.tsx
// 役割：アプリの設定画面
//       認識言語・動作設定・各種機能画面へのリンクを提供する
// ============================================================

import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useCaptionContext } from "@/contexts/CaptionContext";

// ============================================================
// 認識可能な言語の一覧
// ============================================================
const LANGUAGES = [
  { code: "ja-JP", label: "日本語", native: "Japanese" },
  { code: "en-US", label: "英語（アメリカ）", native: "English (US)" },
  { code: "zh-CN", label: "中国語（簡体）", native: "Chinese (Simplified)" },
  { code: "ko-KR", label: "韓国語", native: "Korean" },
  { code: "fr-FR", label: "フランス語", native: "French" },
];

// ============================================================
// 設定画面コンポーネント
// ============================================================
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, sessions } = useCaptionContext();

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

        {/* ===== クイックアクション（よく使う機能へのショートカット）===== */}
        <Text style={styles.sectionLabel}>機能</Text>
        <View style={styles.card}>

          {/* 字幕の履歴を見る */}
          <Pressable
            style={({ pressed }) => [styles.navRow, pressed && styles.rowPressed]}
            onPress={() => router.push("/history")}
          >
            <View style={[styles.navIcon, { backgroundColor: "rgba(78, 205, 196, 0.15)" }]}>
              <Ionicons name="time-outline" size={20} color={Colors.accent} />
            </View>
            <View style={styles.navTextGroup}>
              <Text style={styles.navLabel}>字幕の履歴</Text>
              <Text style={styles.navDesc}>過去のセッションを振り返る（{sessions.length}件）</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </Pressable>

          <View style={styles.divider} />

          {/* 視認性の設定（弱視の方向け） */}
          <Pressable
            style={({ pressed }) => [styles.navRow, pressed && styles.rowPressed]}
            onPress={() => router.push("/accessibility")}
          >
            <View style={[styles.navIcon, { backgroundColor: "rgba(69, 183, 209, 0.15)" }]}>
              <Ionicons name="eye-outline" size={20} color={Colors.accentSecondary} />
            </View>
            <View style={styles.navTextGroup}>
              <Text style={styles.navLabel}>視認性の設定</Text>
              <Text style={styles.navDesc}>文字サイズ・色・コントラストを調整</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </Pressable>
        </View>

        {/* ===== 認識言語の選択 ===== */}
        <Text style={styles.sectionLabel}>認識言語</Text>
        <View style={styles.card}>
          {LANGUAGES.map((lang, idx) => (
            <React.Fragment key={lang.code}>
              <Pressable
                style={({ pressed }) => [styles.langRow, pressed && styles.rowPressed]}
                onPress={() => updateSettings({ language: lang.code })}
              >
                <View>
                  <Text style={styles.langLabel}>{lang.label}</Text>
                  <Text style={styles.langNative}>{lang.native}</Text>
                </View>
                {settings.language === lang.code ? (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />
                ) : (
                  <Ionicons name="ellipse-outline" size={22} color={Colors.textMuted} />
                )}
              </Pressable>
              {idx < LANGUAGES.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ===== プライバシーについての説明 ===== */}
        <Text style={styles.sectionLabel}>プライバシーについて</Text>
        <View style={styles.privacyCard}>
          <View style={styles.privacyRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={Colors.success} />
            <View style={styles.privacyText}>
              <Text style={styles.privacyTitle}>ローカルファースト設計</Text>
              <Text style={styles.privacyDesc}>
                字幕の履歴はすべてこのスマホ内にのみ保存されます。
                サーバーには送信されません。
              </Text>
            </View>
          </View>
          <View style={styles.privacyDivider} />
          <View style={styles.privacyRow}>
            <MaterialCommunityIcons name="microphone-outline" size={20} color={Colors.accentSecondary} />
            <View style={styles.privacyText}>
              <Text style={styles.privacyTitle}>音声認識について</Text>
              <Text style={styles.privacyDesc}>
                音声認識にはデバイスのプラットフォーム機能（iOS/Androidの音声認識）を使用します。
                認識データはApple・Googleのサービスを経由します。
              </Text>
            </View>
          </View>
          <View style={styles.privacyDivider} />
          <View style={styles.privacyRow}>
            <Feather name="wifi-off" size={20} color={Colors.textSecondary} />
            <View style={styles.privacyText}>
              <Text style={styles.privacyTitle}>オフライン利用について</Text>
              <Text style={styles.privacyDesc}>
                字幕履歴の閲覧・コピーはオフラインでも利用できます。
                音声認識にはインターネット接続が必要です。
              </Text>
            </View>
          </View>
        </View>

        {/* ===== 音声ソース（Expo Go制限の説明）===== */}
        <Text style={styles.sectionLabel}>音声ソース</Text>
        <View style={styles.privacyCard}>
          <View style={styles.privacyRow}>
            <MaterialCommunityIcons name="microphone-outline" size={20} color={Colors.accent} />
            <View style={styles.privacyText}>
              <Text style={styles.privacyTitle}>マイク入力（現在利用中）</Text>
              <Text style={styles.privacyDesc}>
                周囲の音声をマイクで拾い、リアルタイムで字幕にします。
              </Text>
            </View>
          </View>
          <View style={styles.privacyDivider} />
          <View style={styles.privacyRow}>
            <MaterialCommunityIcons name="cellphone-sound" size={20} color={Colors.textMuted} />
            <View style={styles.privacyText}>
              <Text style={[styles.privacyTitle, { color: Colors.textSecondary }]}>
                内部音声キャプチャ（近日公開）
              </Text>
              <Text style={styles.privacyDesc}>
                {"ポッドキャスト・動画の再生音を直接字幕化する機能。\nカスタムAPKビルド（EAS Build）が必要です。"}
              </Text>
            </View>
          </View>
          <View style={styles.privacyDivider} />
          <View style={styles.privacyRow}>
            <Feather name="radio" size={20} color={Colors.textMuted} />
            <View style={styles.privacyText}>
              <Text style={[styles.privacyTitle, { color: Colors.textSecondary }]}>
                Auracast対応（将来予定）
              </Text>
              <Text style={styles.privacyDesc}>
                {"補聴器・会場音声をBluetooth LE Audioで受信して字幕化。\n専用ハードウェアと開発版アプリが必要です。"}
              </Text>
            </View>
          </View>
        </View>

        {/* ===== アプリ情報 ===== */}
        <Text style={styles.sectionLabel}>アプリについて</Text>
        <View style={styles.card}>
          {/* About 画面へのリンク */}
          <Pressable
            style={({ pressed }) => [styles.navRow, pressed && styles.rowPressed]}
            onPress={() => router.push("/about")}
          >
            <View style={[styles.navIcon, { backgroundColor: "rgba(78, 205, 196, 0.15)" }]}>
              <Ionicons name="heart-outline" size={20} color={Colors.accent} />
            </View>
            <View style={styles.navTextGroup}>
              <Text style={styles.navLabel}>このアプリについて</Text>
              <Text style={styles.navDesc}>コンセプト・機能・今後の予定</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </Pressable>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>バージョン</Text>
            <Text style={styles.infoValue}>1.0.8</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>対象</Text>
            <Text style={styles.infoValue}>音や言葉の壁に直面するすべての人へ</Text>
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

  // ナビゲーション行（履歴・視認性など）
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceHigh,
  },
  navIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  navTextGroup: {
    flex: 1,
  },
  navLabel: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  navDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },

  // 言語選択
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
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

  // プライバシーカード
  privacyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  privacyRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  privacyText: {
    flex: 1,
    gap: 4,
  },
  privacyTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  privacyDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    lineHeight: 18,
  },
  privacyDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },

  // アプリ情報
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
