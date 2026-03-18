// ============================================================
// history.tsx
// 役割：過去の字幕セッションを一覧表示する履歴画面
//       セッションをタップで詳細表示、長押しで削除できる
// ============================================================

import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
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
import { Session, useCaptionContext } from "@/contexts/CaptionContext";

// ============================================================
// メインコンポーネント
// ============================================================
export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { sessions, deleteSession } = useCaptionContext();

  // 詳細表示中のセッション（nullの場合は一覧を表示）
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [copied, setCopied] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // ========== セッションの削除確認 ==========
  const handleDelete = (session: Session) => {
    if (Platform.OS === "web") {
      // Web版はconfirmを使用（Alertが使えないため）
      if (confirm("このセッションを削除しますか？")) {
        deleteSession(session.id);
        if (selectedSession?.id === session.id) {
          setSelectedSession(null);
        }
      }
    } else {
      Alert.alert(
        "セッションを削除",
        "このセッションの字幕履歴を削除しますか？",
        [
          { text: "キャンセル", style: "cancel" },
          {
            text: "削除",
            style: "destructive",
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              deleteSession(session.id);
              if (selectedSession?.id === session.id) {
                setSelectedSession(null);
              }
            },
          },
        ]
      );
    }
  };

  // ========== セッション内のテキストをすべてコピー ==========
  const handleCopySession = async (session: Session) => {
    const text = session.captions.map((c) => c.text).join("\n");
    await Clipboard.setStringAsync(text);
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ========== 日時のフォーマット（日本語表示）==========
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ========== セッション詳細画面 ==========
  if (selectedSession) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        {/* 詳細画面ヘッダー */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setSelectedSession(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{formatDate(selectedSession.startedAt)}</Text>
            <Text style={styles.headerSubtitle}>{formatTime(selectedSession.startedAt)}</Text>
          </View>
          {/* コピーボタン */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleCopySession(selectedSession)}
          >
            <Ionicons
              name={copied ? "checkmark-circle" : "copy-outline"}
              size={20}
              color={copied ? Colors.success : Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* 字幕一覧 */}
        <ScrollView
          contentContainerStyle={[styles.detailScroll, { paddingBottom: botPad + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {selectedSession.captions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>字幕がありません</Text>
            </View>
          ) : (
            selectedSession.captions.map((caption, idx) => (
              <View key={caption.id} style={styles.captionRow}>
                {/* 番号 */}
                <Text style={styles.captionIndex}>{idx + 1}</Text>
                <View style={styles.captionContent}>
                  <Text style={styles.captionText}>{caption.text}</Text>
                  <Text style={styles.captionTime}>
                    {new Date(caption.timestamp).toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // ========== セッション一覧画面 ==========
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
        <Text style={styles.headerTitle}>字幕の履歴</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* セッション一覧 */}
      {sessions.length === 0 ? (
        // 履歴が空の時の表示
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="history"
            size={56}
            color={Colors.textMuted}
          />
          <Text style={styles.emptyTitle}>まだ履歴がありません</Text>
          <Text style={styles.emptyDesc}>
            字幕を認識して停止すると{"\n"}自動的に保存されます
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: botPad + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            // 各セッションのカード
            <Pressable
              style={({ pressed }) => [
                styles.sessionCard,
                pressed && styles.sessionCardPressed,
              ]}
              onPress={() => setSelectedSession(item)}
              onLongPress={() => handleDelete(item)}
            >
              {/* 左側：日時情報 */}
              <View style={styles.sessionLeft}>
                <View style={styles.sessionDateBadge}>
                  <Text style={styles.sessionDay}>
                    {new Date(item.startedAt).getDate()}
                  </Text>
                  <Text style={styles.sessionMonth}>
                    {new Date(item.startedAt).toLocaleDateString("ja-JP", { month: "short" })}
                  </Text>
                </View>
              </View>

              {/* 中央：セッション情報 */}
              <View style={styles.sessionMid}>
                <Text style={styles.sessionTime}>{formatTime(item.startedAt)}</Text>
                <Text style={styles.sessionPreview} numberOfLines={2}>
                  {item.captions[0]?.text ?? "（字幕なし）"}
                </Text>
                <Text style={styles.sessionCount}>
                  {item.captions.length}件の字幕
                </Text>
              </View>

              {/* 右側：操作ボタン */}
              <View style={styles.sessionRight}>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="trash-2" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* 使い方のヒント */}
      <View style={[styles.hint, { marginBottom: botPad + 8 }]}>
        <Feather name="info" size={12} color={Colors.textMuted} />
        <Text style={styles.hintText}>長押しでセッションを削除できます</Text>
      </View>
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
  headerCenter: {
    alignItems: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  actionBtn: {
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
  headerSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },

  // 空の状態
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },

  // セッション一覧
  listContent: {
    padding: 16,
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sessionCardPressed: {
    backgroundColor: Colors.surfaceHigh,
  },
  sessionLeft: {
    alignItems: "center",
  },
  sessionDateBadge: {
    width: 48,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  sessionDay: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.accent,
    lineHeight: 24,
  },
  sessionMonth: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  sessionMid: {
    flex: 1,
    gap: 4,
  },
  sessionTime: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  sessionPreview: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 20,
  },
  sessionCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  sessionRight: {
    alignItems: "center",
    gap: 8,
  },
  deleteBtn: {
    padding: 4,
  },
  separator: {
    height: 8,
  },

  // 詳細画面
  detailScroll: {
    padding: 16,
    gap: 10,
  },
  captionRow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  captionIndex: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
    width: 24,
    textAlign: "center",
    marginTop: 4,
  },
  captionContent: {
    flex: 1,
    gap: 4,
  },
  captionText: {
    fontSize: 18,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 26,
  },
  captionTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },

  // ヒントテキスト
  hint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  hintText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
});
