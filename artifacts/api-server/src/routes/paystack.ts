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
const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;

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
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? 'Paystack API error');
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

  const { planId, billingCycle = 'monthly' } = req.body as { planId: string; billingCycle?: 'monthly' | 'yearly' };

  // Get the user's profile for their email
  const { data: profile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', req.userId).single();
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }

  const { data: plan } = await supabaseAdmin.from('plans').select('*').eq('id', planId).single();
  if (!plan || planId === 'free') { res.status(400).json({ error: 'Invalid plan' }); return; }

  const amountKobo = billingCycle === 'yearly'
    ? Math.round(Number(plan.price_yearly) * 100)
    : Math.round(Number(plan.price_monthly) * 100);

  const reference = `rg_${req.userId.slice(0, 8)}_${Date.now()}`;
  const callbackUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/billing?ref=${reference}`;

  const data = await paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: profile.email,
      amount: amountKobo,
      currency: 'USD',
      reference,
      callback_url: callbackUrl,
      metadata: {
        userId: req.userId,
        planId,
        billingCycle,
        custom_fields: [
          { display_name: 'Plan', variable_name: 'plan', value: plan.name },
        ],
      },
    }),
  });

  // Store pending payment record
  await supabaseAdmin.from('payments').insert({
    user_id: req.userId,
    paystack_reference: reference,
    amount: billingCycle === 'yearly' ? Number(plan.price_yearly) : Number(plan.price_monthly),
    currency: 'USD',
    status: 'pending',
    plan_id: planId,
    description: `${plan.name} plan (${billingCycle})`,
  });

  res.json({ authorizationUrl: data.data.authorization_url, reference });
});

// ─── Verify Payment ─────────────────────────────────────────────────────────

router.get('/api/paystack/verify/:reference', requireAuth, async (req, res): Promise<void> => {
  if (!PAYSTACK_SECRET_KEY) {
    res.status(503).json({ error: 'Paystack not configured' });
    return;
  }

  const { reference } = req.params;
  const data = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
  const txn = data.data;

  if (txn.status === 'success') {
    const meta = txn.metadata as { userId: string; planId: string };

    // Update payment record
    await supabaseAdmin.from('payments').update({ status: 'success' }).eq('paystack_reference', reference);

    // Upgrade user plan
    await supabaseAdmin.from('profiles').update({ plan_id: meta.planId }).eq('id', meta.userId);

    // Upsert user_subscription
    await supabaseAdmin.from('user_subscriptions').upsert({
      user_id: meta.userId,
      plan_id: meta.planId,
      paystack_customer_id: txn.customer?.customer_code,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'user_id' });

    await supabaseAdmin.from('activity_logs').insert({
      user_id: meta.userId,
      type: 'plan_upgraded',
      description: `Upgraded to ${meta.planId} plan`,
      metadata: { reference, planId: meta.planId },
    });
  }

  res.json({ status: txn.status, planId: txn.metadata?.planId });
});

// ─── Webhook ────────────────────────────────────────────────────────────────

router.post('/api/paystack/webhook', async (req, res): Promise<void> => {
  // Require webhook secret — fail closed if not configured to prevent forged events
  if (!PAYSTACK_WEBHOOK_SECRET) {
    res.status(503).json({ error: 'Webhook secret not configured' });
    return;
  }
  const hash = crypto.createHmac('sha512', PAYSTACK_WEBHOOK_SECRET).update(JSON.stringify(req.body)).digest('hex');
  if (hash !== req.headers['x-paystack-signature']) {
    res.sendStatus(400);
    return;
  }

  const event = req.body as { event: string; data: any };

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
          amount: (event.data.amount ?? 0) / 100,
          currency: event.data.currency ?? 'USD',
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
    await paystackRequest(`/subscription/disable`, {
      method: 'POST',
      body: JSON.stringify({ code: sub.paystack_subscription_id, token: sub.paystack_plan_code }),
    });
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
