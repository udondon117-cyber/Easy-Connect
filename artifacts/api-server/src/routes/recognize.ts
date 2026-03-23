// ============================================================
// recognize.ts
// 役割：音楽認識APIプロキシ（AudD.io）
//
// AudD.io はHMAC署名不要・登録なしで1日10回まで無料で動く。
// 本格利用は https://dashboard.audd.io/ で無料アカウント取得（月500回）。
//
// オプション環境変数：
//   AUDD_API_TOKEN  未設定でも動く（1日10回の無料制限あり）
//
// リクエスト形式: POST /api/recognize
//   { audioBase64: string }  ← m4a を base64 エンコードした文字列
//
// レスポンス（AudD.io そのまま）:
//   { status: "success", result: { title, artist, album, spotify, apple_music, ... } }
//   { status: "success", result: null }  ← 曲が見つからなかった場合
//   { status: "error", error: { status: number, message: string } }
// ============================================================

import { Router } from "express";

const router = Router();

// AudD.io 音楽認識プロキシ
router.post("/recognize", async (req, res) => {
  const { audioBase64 } = req.body as { audioBase64?: string };

  if (!audioBase64) {
    res.status(400).json({ error: "audio_required", message: "audioBase64が必要です" });
    return;
  }

  // APIトークンは省略可能（未設定でも1日10回まで動く）
  const apiToken = process.env["AUDD_API_TOKEN"];

  // base64 をバイナリに変換する
  const audioBuffer = Buffer.from(audioBase64, "base64");

  // multipart/form-data を手動で構築する
  const boundary = `----AuddBoundary${Date.now().toString(36)}`;

  const textPart = (name: string, value: string): Buffer =>
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    );

  const parts: Buffer[] = [
    // APIトークンがある場合のみ追加する
    ...(apiToken ? [textPart("api_token", apiToken)] : []),
    // Spotify・Apple Music の情報も返してもらう（ジャケット写真URLのため）
    textPart("return", "apple_music,spotify"),
    // 音声ファイル（m4a）
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="audio.m4a"\r\nContent-Type: audio/x-m4a\r\n\r\n`
    ),
    audioBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ];

  const body = Buffer.concat(parts);

  try {
    const response = await fetch("https://api.audd.io/", {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length.toString(),
      },
      body,
    });

    if (!response.ok) {
      res.status(502).json({
        error: "upstream_error",
        message: `AudD.ioへのリクエストが失敗しました（HTTP ${response.status}）`,
      });
      return;
    }

    const result = await response.json() as Record<string, unknown>;
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      error: "network_error",
      message: `AudD.ioへの接続に失敗しました: ${message}`,
    });
  }
});

export default router;
