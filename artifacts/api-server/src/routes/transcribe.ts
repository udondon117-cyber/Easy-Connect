// ============================================================
// transcribe.ts
// 役割：内部音声→字幕変換エンドポイント
//       デバイス内部の音声（YouTube等）をキャプチャして字幕テキストに変換する
//
// リクエスト形式: POST /api/transcribe
//   { audioPcmBase64: string, sampleRate?: number, language?: string }
//   audioPcmBase64: PCM 16bit モノラル音声をBase64エンコードしたもの
//   sampleRate: サンプリングレート（デフォルト16000Hz）
//   language: 言語コード（デフォルト "ja"）
//
// レスポンス:
//   { text: string }  ← 字幕テキスト
// ============================================================

import { Router } from "express";
import OpenAI, { toFile } from "openai";

const router = Router();

// OpenAI クライアント（Replit AI統合プロキシ使用・APIキー不要）
const openai = new OpenAI({
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "dummy",
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
});

// PCM 16bit モノラルからWAVファイルのBufferを生成するヘルパー関数
function pcm16ToWav(pcmBuffer: Buffer, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);        // PCMフォーマットチャンクサイズ
  header.writeUInt16LE(1, 20);         // PCM = 1
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// 内部音声の文字起こしエンドポイント
router.post("/transcribe", async (req, res) => {
  const {
    audioPcmBase64,
    sampleRate = 16000,
    language = "ja",
    targetLanguage, // 追加: 翻訳先言語コード (例: "en", "zh")
  } = req.body as {
    audioPcmBase64?: string;
    sampleRate?: number;
    language?: string;
    targetLanguage?: string;
  };

  if (!audioPcmBase64) {
    res.status(400).json({
      error: "audio_required",
      message: "audioPcmBase64が必要です",
    });
    return;
  }

  try {
    const pcmBuffer = Buffer.from(audioPcmBase64, "base64");

    // 無音チェック：全バイトがほぼゼロなら文字起こしをスキップする
    const sampleCount = Math.min(1000, Math.floor(pcmBuffer.length / 2));
    let maxAmplitude = 0;
    for (let i = 0; i < sampleCount; i++) {
        const sample = Math.abs(pcmBuffer.readInt16LE(i * 2));
        if (sample > maxAmplitude) maxAmplitude = sample;
    }
    if (maxAmplitude < 150) { // しきい値を少し下げて感度調整
      res.json({ text: "" });
      return;
    }

    const wavBuffer = pcm16ToWav(pcmBuffer, sampleRate);

    const wavFile = await toFile(
        new Blob([wavBuffer], { type: "audio/wav" }),
        "audio.wav",
        { type: "audio/wav" }
    );

    const transcription = await openai.audio.transcriptions.create({
      file: wavFile,
      model: "gpt-4o-mini-transcribe",
      language,
      response_format: "json",
    });

    let text = transcription.text ?? "";

    // 翻訳が有効な場合は実行する
    if (text && targetLanguage && targetLanguage !== language.split("-")[0]) {
      const translation = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional real-time translator. Translate the given text to ${targetLanguage}. Keep only the translated text. Do not add any explanations or notes.`,
          },
          { role: "user", content: text },
        ],
        temperature: 0.3,
      });
      text = translation.choices[0]?.message?.content?.trim() ?? text;
    }

    res.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      error: "transcription_failed",
      message: `文字起こしに失敗しました: ${message}`,
    });
  }
});

export default router;
