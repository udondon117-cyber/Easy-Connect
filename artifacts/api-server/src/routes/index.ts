import { Router, type IRouter } from "express";
import healthRouter from "./health";
import recognizeRouter from "./recognize";

const router: IRouter = Router();

router.use(healthRouter);
// 音楽認識エンドポイント（ACRCloudプロキシ）
router.use(recognizeRouter);

export default router;
