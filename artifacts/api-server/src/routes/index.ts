import { Router, type IRouter } from "express";
import healthRouter from "./health";
import recognizeRouter from "./recognize";
import transcribeRouter from "./transcribe";

const router: IRouter = Router();

router.use(healthRouter);
// 音楽認識エンドポイント（AudD.ioプロキシ）
router.use(recognizeRouter);
// 内部音声→字幕変換エンドポイント（OpenAI Whisper使用）
router.use(transcribeRouter);

export default router;
