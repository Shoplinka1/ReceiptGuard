import { Router } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import receiptsRouter from "./receipts";
import subscriptionsRouter from "./subscriptions";
import warrantiesRouter from "./warranties";
import renewalsRouter from "./renewals";
import merchantsRouter from "./merchants";
import userRouter from "./user";

const router = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(receiptsRouter);
router.use(subscriptionsRouter);
router.use(warrantiesRouter);
router.use(renewalsRouter);
router.use(merchantsRouter);
router.use(userRouter);

export default router;
