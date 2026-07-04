import { Router } from 'express';
import healthRouter from './health';
import dashboardRouter from './dashboard';
import receiptsRouter from './receipts';
import subscriptionsRouter from './subscriptions';
import warrantiesRouter from './warranties';
import renewalsRouter from './renewals';
import merchantsRouter from './merchants';
import userRouter from './user';
import gmailRouter from './gmail';
import paystackRouter from './paystack';
import adminRouter from './admin';
import feedbackRouter from './feedback';

const router = Router();

// Public
router.use(healthRouter);

// Paystack webhook must use raw body — registered before auth middleware
router.use(paystackRouter);

// Gmail callback is public (handles OAuth redirect) — rest of gmail routes use requireAuth internally
router.use(gmailRouter);

// Data routes (each applies requireAuth internally or via middleware)
router.use(dashboardRouter);
router.use(receiptsRouter);
router.use(subscriptionsRouter);
router.use(warrantiesRouter);
router.use(renewalsRouter);
router.use(merchantsRouter);
router.use(userRouter);
router.use(feedbackRouter);
router.use(adminRouter);

export default router;
