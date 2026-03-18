// ============================================================
// recognize.ts
// 役割：音楽認識APIプロキシ（ACRCloud）
//
// ACRCloudのAPIはHMAC-SHA1署名が必要なため、
// 秘密情報をサーバーサイドで管理しクライアントに露出させない。
//
// 必要な環境変数：
//   ACRCLOUD_HOST        例: identify-ap-southeast-1.acrcloud.com
//   ACRCLOUD_ACCESS_KEY  ACRCloudのアクセスキー
//   ACRCLOUD_ACCESS_SECRET ACRCloudのシークレット
//
// ACRCloudの無料アカウント取得：https://www.acrcloud.com/
// ============================================================

import { Router } from "express";
import { createHmac } from "crypto";

const router = Router();

// ACRCloud APIへのプロキシエンドポイント
router.post("/recognize", async (req, res) => {
  const { audioBase64 } = req.body as { audioBase64: string };

  const host = process.env["ACRCLOUD_HOST"];
  const accessKey = process.env["ACRCLOUD_ACCESS_KEY"];
  const accessSecret = process.env["ACRCLOUD_ACCESS_SECRET"];

  // 認証情報が未設定の場合は設定不完全エラーを返す
  if (!host || !accessKey || !accessSecret) {
    res.status(503).json({
      error: "music_not_configured",
      message: "ACRCloudの認証情報が設定されていません。ACRCLOUD_HOST / ACRCLOUD_ACCESS_KEY / ACRCLOUD_ACCESS_SECRET を環境変数に設定してください。",
    });
    return;
  }

  if (!audioBase64) {
    res.status(400).json({ error: "audio_required", message: "audioBase64が必要です" });
    return;
  }

  // HMAC-SHA1署名を生成する
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const stringToSign = `POST\n/v1/identify\n${accessKey}\naudio\n1\n${timestamp}`;
  const signature = createHmac("sha1", accessSecret)
    .update(stringToSign)
    .digest("base64");

  // base64をバイナリに変換する
  const audioBuffer = Buffer.from(audioBase64, "base64");

  // multipart/form-dataを手動で構築する（Node.js組み込みFetchのFormDataはバイナリ非対応のため）
  const boundary = `----FormBoundary${Date.now().toString(36)}`;

  // テキストフィールドを追加するヘルパー関数
  const textPart = (name: string, value: string): Buffer =>
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    );

  const parts: Buffer[] = [
    textPart("access_key", accessKey),
    textPart("sample_bytes", audioBuffer.length.toString()),
    textPart("timestamp", timestamp),
    textPart("signature", signature),
    textPart("data_type", "audio"),
    textPart("signature_version", "1"),
    // 音声ファイルのパート
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="sample"; filename="audio.m4a"\r\nContent-Type: audio/x-m4a\r\n\r\n`
    ),
    audioBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ];

  const body = Buffer.concat(parts);

  try {
    const response = await fetch(`https://${host}/v1/identify`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length.toString(),
      },
      body,
    });

    const result = await response.json() as Record<string, unknown>;
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      error: "upstream_error",
      message: `ACRCloudへのリクエストに失敗しました: ${message}`,
    });
  }
});

export default router;
