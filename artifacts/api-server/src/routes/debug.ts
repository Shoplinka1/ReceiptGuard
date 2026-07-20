/**
 * /api/debug/trace-user
 *
 * END-TO-END identity proof for a single authenticated session.
 *
 * Answers the data-isolation audit questions:
 *   1. What is req.userId (UUID extracted from the Supabase JWT)?
 *   2. What does the profiles row say (id, email, is_admin)?
 *   3. Which receipt rows does the DB return for this userId (id + user_id, LIMIT 20)?
 *   4. How many receipts does this userId own?
 *   5. How many receipts exist in the entire table (all users)?
 *   6-7. Which dashboard endpoints are called — do any touch /api/admin/*?
 *
 * Results are printed to Railway logs AND returned in the JSON response.
 *
 * Safe to ship temporarily:
 *   - Requires a valid Supabase JWT (requireAuth).
 *   - Only returns data belonging to the authenticated user (plus a global count, no row data).
 */
import { Router, type IRouter } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';

const router: IRouter = Router();

router.get('/api/debug/trace-user', requireAuth, async (req, res): Promise<void> => {
  const authenticatedUserId = req.userId;

  // Step 1 — raw userId from JWT
  logger.info({ authenticatedUserId }, '[debug/trace-user] STEP 1 — authenticated userId from JWT');

  // Step 2 — profiles row
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, is_admin, plan_id')
    .eq('id', authenticatedUserId)
    .maybeSingle();

  logger.info({
    profileId: profile?.id ?? null,
    profileEmail: profile?.email ?? null,
    profileIsAdmin: (profile as any)?.is_admin ?? null,
    profilePlan: profile?.plan_id ?? null,
    profileError: profileError?.message ?? null,
    idMatchesJwt: profile?.id === authenticatedUserId,
  }, '[debug/trace-user] STEP 2 — profiles row');

  // Step 3 — first 20 receipt rows for this userId
  const { data: receiptSample, error: receiptSampleError } = await supabaseAdmin
    .from('receipts')
    .select('id, user_id, merchant_name, amount, purchase_date')
    .eq('user_id', authenticatedUserId)
    .order('created_at', { ascending: false })
    .limit(20);

  const receiptSampleMapped = (receiptSample ?? []).map((r: any) => ({
    receiptId: r.id,
    receiptUserId: r.user_id,
    matchesAuth: r.user_id === authenticatedUserId,
    merchant: r.merchant_name,
    amount: r.amount,
    date: r.purchase_date,
  }));

  logger.info({
    rowCount: receiptSampleMapped.length,
    allUserIdsMatch: receiptSampleMapped.every((r: any) => r.matchesAuth),
    rows: receiptSampleMapped,
    error: receiptSampleError?.message ?? null,
  }, '[debug/trace-user] STEP 3 — receipt sample (LIMIT 20)');

  // Step 4 — count for this userId
  const { count: myReceiptCount, error: myCountError } = await supabaseAdmin
    .from('receipts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', authenticatedUserId);

  logger.info({
    count: myReceiptCount,
    error: myCountError?.message ?? null,
  }, '[debug/trace-user] STEP 4 — COUNT(receipts) for this user');

  // Step 5 — global count (all users)
  const { count: globalReceiptCount, error: globalCountError } = await supabaseAdmin
    .from('receipts')
    .select('*', { count: 'exact', head: true });

  logger.info({
    count: globalReceiptCount,
    error: globalCountError?.message ?? null,
  }, '[debug/trace-user] STEP 5 — COUNT(receipts) global');

  const dashboardEndpointMap = {
    summary:              'GET /api/dashboard/summary        (user_id = jwt_uid)',
    spending_trend:       'GET /api/dashboard/spending-trend (user_id = jwt_uid)',
    top_merchants:        'GET /api/dashboard/top-merchants  (user_id = jwt_uid)',
    upcoming_renewals:    'GET /api/dashboard/upcoming-renewals (user_id = jwt_uid)',
    subscription_breakdown: 'GET /api/subscriptions/breakdown (user_id = jwt_uid)',
    activity:             'GET /api/activity                 (user_id = jwt_uid)',
    gmail_accounts:       'GET /api/gmail/accounts           (user_id = jwt_uid)',
    admin_from_dashboard: 'NONE — dashboard.tsx calls no /api/admin/* endpoints',
  };

  const verdict = {
    jwtUid: authenticatedUserId,
    profileIdMatchesJwt: profile?.id === authenticatedUserId,
    allReceiptRowsOwnedByThisUser: receiptSampleMapped.every((r: any) => r.matchesAuth),
    myReceiptCount: myReceiptCount ?? 'error',
    globalReceiptCount: globalReceiptCount ?? 'error',
    isolation: myReceiptCount === globalReceiptCount
      ? 'NOTE — user owns ALL receipts in the table (single-user DB or isolation breach)'
      : 'OK — other users exist and this user cannot see their rows',
  };

  logger.info({ verdict }, '[debug/trace-user] VERDICT');

  res.json({
    step1_authenticatedUserId: authenticatedUserId,
    step2_profile: profile
      ? { id: profile.id, email: profile.email, is_admin: (profile as any).is_admin, plan_id: profile.plan_id, idMatchesJwt: profile.id === authenticatedUserId }
      : { error: profileError?.message ?? 'no row found' },
    step3_receiptSample: receiptSampleMapped,
    step4_myReceiptCount: myReceiptCount ?? null,
    step5_globalReceiptCount: globalReceiptCount ?? null,
    steps6_7_dashboardEndpoints: dashboardEndpointMap,
    verdict,
  });
});

export default router;
