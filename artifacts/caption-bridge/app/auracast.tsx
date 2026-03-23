// ============================================================
// auracast.tsx
// 役割：Auracast（次世代Bluetooth字幕受信）情報・設定画面
//       Auracast対応ブロードキャスト信号のスキャンと将来の受信機能の基盤
// ============================================================

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

// Auracastソースのデータ型（将来のBLEスキャン結果）
interface AuracastSource {
  id: string;
  name: string;
  rssi: number;
  language: string;
}

export default function AuracastScreen() {
  const insets = useSafeAreaInsets();
  const [isScanning, setIsScanning] = useState(false);
  const [sources, setSources] = useState<AuracastSource[]>([]);
  const [scanDone, setScanDone] = useState(false);

  // Auracastスキャン（現在はデモ実装・将来BLE LE Audioスキャンに置き換え）
  const handleScan = async () => {
    setIsScanning(true);
    setScanDone(false);
    setSources([]);

    // 実際のBLE LE Audioスキャンは今後のアップデートで実装予定
    await new Promise<void>((resolve) => setTimeout(resolve, 3000));

    setIsScanning(false);
    setScanDone(true);
    setSources([]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Auracast</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Auracastとは */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons
              name="bluetooth-audio"
              size={28}
              color={Colors.accent}
            />
            <Text style={styles.cardTitle}>Auracastとは</Text>
          </View>
          <Text style={styles.cardBody}>
            Auracast™はBluetooth LE Audioの新技術で、空港・劇場・病院などの
            公共施設が音声をワイヤレスでブロードキャストする規格です。
          </Text>
          <Text style={[styles.cardBody, { marginTop: 8 }]}>
            CaptionBridgeは、このブロードキャスト信号を受信して
            <Text style={styles.accent}>リアルタイム字幕</Text>として
            画面に表示することを目指しています。
          </Text>
        </View>

        {/* デバイス対応状況 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📱 Pixel 9a の対応状況</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Bluetooth 5.3 ✓</Text>
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>LE Audio（LC3コーデック）✓</Text>
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, styles.statusPending]} />
            <Text style={styles.statusText}>
              Auracast受信：Android API対応待ち
            </Text>
          </View>
          <Text style={styles.note}>
            Pixel 9aはハードウェア的にAuracastに対応しています。
            Androidの公式APIが整い次第、受信機能を実装します。
          </Text>
        </View>

        {/* CaptionBridgeの「橋」の役割 */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🌉 CaptionBridgeが目指す未来</Text>
          <Text style={styles.cardBody}>
            Auracast非対応の古いスマホでも、CaptionBridgeが{"\n"}
            <Text style={styles.accent}>「橋」</Text>
            として機能することで：
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>
              • 駅・空港のアナウンスを字幕で受け取れる
            </Text>
            <Text style={styles.bullet}>
              • 劇場・映画館の音声をリアルタイム字幕で楽しめる
            </Text>
            <Text style={styles.bullet}>
              • 医療機関での説明を画面上でフォローできる
            </Text>
            <Text style={styles.bullet}>
              • 高い最新スマホへの買い替えが不要になる
            </Text>
          </View>
        </View>

        {/* スキャンボタン */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📡 近くのAuracastを探す</Text>
          <Text style={styles.cardBody}>
            Bluetooth LE Audioブロードキャストをスキャンします。
          </Text>

          <TouchableOpacity
            style={[styles.scanBtn, isScanning && styles.scanBtnActive]}
            onPress={handleScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="search" size={18} color="#fff" />
            )}
            <Text style={styles.scanBtnText}>
              {isScanning ? "スキャン中..." : "スキャン開始"}
            </Text>
          </TouchableOpacity>

          {scanDone && sources.length === 0 && (
            <View style={styles.noSourceBox}>
              <MaterialCommunityIcons
                name="bluetooth-off"
                size={32}
                color={Colors.textMuted}
              />
              <Text style={styles.noSourceText}>
                Auracastソースが見つかりませんでした
              </Text>
              <Text style={styles.noSourceSub}>
                周辺にAuracast対応設備がないか、{"\n"}
                まだAndroid APIが対応中の可能性があります
              </Text>
            </View>
          )}

          {sources.map((s) => (
            <View key={s.id} style={styles.sourceRow}>
              <MaterialCommunityIcons
                name="bluetooth-audio"
                size={20}
                color={Colors.accent}
              />
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceName}>{s.name}</Text>
                <Text style={styles.sourceMeta}>
                  {s.language} · RSSI {s.rssi} dBm
                </Text>
              </View>
              <TouchableOpacity style={styles.connectBtn}>
                <Text style={styles.connectBtnText}>接続</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* ロードマップ */}
        <View style={[styles.card, { marginBottom: 32 }]}>
          <Text style={styles.sectionTitle}>🗺️ 実装ロードマップ</Text>
          <View style={styles.roadmapItem}>
            <Text style={styles.roadmapDone}>✅ v1.0 </Text>
            <Text style={styles.roadmapText}>マイク音声のリアルタイム字幕</Text>
          </View>
          <View style={styles.roadmapItem}>
            <Text style={styles.roadmapDone}>✅ v1.1 </Text>
            <Text style={styles.roadmapText}>内部音声（YouTube等）の字幕化</Text>
          </View>
          <View style={styles.roadmapItem}>
            <Text style={styles.roadmapPending}>🔜 v1.2 </Text>
            <Text style={styles.roadmapText}>Auracastブロードキャストのスキャン</Text>
          </View>
          <View style={styles.roadmapItem}>
            <Text style={styles.roadmapPending}>🔜 v2.0 </Text>
            <Text style={styles.roadmapText}>Auracast音声の完全受信と字幕化</Text>
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
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "NotoSansJP_700Bold",
    color: Colors.text,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: "NotoSansJP_700Bold",
    color: Colors.text,
  },
  cardBody: {
    fontSize: 14,
    fontFamily: "NotoSansJP_400Regular",
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  accent: {
    color: Colors.accent,
    fontFamily: "NotoSansJP_700Bold",
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "NotoSansJP_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  statusPending: {
    backgroundColor: "#f59e0b",
  },
  statusText: {
    fontSize: 14,
    fontFamily: "NotoSansJP_400Regular",
    color: Colors.textSecondary,
  },
  note: {
    fontSize: 12,
    fontFamily: "NotoSansJP_400Regular",
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  bulletList: { gap: 6, paddingLeft: 4 },
  bullet: {
    fontSize: 14,
    fontFamily: "NotoSansJP_400Regular",
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  scanBtnActive: {
    opacity: 0.7,
  },
  scanBtnText: {
    fontSize: 15,
    fontFamily: "NotoSansJP_700Bold",
    color: "#fff",
  },
  noSourceBox: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  noSourceText: {
    fontSize: 14,
    fontFamily: "NotoSansJP_700Bold",
    color: Colors.textMuted,
  },
  noSourceSub: {
    fontSize: 12,
    fontFamily: "NotoSansJP_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sourceInfo: { flex: 1 },
  sourceName: {
    fontSize: 14,
    fontFamily: "NotoSansJP_700Bold",
    color: Colors.text,
  },
  sourceMeta: {
    fontSize: 12,
    fontFamily: "NotoSansJP_400Regular",
    color: Colors.textMuted,
  },
  connectBtn: {
    backgroundColor: Colors.accentGlow,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  connectBtnText: {
    fontSize: 13,
    fontFamily: "NotoSansJP_700Bold",
    color: Colors.accent,
  },
  roadmapItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  roadmapDone: {
    fontSize: 13,
    fontFamily: "NotoSansJP_700Bold",
    color: Colors.success,
    minWidth: 56,
  },
  roadmapPending: {
    fontSize: 13,
    fontFamily: "NotoSansJP_700Bold",
    color: Colors.textMuted,
    minWidth: 56,
  },
  roadmapText: {
    fontSize: 13,
    fontFamily: "NotoSansJP_400Regular",
    color: Colors.textSecondary,
    flex: 1,
  },
});
