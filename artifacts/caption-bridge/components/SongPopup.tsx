// ============================================================
// SongPopup.tsx
// 役割：音楽認識結果を表示するポップアップ
//
// 機能：
//   - ジャケット写真・曲名・アーティスト名を表示
//   - Spotify・Apple Music・YouTube Music へのディープリンク
//   - タップして各音楽アプリで曲を開く
// ============================================================

import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Colors from "@/constants/colors";

// 認識済み楽曲の情報
export interface SongInfo {
  title: string;          // 曲名
  artist: string;         // アーティスト名
  album: string;          // アルバム名
  coverUrl?: string;      // ジャケット写真URL
  spotifyId?: string;     // SpotifyトラックID
  youtubeVideoId?: string; // YouTube動画ID
  appleMusicId?: string;  // Apple MusicトラックID
}

interface Props {
  visible: boolean;
  song: SongInfo | null;
  isLoading: boolean;
  errorMessage: string | null;
  onClose: () => void;
}

// 音楽アプリへのディープリンクを開くヘルパー
async function openMusicApp(type: "spotify" | "apple" | "youtube", song: SongInfo) {
  if (Platform.OS !== "web") {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const query = encodeURIComponent(`${song.title} ${song.artist}`);

  if (type === "spotify") {
    const spotifyDeep = song.spotifyId
      ? `spotify:track:${song.spotifyId}`
      : `spotify:search:${query}`;
    const spotifyWeb = song.spotifyId
      ? `https://open.spotify.com/track/${song.spotifyId}`
      : `https://open.spotify.com/search/${query}`;
    const canOpen = await Linking.canOpenURL(spotifyDeep);
    await Linking.openURL(canOpen ? spotifyDeep : spotifyWeb);
  } else if (type === "apple") {
    const appleUrl = `https://music.apple.com/search?term=${query}`;
    await Linking.openURL(appleUrl);
  } else if (type === "youtube") {
    const ytQuery = encodeURIComponent(`${song.title} ${song.artist}`);
    const ytMusicUrl = `https://music.youtube.com/search?q=${ytQuery}`;
    const ytDeep = `vnd.youtube.music://search/${ytQuery}`;
    const canOpen = await Linking.canOpenURL(ytDeep);
    await Linking.openURL(canOpen ? ytDeep : ytMusicUrl);
  }
}

export default function SongPopup({ visible, song, isLoading, errorMessage, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* 半透明の背景 */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* ポップアップカード（タップが貫通しないように別Pressableで止める） */}
        <Pressable style={styles.card} onPress={() => {}}>

          {/* ===== ローディング状態 ===== */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <View style={styles.scanRing}>
                <ActivityIndicator size="large" color={Colors.accent} />
              </View>
              <Text style={styles.loadingTitle}>音楽を認識中...</Text>
              <Text style={styles.loadingSubtitle}>6秒間マイクで音を拾っています</Text>
            </View>
          )}

          {/* ===== エラー状態 ===== */}
          {!isLoading && errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorEmoji}>🎵</Text>
              <Text style={styles.errorTitle}>曲が見つかりませんでした</Text>
              <Text style={styles.errorDetail}>{errorMessage}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>閉じる</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ===== 認識成功 ===== */}
          {!isLoading && !errorMessage && song && (
            <View style={styles.resultContainer}>
              {/* ジャケット写真 */}
              {song.coverUrl ? (
                <Image source={{ uri: song.coverUrl }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder]}>
                  <Text style={styles.coverPlaceholderText}>🎵</Text>
                </View>
              )}

              {/* 曲名・アーティスト名 */}
              <View style={styles.songInfo}>
                <Text style={styles.songTitle} numberOfLines={2}>{song.title}</Text>
                <Text style={styles.artistName} numberOfLines={1}>{song.artist}</Text>
                {song.album ? (
                  <Text style={styles.albumName} numberOfLines={1}>{song.album}</Text>
                ) : null}
              </View>

              {/* 音楽アプリへのリンクボタン */}
              <Text style={styles.openLabel}>アプリで聴く</Text>
              <View style={styles.musicApps}>
                {/* Spotify */}
                <TouchableOpacity
                  style={[styles.appBtn, styles.spotifyBtn]}
                  onPress={() => openMusicApp("spotify", song)}
                >
                  <Text style={styles.appBtnText}>🟢 Spotify</Text>
                </TouchableOpacity>

                {/* Apple Music */}
                <TouchableOpacity
                  style={[styles.appBtn, styles.appleMusicBtn]}
                  onPress={() => openMusicApp("apple", song)}
                >
                  <Text style={styles.appBtnText}>🎵 Apple Music</Text>
                </TouchableOpacity>

                {/* YouTube Music */}
                <TouchableOpacity
                  style={[styles.appBtn, styles.ytMusicBtn]}
                  onPress={() => openMusicApp("youtube", song)}
                >
                  <Text style={styles.appBtnText}>▶ YouTube Music</Text>
                </TouchableOpacity>
              </View>

              {/* 閉じるボタン */}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>閉じる</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#1A1A2E",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(78, 205, 196, 0.2)",
    // シャドウ（iOS）
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    // 影（Android）
    elevation: 20,
  },

  // ローディング
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 12,
  },
  scanRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
  },

  // エラー
  errorContainer: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  errorEmoji: {
    fontSize: 48,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  errorDetail: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
  },

  // 認識成功
  resultContainer: {
    alignItems: "center",
    gap: 12,
  },
  cover: {
    width: 160,
    height: 160,
    borderRadius: 16,
    backgroundColor: "#333",
  },
  coverPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  coverPlaceholderText: {
    fontSize: 64,
  },
  songInfo: {
    alignItems: "center",
    gap: 4,
  },
  songTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  artistName: {
    fontSize: 16,
    color: Colors.accent,
    textAlign: "center",
  },
  albumName: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
  },

  // 音楽アプリボタン
  openLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  musicApps: {
    width: "100%",
    gap: 8,
  },
  appBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  spotifyBtn: {
    backgroundColor: "#1DB954",
  },
  appleMusicBtn: {
    backgroundColor: "#FC3C44",
  },
  ytMusicBtn: {
    backgroundColor: "#FF0000",
  },
  appBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  // 閉じるボタン
  closeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
  },
  closeBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
