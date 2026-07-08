/**
 * Paystack Payment Integration
 *
 * Endpoints:
 *   POST /api/paystack/initialize  → create a Paystack checkout session
 *   GET  /api/paystack/verify/:ref → verify a payment after redirect
 *   POST /api/paystack/webhook     → Paystack server-to-server event hook
 *   GET  /api/paystack/plans       → list available plans with pricing
 *   GET  /api/paystack/subscription → get the user's current Paystack subscription
 *   POST /api/paystack/cancel      → cancel the user's subscription
 *
 * Requires env vars: PAYSTACK_SECRET_KEY, PAYSTACK_WEBHOOK_SECRET
 */
import { Router, type IRouter } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router: IRouter = Router();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

async function paystackRequest(path: string, options: RequestInit = {}): Promise<any> {
  if (!PAYSTACK_SECRET_KEY) throw new Error('PAYSTACK_SECRET_KEY not configured');
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
  const json = await res.json() as any;
  if (!res.ok) throw new Error((json as any).message ?? 'Paystack API error');
  return json;
}

// ─── Plans ──────────────────────────────────────────────────────────────────

router.get('/api/paystack/plans', async (_req, res): Promise<void> => {
  const { data: plans } = await supabaseAdmin.from('plans').select('*').order('price_monthly');
  res.json(plans ?? []);
});

// ─── Initialize Checkout ────────────────────────────────────────────────────

router.post('/api/paystack/initialize', requireAuth, async (req, res): Promise<void> => {
  if (!PAYSTACK_SECRET_KEY) {
    res.status(503).json({ error: 'Paystack not configured. Add PAYSTACK_SECRET_KEY to your environment.' });
    return;
  }

  const { planId, billingCycle = 'monthly', frontendUrl } = req.body as { planId: string; billingCycle?: 'monthly' | 'yearly'; frontendUrl?: string };

  // Get the user's profile for their email — auto-create if missing (new Google OAuth users)
  let userEmail = '';
  let userName = '';
  const { data: existingProfile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', req.userId).single();
  if (!existingProfile) {
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(req.userId);
    if (!authData?.user) { res.status(404).json({ error: 'User account not found' }); return; }
    userEmail = authData.user.email ?? '';
    userName = (authData.user.user_metadata?.full_name as string | undefined) ?? '';
    await supabaseAdmin.from('profiles').upsert({
      id: req.userId,
      email: userEmail,
      full_name: userName,
      plan_id: 'free',
    }, { onConflict: 'id' });
  } else {
    userEmail = existingProfile.email;
    userName = existingProfile.full_name ?? '';
  }

  if (planId === 'free') { res.status(400).json({ error: 'Invalid plan' }); return; }

  // Hardcoded fallback prices (USD) — used when DB plans table is unavailable
  const FALLBACK_PRICES: Record<string, { monthly: number; yearly: number; name: string }> = {
    pro: { monthly: 5.99, yearly: 59.99, name: 'Pro' },
  };

  let usdPrice: number;
  let planName: string;
  const { data: plan } = await supabaseAdmin.from('plans').select('*').eq('id', planId).maybeSingle();
  if (plan) {
    usdPrice = billingCycle === 'yearly' ? Number(plan.price_yearly) : Number(plan.price_monthly);
    planName = plan.name;
  } else if (FALLBACK_PRICES[planId]) {
    usdPrice = billingCycle === 'yearly' ? FALLBACK_PRICES[planId].yearly : FALLBACK_PRICES[planId].monthly;
    planName = FALLBACK_PRICES[planId].name;
  } else {
    res.status(400).json({ error: 'Unknown plan' }); return;
  }

  // Convert USD to NGN for Paystack (Nigerian merchant accounts transact in NGN)
  // Rate: approximate mid-market; update periodically for accuracy.
  const USD_TO_NGN = 1600;
  const amountKobo = Math.round(usdPrice * USD_TO_NGN * 100); // NGN kobo

  const reference = `rg_${req.userId.slice(0, 8)}_${Date.now()}`;
  const baseUrl = frontendUrl ?? process.env.FRONTEND_URL ?? 'http://localhost:5173';
  const callbackUrl = `${baseUrl}/billing?ref=${reference}`;

  let data: any;
  try {
    data = await paystackRequest('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: userEmail,
        amount: amountKobo,
        currency: 'NGN',
        reference,
        callback_url: callbackUrl,
        metadata: {
          userId: req.userId,
          planId,
          billingCycle,
          custom_fields: [
            { display_name: 'Plan', variable_name: 'plan', value: planName },
          ],
        },
      }),
    });
  } catch (err: any) {
    console.error('[Paystack] initialize failed:', err.message);
    res.status(502).json({ error: err.message ?? 'Payment provider error. Please try again.' });
    return;
  }

  // Store pending payment record in USD (the currency users see)
  const { error: insertError } = await supabaseAdmin.from('payments').insert({
    user_id: req.userId,
    paystack_reference: reference,
    amount: usdPrice,
    currency: 'USD',
    status: 'pending',
    plan_id: planId,
    billing_cycle: billingCycle,
    description: `ReceiptGuard ${planName} plan (${billingCycle})`,
    metadata: { amountNgn: amountKobo / 100, billingCycle },
  });
  if (insertError) {
    console.error('[Paystack] payments insert failed:', insertError.message);
    // Non-fatal — checkout URL is still valid; log and continue
  }

  res.json({ authorizationUrl: data.data.authorization_url, reference });
});

// ─── Verify Payment ─────────────────────────────────────────────────────────

router.get('/api/paystack/verify/:reference', requireAuth, async (req, res): Promise<void> => {
  if (!PAYSTACK_SECRET_KEY) {
    res.status(503).json({ error: 'Paystack not configured' });
    return;
  }

  const { reference } = req.params;
  let data: any;
  try {
    data = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference as string)}`);
  } catch (err: any) {
    console.error('[Paystack] verify failed:', err.message);
    res.status(502).json({ error: err.message ?? 'Payment verification error. Please try again.' });
    return;
  }
  const txn = data.data;

  if (txn.status === 'success') {
    const meta = txn.metadata as { userId: string; planId: string; billingCycle?: string };
    const isYearly = meta.billingCycle === 'yearly';
    const periodDays = isYearly ? 365 : 30;

    // Update payment record to success
    await supabaseAdmin.from('payments').update({ status: 'success', paid_at: new Date().toISOString() }).eq('paystack_reference', reference);

    // Upgrade user plan
    await supabaseAdmin.from('profiles').update({ plan_id: meta.planId }).eq('id', meta.userId);

    // Upsert user_subscription with correct period end date
    await supabaseAdmin.from('user_subscriptions').upsert({
      user_id: meta.userId,
      plan_id: meta.planId,
      paystack_customer_id: txn.customer?.customer_code,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'user_id' });

    await supabaseAdmin.from('activity_logs').insert({
      user_id: meta.userId,
      type: 'plan_upgraded',
      description: `Upgraded to ${meta.planId} plan (${meta.billingCycle ?? 'monthly'})`,
      metadata: { reference, planId: meta.planId, billingCycle: meta.billingCycle },
    });
  }

  res.json({ status: txn.status, planId: txn.metadata?.planId });
});

// ─── Webhook ────────────────────────────────────────────────────────────────

router.post('/api/paystack/webhook', async (req, res): Promise<void> => {
  // Paystack signs webhook payloads with HMAC-SHA512 using your secret key.
  // Verify using x-paystack-signature header against PAYSTACK_SECRET_KEY.
  if (!PAYSTACK_SECRET_KEY) {
    res.status(503).json({ error: 'PAYSTACK_SECRET_KEY not configured' });
    return;
  }

  // req.body is a Buffer here because app.ts registers express.raw() on this path
  // before express.json(). Paystack signs the raw request bytes, so we must verify
  // against the original body, not a re-serialized object.
  const rawBody: Buffer = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(JSON.stringify(req.body));

  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    res.sendStatus(400);
    return;
  }

  let event: { event: string; data: any };
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    res.sendStatus(400);
    return;
  }

  switch (event.event) {
    case 'charge.success': {
      const meta = event.data.metadata as { userId?: string; planId?: string };
      if (meta?.userId && meta?.planId) {
        await supabaseAdmin.from('profiles').update({ plan_id: meta.planId }).eq('id', meta.userId);
        await supabaseAdmin.from('payments').update({ status: 'success' }).eq('paystack_reference', event.data.reference);
        await supabaseAdmin.from('activity_logs').insert({
          user_id: meta.userId,
          type: 'payment_received',
          description: `Payment confirmed: ${event.data.currency} ${event.data.amount / 100}`,
          metadata: { reference: event.data.reference },
        });
      }
      break;
    }
    case 'subscription.disable': {
      const custCode = event.data.customer?.customer_code;
      if (custCode) {
        await supabaseAdmin.from('user_subscriptions')
          .update({ status: 'cancelled' })
          .eq('paystack_customer_id', custCode);
        await supabaseAdmin.from('profiles')
          .update({ plan_id: 'free' })
          .eq('id', (await supabaseAdmin.from('user_subscriptions').select('user_id').eq('paystack_customer_id', custCode).single()).data?.user_id);
      }
      break;
    }
    case 'invoice.payment_failed': {
      const meta2 = event.data.metadata as { userId?: string };
      if (meta2?.userId) {
        await supabaseAdmin.from('payments').insert({
          user_id: meta2.userId,
          paystack_reference: event.data.transaction?.reference ?? `failed_${Date.now()}`,
          // event.data.amount is in kobo; divide by 100 → NGN (major units)
          amount: (event.data.amount ?? 0) / 100,
          currency: 'NGN',
          status: 'failed',
          description: 'Subscription renewal failed',
          metadata: event.data,
        });
        await supabaseAdmin.from('activity_logs').insert({
          user_id: meta2.userId,
          type: 'payment_failed',
          description: 'Subscription renewal payment failed',
        });
      }
      break;
    }
  }

  res.sendStatus(200);
});

// ─── Cancel Subscription ────────────────────────────────────────────────────

router.post('/api/paystack/cancel', requireAuth, async (req, res): Promise<void> => {
  const { data: sub } = await supabaseAdmin
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', req.userId)
    .eq('status', 'active')
    .single();

  if (!sub) { res.status(404).json({ error: 'No active subscription found' }); return; }

  if (sub.paystack_subscription_id && PAYSTACK_SECRET_KEY) {
    try {
      await paystackRequest(`/subscription/disable`, {
        method: 'POST',
        body: JSON.stringify({ code: sub.paystack_subscription_id, token: sub.paystack_plan_code }),
      });
    } catch (err: any) {
      console.error('[Paystack] subscription disable failed:', err.message);
      // Non-fatal — still mark cancelled locally even if Paystack call fails
    }
  }

  await supabaseAdmin.from('user_subscriptions').update({
    status: 'cancelled',
    cancel_at_period_end: true,
  }).eq('id', sub.id);

  await supabaseAdmin.from('activity_logs').insert({
    user_id: req.userId,
    type: 'subscription_cancelled',
    description: 'Pro subscription cancelled',
  });

  res.json({ message: 'Subscription cancelled. You retain Pro access until the end of the billing period.' });
});

router.get('/api/paystack/subscription', requireAuth, async (req, res): Promise<void> => {
  const { data } = await supabaseAdmin
    .from('user_subscriptions')
    .select('*, plans(*)')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  res.json(data ?? null);
});

router.get('/api/paystack/payments', requireAuth, async (req, res): Promise<void> => {
  const { data } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });

  res.json(data ?? []);
});

export default router;
