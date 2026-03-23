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
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import React, { useCallback, useEffect, useRef, useState } from "react";
import SongPopup, { SongInfo } from "@/components/SongPopup";
import {
  Alert,
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
import { useOverlay } from "@/hooks/useOverlay";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useBluetoothLe } from "@/hooks/useBluetoothLe";

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
  // リアルタイム音量レベル（5バンド、0〜1）
  const [audioLevels, setAudioLevels] = useState<number[]>([0.2, 0.3, 0.25, 0.3, 0.2]);

  // ========== 音声入力モード（マイク / 内部音声） ==========
  // 'mic' = 外部マイク（デフォルト）/ 'internal' = デバイス内部音声（YouTube等）
  const [audioSource, setAudioSource] = useState<'mic' | 'internal'>('mic');

  // ========== 音楽認識の状態 ==========
  const [showMusicPopup, setShowMusicPopup] = useState(false);
  const [songInfo, setSongInfo] = useState<SongInfo | null>(null);
  const [isMusicLoading, setIsMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [musicAudioLevel, setMusicAudioLevel] = useState(0); // 音楽検知用マイク波形レベル

  // ========== 参照 ==========
  const scrollRef = useRef<ScrollView>(null);
  const speechRef = useRef<SpeechRecognizerRef>(null);
  // captionsのrefを保持する（handleSpeechEndのsaveSession呼び出しで使用）
  // functional updateの中でsaveSessionを呼ぶとsetState-in-renderエラーになるため
  const captionsRef = useRef<CaptionEntry[]>([]);
  // 内部音声からの字幕コールバックをrefで保持する（前方参照回避）
  const internalCaptionCallbackRef = useRef<(text: string) => void>(() => {});

  // ========== システムオーバーレイ（他のアプリの上に字幕表示） ==========
  const {
    isSupported: overlaySupported,
    isOverlayActive,
    hasPermission: overlayHasPermission,
    requestPermission: overlayRequestPermission,
    showOverlay,
    hideOverlay,
    updateCaption: overlayUpdateCaption,
    setOpacity: setOverlayOpacity, // 正しい名前で destructure
  } = useOverlay();

  // ========== 内部音声キャプチャ（YouTube等のデバイス内部音声→字幕化） ==========
  // onCaptionはrefを通してhandleResult（後で定義）と接続する
  const {
    isSupported: internalAudioSupported,
    isCapturing: isInternalCapturing,
    startCapture: startInternalCapture,
    stopCapture: stopInternalCapture,
  } = useAudioCapture({
    apiDomain: process.env.EXPO_PUBLIC_DOMAIN,
    language: settings.language,
    targetLanguage: settings.translationEnabled ? settings.targetLanguage : undefined, // 翻訳設定を渡す
    onCaption: useCallback((text: string) => internalCaptionCallbackRef.current(text), []),
    onError: useCallback((err: string) => setError(`内部音声エラー: ${err}`), []),
  });

  // ========== Bluetooth LE Audio (Auracast) ==========
  const {
    isLeAudioSupported,
    openBroadcastAssistant,
  } = useBluetoothLe();

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

  // ========== SongPopupをレンダリングする関数 ==========
  const renderSongPopup = () => (
    <SongPopup
      visible={showMusicPopup}
      song={songInfo}
      isLoading={isMusicLoading}
      errorMessage={musicError}
      audioLevel={musicAudioLevel}
      onClose={() => setShowMusicPopup(false)}
    />
  );

  // ========== アプリ起動時の処理 ==========
  // マイク許可はWebViewのWeb Speech API開始時にAndroidが自動でダイアログを表示する

  // ========== 音量レベルが来たらwaveAnims（波形バー）をリアルタイムで更新する ==========
  useEffect(() => {
    // 5本のバーに対して、入力レベルに基づいた躍動感のある高さを計算する
    audioLevels.forEach((level, i) => {
      if (waveAnims[i] !== undefined) {
        // 音声がない時でもわずかに動かす（Idling効果）
        const base = isListening ? 0.1 : 0.05;
        const target = Math.max(base, level * (0.8 + Math.random() * 0.4));
        waveAnims[i].value = withTiming(target, { 
          duration: 90, 
          easing: Easing.out(Easing.exp) 
        });
      }
    });
  }, [audioLevels, isListening]);

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

  // マイクボタン：録音開始/停止の切り替え（マイクモード / 内部音声モード対応）
  const handleToggle = useCallback(async () => {
    btnScale.value = withSequence(
      withSpring(0.92, { damping: 10, stiffness: 400 }),
      withSpring(1, { damping: 10, stiffness: 400 })
    );
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (isListening) {
      // ===== 停止 =====
      if (audioSource === 'internal') {
        stopInternalCapture();
      } else {
        speechRef.current?.stopListening();
      }
      setIsListening(false);
      setInterimText("");
      setStatusMessage("マイクボタンを押して開始");
    } else {
      // ===== 開始 =====
      setError(null);
      setInterimText("");

      if (audioSource === 'internal') {
        // 内部音声モード：MediaProjectionでデバイス内部の音声を字幕化する
        setStatusMessage("内部音声を字幕化中...");
        const started = await startInternalCapture();
        if (started) {
          setIsListening(true);
        } else {
          setStatusMessage("マイクボタンを押して開始");
        }
      } else {
        // マイクモード：外部マイクで音声を字幕化する
        setStatusMessage("認識中...");

        // AndroidのOSレベルのマイク権限（RECORD_AUDIO）を先にリクエストする
        // これをしないとWebViewのWeb Speech APIが "not-allowed" エラーになる
        if (Platform.OS !== "web") {
          try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== "granted") {
              setError("⚙️ 設定 → アプリ → Expo Go → 権限 → マイク → 許可");
              setStatusMessage("マイクボタンを押して開始");
              return;
            }
          } catch {
            // 権限確認に失敗してもとりあえず続ける
          }
        }

        speechRef.current?.startListening();
      }
    }
  }, [isListening, audioSource, startInternalCapture, stopInternalCapture]);

  // 音声認識開始時の処理
  const handleSpeechStart = useCallback(() => {
    setIsListening(true);
    setStatusMessage("聞いています...");
    setError(null);
  }, []);

  // captionsが変わるたびにrefを同期する
  // これによりhandleSpeechEndでfunctional updateを使わずに最新のcaptionsにアクセスできる
  useEffect(() => {
    captionsRef.current = captions;
  }, [captions]);

  // 音声認識終了時の処理（セッションを自動保存する）
  // 【修正】functional update内でsaveSessionを呼ぶとsetState-in-renderエラーになるため
  // captionsRefを使って現在値を直接参照する
  const handleSpeechEnd = useCallback(() => {
    setIsListening(false);
    setInterimText("");
    setStatusMessage("マイクボタンを押して開始");
    const current = captionsRef.current;
    if (current.length > 0) {
      saveSession(current);
    }
  }, [saveSession]);

  // 音声認識の結果を受け取る
  const handleResult = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      const trimmed = text.trim();
      if (!trimmed) return;

      // ===== 重複検出（強化版）：直近5件のいずれかと完全一致かつ10秒以内ならスキップ =====
      // Web Speech API は同じフレーズを複数回返すことがある（バグ対策）
      // 正規化：空白を統一してから比較する
      const normalized = trimmed.replace(/\s+/g, " ");
      const recent = captionsRef.current.slice(-5);
      const isDuplicate = recent.some((c) => {
        const normalizedC = c.text.replace(/\s+/g, " ");
        const timeDiff = Date.now() - new Date(c.timestamp).getTime();
        return normalizedC === normalized && timeDiff < 10000;
      });
      if (isDuplicate) return;

      // 確定した字幕を追加する
      const entry: CaptionEntry = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        text: trimmed,
        timestamp: new Date().toISOString(),
      };
      setCaptions((prev) => [...prev, entry]);
      setInterimText("");
      // オーバーレイが有効なら最新字幕を更新する
      overlayUpdateCaption(trimmed);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } else {
      // 認識中のテキスト（まだ確定していない）
      setInterimText(text);
    }
  }, [overlayUpdateCaption]);

  // 内部音声コールバックrefをhandleResultに接続する（前方参照回避のため）
  useEffect(() => {
    internalCaptionCallbackRef.current = (text: string) => handleResult(text, true);
  }, [handleResult]);

  // ========== 起動時：オーバーレイ権限が未許可ならダイアログを表示する ==========
  useEffect(() => {
    if (!overlaySupported || overlayHasPermission !== false) return;
    const timer = setTimeout(() => {
      Alert.alert(
        "字幕オーバーレイの権限が必要です",
        "他のアプリ（YouTube等）の上にリアルタイム字幕を表示するには、「他のアプリの上に重ねて表示」の許可が必要です。\n\n今すぐ設定画面を開きますか？",
        [
          { text: "後で", style: "cancel" },
          {
            text: "設定を開く",
            onPress: () => overlayRequestPermission(),
          },
        ]
      );
    }, 2000);
    return () => clearTimeout(timer);
  }, [overlaySupported, overlayHasPermission, overlayRequestPermission]);

  // 【追加】オーバーレイの透明度を同期する
  useEffect(() => {
    if (isOverlayActive) {
      setOverlayOpacity(settings.overlayOpacity);
    }
  }, [settings.overlayOpacity, isOverlayActive, setOverlayOpacity]);


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

  // 音楽認識ボタン：マイクで6秒間音声を録音して曲名を特定する
  const handleMusicSearch = useCallback(async (isSilent = false) => {
    if (!isSilent && Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (!isSilent) setShowMusicPopup(true);
    setIsMusicLoading(true);
    if (!isSilent) {
      setSongInfo(null);
      setMusicError(null);
    }

    // 音声認識が動いている場合は一時停止する（マイクを独占させるため）
    const wasListening = isListening;
    if (wasListening) {
      speechRef.current?.stopListening();
      setIsListening(false);
    }

    let recording: Audio.Recording | null = null;
    try {
      // マイク権限を確認する
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        setMusicError("マイクの使用を許可してください");
        setIsMusicLoading(false);
        return;
      }

      // 録音モードに切り替える（iOS: サイレントモードでも録音できるように）
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // 高品質で録音開始する
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recording = rec;

      // 音量レベルを取得するための設定を行う
      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && status.metering !== undefined) {
          // metering は通常 -160dB(無音) から 0dB(最大) の範囲
          const minDb = -60;
          const level = Math.max(0, (status.metering - minDb) / Math.abs(minDb));
          setMusicAudioLevel(level);
        }
      });

      // 6秒間録音する
      await new Promise<void>((resolve) => setTimeout(resolve, 6000));

      // 録音を停止してファイルを取得する
      recording.setOnRecordingStatusUpdate(null);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      if (!uri) throw new Error("録音ファイルの取得に失敗しました");

      // ファイルをbase64に変換してAPIサーバーに送信する
      // expo-file-system v19 では EncodingType.Base64 の代わりに "base64" 文字列を使用する
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" as any });

      const apiDomain = process.env.EXPO_PUBLIC_DOMAIN;
      const apiUrl = apiDomain
        ? `https://${apiDomain}/api-server/api/recognize`
        : null;

      if (!apiUrl) throw new Error("APIのURLが設定されていません");

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: base64 }),
      });

      // AudD.io のレスポンス型
      // status: "success" | "error"
      // result: 曲が見つかった場合はオブジェクト、見つからない場合は null
      const data = await response.json() as {
        status: "success" | "error";
        result?: {
          title?: string;
          artist?: string;
          album?: string;
          song_link?: string;
          spotify?: {
            id?: string;
            external_urls?: { spotify?: string };
            album?: { images?: Array<{ url: string }> };
          };
          apple_music?: {
            trackId?: number;
            url?: string;
            artwork?: { url?: string };
          };
        } | null;
        error?: { status: number; message: string };
      };

      if (data.status === "error") {
        // 1日の無料上限（10回）に達した場合の案内
        const errMsg = data.error?.message ?? "";
        if (errMsg.includes("limit") || data.error?.status === 901) {
          setMusicError(
            "1日の無料上限（10回）に達しました。\n" +
            "https://dashboard.audd.io/ で無料アカウントを作成すると月500回まで使えます。"
          );
        } else {
          setMusicError(`認識エラー: ${errMsg || "不明なエラー"}`);
        }
      } else if (!data.result) {
        // result が null = 曲が見つからなかった
        if (!isSilent) {
          setMusicError("曲が見つかりませんでした。\nスピーカーに近づけてもう一度試してください。");
        }
      } else {
        const r = data.result;
        // 自動検知で見つかった場合はポップアップを出す
        if (isSilent) {
          setShowMusicPopup(true);
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
        // Spotify のジャケット写真URL（高画質なものを選ぶ）
        const spotifyImages = r.spotify?.album?.images ?? [];
        const coverUrl = spotifyImages.length > 0
          ? spotifyImages[0].url  // 最初の画像が最大サイズ
          : undefined;

        // Spotify トラックID を URL から取り出す
        const spotifyUrl = r.spotify?.external_urls?.spotify ?? "";
        const spotifyIdMatch = spotifyUrl.match(/track\/([A-Za-z0-9]+)/);
        const spotifyId = spotifyIdMatch?.[1] ?? r.spotify?.id;

        setSongInfo({
          title: r.title ?? "不明な曲",
          artist: r.artist ?? "不明なアーティスト",
          album: r.album ?? "",
          coverUrl,
          spotifyId,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMusicError(`エラーが発生しました: ${msg}`);
    } finally {
      setIsMusicLoading(false);
      // 録音が開きっぱなしの場合は閉じる
      if (recording) {
        try { await recording.stopAndUnloadAsync(); } catch {}
      }
      // 音声認識を再開する
      if (wasListening) {
        setTimeout(() => {
          if (speechRef.current) {
            speechRef.current.startListening();
            setIsListening(true);
          }
        }, 500);
      }
    }
  }, [isListening, settings.language]); // handleMusicSearch を削除（自己参照回避）

  // 【追加】自動音楽検知のループ（宣言の後に移動）
  useEffect(() => {
    if (!settings.autoMusicDetection || !isListening || showMusicPopup) return;
    
    const interval = setInterval(() => {
      // 認識中かつ楽曲検索中でなければ実行
      if (isListening && !isMusicLoading) {
        handleMusicSearch(true);
      }
    }, 60000); // 1分おきにチェック
    
    return () => clearInterval(interval);
  }, [settings.autoMusicDetection, isListening, isMusicLoading, showMusicPopup, handleMusicSearch]);

  // 字幕の長押し：その行のテキストをコピーする
  const handleLongPressCaption = useCallback(async (text: string) => {
    await Clipboard.setStringAsync(text);
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  // WebViewから音量レベルを受け取り、波形バーを更新する
  const handleAudioLevel = useCallback((levels: number[]) => {
    setAudioLevels(levels);
  }, []);

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

  // システムオーバーレイのオン/オフ（他のアプリの上に字幕を表示する）
  const handleOverlayToggle = useCallback(async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (isOverlayActive) {
      hideOverlay();
    } else {
      // 現在の最新字幕テキストを初期値として渡す
      const initial = captionsRef.current.length > 0
        ? captionsRef.current[captionsRef.current.length - 1].text
        : "字幕待機中...";
      await showOverlay(initial);
    }
  }, [isOverlayActive, hideOverlay, showOverlay]);

  // ========== 計算値 ==========
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const hasContent = captions.length > 0 || interimText.length > 0;

  // 視認性設定からスタイルを構築する
  // 日本語テキストを正しく表示するためシステムフォント（fontWeight指定）を使用する
  // InterフォントはJapanese glyphsを持たないため文字化けの原因になる
  const captionFontSize = getFontSize();
  const captionFontWeight: "400" | "700" = settings.fontBold ? "700" : "400";
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
          onAudioLevel={handleAudioLevel}
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
                fontWeight: captionFontWeight,
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
        onAudioLevel={handleAudioLevel}
      />

      {/* ===== ヘッダー ===== */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>CaptionBridge</Text>
          <Text style={styles.appSubtitle}>キャプションブリッジ</Text>
        </View>

        {/* ヘッダー右側のボタン群 */}
        <View style={styles.headerRight}>
          {/* 音楽認識ボタン（Shazam風） */}
          <TouchableOpacity
            style={[styles.headerBtn, styles.musicBtn]}
            onPress={() => handleMusicSearch(false)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.musicBtnIcon}>♪</Text>
          </TouchableOpacity>

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
            <Text style={styles.emptyText}>字幕待機中</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.captionScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* 確定した字幕の一覧（長押しでテキストをコピー） */}
            {captions.map((entry) => (
              <TouchableOpacity
                key={entry.id}
                style={styles.captionBubble}
                onLongPress={() => handleLongPressCaption(entry.text)}
                delayLongPress={400}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.captionText,
                    {
                      fontSize: captionFontSize,
                      color: settings.textColor,
                      fontWeight: captionFontWeight,
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
              </TouchableOpacity>
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
                      fontWeight: captionFontWeight,
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

      {/* ===== 入力源インジケーター ===== */}
      <View style={styles.sourceBar}>
        {/* 入力源アイコンとラベル */}
        <View style={styles.sourceLeft}>
          <MaterialCommunityIcons
            name="microphone"
            size={14}
            color={isListening ? Colors.recordingRed : Colors.textMuted}
          />
          <Text style={[styles.sourceText, isListening && styles.sourceTextActive]}>
            {isListening ? "マイクから入力中" : "マイク待機中"}
          </Text>
        </View>
        {/* 録音中インジケーター（赤い点滅ドット）*/}
        {isListening && (
          <View style={styles.sourceRight}>
            <View style={styles.recDot} />
            <Text style={styles.recLabel}>REC</Text>
          </View>
        )}
      </View>

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
                // 高齢者向けに大きなマイクアイコン（52px）
                <MaterialCommunityIcons name="microphone" size={52} color="#fff" />
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

          {/* システムオーバーレイボタン（Android専用・他のアプリの上に字幕表示） */}
          {overlaySupported && (
            <TouchableOpacity
              style={[styles.smallBtn, isOverlayActive && styles.overlayBtnActive]}
              onPress={handleOverlayToggle}
            >
              <MaterialCommunityIcons
                name="picture-in-picture-top-right"
                size={18}
                color={isOverlayActive ? Colors.accent : Colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ===== ステータステキスト ===== */}
      <Text style={styles.statusText}>{statusMessage}</Text>

      {/* ===== 音声入力モード切り替え（Android・内部音声対応時のみ表示） ===== */}
      {internalAudioSupported && (
        <View style={styles.audioSourceToggle}>
          <TouchableOpacity
            style={[
              styles.audioSourceBtn,
              audioSource === 'mic' && styles.audioSourceBtnActive,
            ]}
            onPress={() => {
              if (isListening) return;
              setAudioSource('mic');
            }}
            disabled={isListening}
          >
            <Ionicons
              name="mic-outline"
              size={13}
              color={audioSource === 'mic' ? Colors.accent : Colors.textMuted}
            />
            <Text style={[
              styles.audioSourceLabel,
              audioSource === 'mic' && styles.audioSourceLabelActive,
            ]}>マイク</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.audioSourceBtn,
              audioSource === 'internal' && styles.audioSourceBtnActive,
            ]}
            onPress={() => {
              if (isListening) return;
              setAudioSource('internal');
            }}
            disabled={isListening}
          >
            <MaterialCommunityIcons
              name="cellphone-sound"
              size={13}
              color={audioSource === 'internal' ? Colors.accent : Colors.textMuted}
            />
            <Text style={[
              styles.audioSourceLabel,
              audioSource === 'internal' && styles.audioSourceLabelActive,
            ]}>内部音声</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ===== Auracast 選択ボタン（Android 13+ 対応端末のみ表示） ===== */}
      {isLeAudioSupported && (
        <TouchableOpacity
          style={styles.auracastBar}
          onPress={openBroadcastAssistant}
        >
          <Ionicons name="radio" size={16} color={Colors.accent} />
          <Text style={styles.auracastText}>Auracast 放送を選択する</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </TouchableOpacity>
      )}

      {/* ===== 音楽認識ポップアップ ===== */}
      {renderSongPopup()}
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
    fontFamily: "NotoSansJP_400Regular",
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
  // 音楽認識ボタン（Shazam風に紫にする）
  musicBtn: {
    backgroundColor: "#6B21A8",
    borderColor: "#7C3AED",
  },
  musicBtnIcon: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "bold" as const,
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
    fontFamily: "NotoSansJP_400Regular",
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
    // Noto Sans JP を強制適用（中国語フォントへの誤フォールバックを防ぐ）
    fontFamily: "NotoSansJP_400Regular",
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
    fontFamily: "NotoSansJP_400Regular",
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
  // ===== マイクボタン（高齢者向けに特大サイズ）=====
  micWrapper: {
    width: 130,   // 90→130 に拡大（高齢者が押しやすいように）
    height: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  micGlow: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  micGlowActive: {
    backgroundColor: Colors.recordingGlow,
    shadowColor: Colors.recordingRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 32,    // グロー効果も大きく
    elevation: 16,
  },
  micGlowIdle: {
    backgroundColor: Colors.accentGlow,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 12,
  },
  micPulse: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  micPulseActive: {
    borderWidth: 3,
    borderColor: Colors.recordingRed,
  },
  micPulseIdle: {
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  micBtn: {
    width: 110,   // 72→110 に拡大（特大ボタン）
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  micBtnIdle: {
    backgroundColor: Colors.accent,
  },
  micBtnActive: {
    backgroundColor: Colors.recordingRed,
  },
  // 録音中の波形アニメーション（大きなボタンに合わせてサイズアップ）
  waveContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 50,
  },
  waveBar: {
    width: 6,    // 4→6に太く
    height: 44,  // 28→44に高く
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  statusText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
    paddingBottom: 8,
  },
  // ===== 音声入力モード切り替えトグル =====
  audioSourceToggle: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
    overflow: "hidden",
  },
  audioSourceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  audioSourceBtnActive: {
    backgroundColor: "rgba(78,205,196,0.15)",
  },
  audioSourceLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  audioSourceLabelActive: {
    color: Colors.accent,
    fontWeight: "600",
  },
  // ===== 入力源インジケーターバー =====
  sourceBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 6,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sourceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sourceText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  sourceTextActive: {
    color: Colors.recordingRed,
    fontWeight: "600",
  },
  sourceRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.recordingRed,
  },
  recLabel: {
    fontSize: 11,
    color: Colors.recordingRed,
    fontWeight: "700",
    letterSpacing: 1,
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
    fontFamily: "NotoSansJP_400Regular",
    color: Colors.textSecondary,
  },
  // ===== システムオーバーレイボタン（アクティブ時） =====
  overlayBtnActive: {
    backgroundColor: Colors.accentGlow,
    borderColor: Colors.accent,
  },
  // ===== Auracast バー =====
  auracastBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(78, 205, 196, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(78, 205, 196, 0.2)",
  },
  auracastText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "NotoSansJP_600SemiBold",
    color: Colors.accent,
  },
});
