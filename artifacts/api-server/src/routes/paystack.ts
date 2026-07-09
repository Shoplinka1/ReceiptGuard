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

// ─── Helper: write a payment status without ever downgrading a terminal
// 'success' row ────────────────────────────────────────────────────────────
// Webhook deliveries can arrive out of order or be retried (e.g. a delayed
// 'failed'/'abandoned' verify-poll racing a webhook 'charge.success' that
// already landed). Since /initialize no longer pre-creates a 'pending' row,
// every write here is a real, final outcome — but writes must still be
// monotonic: once a reference is recorded 'success', nothing may overwrite it.
async function upsertPaymentStatus(row: {
  user_id: string;
  paystack_reference: string;
  amount: number;
  currency: string;
  status: 'success' | 'failed' | 'cancelled';
  plan_id: string | null;
  billing_cycle: string;
  description: string;
  paid_at?: string;
}): Promise<void> {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('payments')
    .select('status')
    .eq('paystack_reference', row.paystack_reference)
    .maybeSingle();

  if (fetchError) {
    console.error('[Paystack] payment status lookup failed:', fetchError.message);
    // Fall through and attempt the upsert anyway — better to risk a duplicate
    // write than to silently drop a real payment outcome.
  }
  if (existing?.status === 'success' && row.status !== 'success') {
    console.warn(`[Paystack] ignoring ${row.status} write for ${row.paystack_reference} — already recorded success`);
    return;
  }

  const { error } = await supabaseAdmin.from('payments').upsert(row, { onConflict: 'paystack_reference' });
  if (error) console.error('[Paystack] payment upsert failed:', error.message);
}

// ─── Helper: extend or create a user subscription period ─────────────────────

async function activateOrRenewSubscription(opts: {
  userId: string;
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  paystackCustomerCode?: string;
  paystackSubscriptionCode?: string;
  paystackPlanCode?: string;
  reference: string;
}): Promise<void> {
  const { userId, planId, billingCycle, paystackCustomerCode, paystackSubscriptionCode, paystackPlanCode, reference } = opts;
  const periodDays = billingCycle === 'yearly' ? 365 : 30;
  const now = new Date();

  // Fetch existing active subscription so we can extend it rather than reset it
  const { data: existing } = await supabaseAdmin
    .from('user_subscriptions')
    .select('current_period_end, status')
    .eq('user_id', userId)
    .maybeSingle();

  // If subscription is still active, extend from current period end
  // to avoid cutting the user short. If it's expired/null, start fresh.
  let periodStart = now;
  let periodEnd: Date;
  if (existing?.status === 'active' && existing.current_period_end) {
    const currentEnd = new Date(existing.current_period_end);
    if (currentEnd > now) {
      periodStart = currentEnd;
    }
  }
  periodEnd = new Date(periodStart.getTime() + periodDays * 24 * 60 * 60 * 1000);

  await supabaseAdmin.from('user_subscriptions').upsert({
    user_id: userId,
    plan_id: planId,
    ...(paystackCustomerCode ? { paystack_customer_id: paystackCustomerCode } : {}),
    ...(paystackSubscriptionCode ? { paystack_subscription_id: paystackSubscriptionCode } : {}),
    ...(paystackPlanCode ? { paystack_plan_code: paystackPlanCode } : {}),
    status: 'active',
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
    cancel_at_period_end: false,
    updated_at: now.toISOString(),
  }, { onConflict: 'user_id' });

  // Ensure profile plan is set to pro
  await supabaseAdmin.from('profiles').update({ plan_id: planId }).eq('id', userId);
}

// ─── Plans ────────────────────────────────────────────────────────────────────

router.get('/api/paystack/plans', async (_req, res): Promise<void> => {
  const { data: plans } = await supabaseAdmin.from('plans').select('*').order('price_monthly');
  res.json(plans ?? []);
});

// ─── Initialize Checkout ──────────────────────────────────────────────────────

router.post('/api/paystack/initialize', requireAuth, async (req, res): Promise<void> => {
  if (!PAYSTACK_SECRET_KEY) {
    res.status(503).json({ error: 'Paystack not configured. Add PAYSTACK_SECRET_KEY to your environment.' });
    return;
  }

  const { planId, billingCycle = 'monthly', frontendUrl } = req.body as { planId: string; billingCycle?: 'monthly' | 'yearly'; frontendUrl?: string };

  let userEmail = '';
  let userName = '';
  try {
    const { data: existingProfile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', req.userId).single();
    if (!existingProfile) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(req.userId);
      if (authError || !authData?.user) {
        console.error('[Paystack] getUserById failed:', authError?.message);
        res.status(404).json({ error: authError?.message ?? 'User account not found' });
        return;
      }
      userEmail = authData.user.email ?? '';
      userName = (authData.user.user_metadata?.full_name as string | undefined) ?? '';
      const { error: upsertError } = await supabaseAdmin.from('profiles').upsert({
        id: req.userId, email: userEmail, full_name: userName, plan_id: 'free',
      }, { onConflict: 'id' });
      if (upsertError) {
        console.error('[Paystack] profile auto-create failed:', upsertError.message);
        res.status(500).json({ error: `Could not create user profile: ${upsertError.message}` });
        return;
      }
    } else {
      userEmail = existingProfile.email;
      userName = existingProfile.full_name ?? '';
    }
  } catch (err: any) {
    console.error('[Paystack] profile lookup/auto-create threw:', err?.message ?? err);
    res.status(500).json({ error: err?.message ?? 'Could not look up user profile' });
    return;
  }

  if (planId === 'free') { res.status(400).json({ error: 'Invalid plan' }); return; }

  const FALLBACK_PRICES: Record<string, { monthly: number; yearly: number; name: string }> = {
    pro: { monthly: 5.99, yearly: 59.99, name: 'Pro' },
  };

  let usdPrice: number;
  let planName: string;
  try {
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
  } catch (err: any) {
    console.error('[Paystack] plan lookup threw:', err?.message ?? err);
    res.status(500).json({ error: err?.message ?? 'Could not look up plan pricing' });
    return;
  }

  const USD_TO_NGN = 1600;
  const amountKobo = Math.round(usdPrice * USD_TO_NGN * 100);

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

  // Root cause of "closing checkout creates a Pending payment": a payment row
  // used to be pre-inserted here, before the user even reached the Paystack
  // page. If they closed the tab, that row sat as 'pending' forever. We now
  // record nothing until we have a real outcome — /verify or the webhook
  // upsert the row with the actual final status (success/failed). If the user
  // just closes the checkout, no event ever fires and nothing is written.
  const authorizationUrl = data?.data?.authorization_url;
  if (!authorizationUrl) {
    console.error('[Paystack] initialize returned no authorization_url:', JSON.stringify(data));
    res.status(502).json({ error: 'Payment provider did not return a checkout URL. Please try again.' });
    return;
  }

  res.json({ authorizationUrl, reference });
});

// ─── Verify Payment (called after Paystack redirect) ─────────────────────────

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
  const txn = data?.data;
  if (!txn) {
    console.error('[Paystack] verify returned no transaction data:', JSON.stringify(data));
    res.status(502).json({ error: 'Payment verification returned no data. Please try again or contact support.' });
    return;
  }

  if (txn.status === 'success') {
    const meta = (txn.metadata ?? {}) as { userId?: string; planId?: string; billingCycle?: string };
    if (!meta.userId || !meta.planId) {
      console.error('[Paystack] verify success payload missing metadata:', JSON.stringify(txn.metadata));
      res.status(502).json({ error: 'Payment succeeded but could not be linked to your account. Contact support with reference ' + reference });
      return;
    }

    const billingCycle = (meta.billingCycle ?? 'monthly') as 'monthly' | 'yearly';

    // No row was pre-created at /initialize anymore, so this is normally an
    // insert; `upsertPaymentStatus` also covers the case where the webhook
    // already recorded this reference first, without ever downgrading it.
    await upsertPaymentStatus({
      user_id: meta.userId,
      paystack_reference: reference as string,
      amount: Number(txn.amount ?? 0) / 100 / 1600,
      currency: 'USD',
      status: 'success',
      plan_id: meta.planId,
      billing_cycle: billingCycle,
      description: `ReceiptGuard ${meta.planId} plan (${billingCycle})`,
      paid_at: new Date().toISOString(),
    });

    // Activate/extend subscription and update profile
    await activateOrRenewSubscription({
      userId: meta.userId,
      planId: meta.planId,
      billingCycle,
      paystackCustomerCode: txn.customer?.customer_code as string | undefined,
      reference: reference as string,
    });

    await supabaseAdmin.from('activity_logs').insert({
      user_id: meta.userId,
      type: 'plan_upgraded',
      description: `Upgraded to ${meta.planId} plan (${billingCycle})`,
      metadata: { reference, planId: meta.planId, billingCycle },
    });
  } else if (txn.status === 'failed' || txn.status === 'abandoned' || txn.status === 'reversed') {
    // Only record an explicit outcome — never a synthetic "pending" row.
    // Paystack's own terminal statuses map directly to ours; 'abandoned'
    // (user closed checkout without paying) is intentionally recorded as
    // 'cancelled' rather than 'failed' per the "no fake pending" requirement.
    const meta = (txn.metadata ?? {}) as { userId?: string; planId?: string; billingCycle?: string };
    if (meta.userId) {
      await upsertPaymentStatus({
        user_id: meta.userId,
        paystack_reference: reference as string,
        amount: Number(txn.amount ?? 0) / 100 / 1600,
        currency: 'USD',
        status: txn.status === 'abandoned' ? 'cancelled' : 'failed',
        plan_id: meta.planId ?? null,
        billing_cycle: meta.billingCycle ?? 'monthly',
        description: `ReceiptGuard checkout ${txn.status}`,
      });
    }
  }

  res.json({ status: txn.status, planId: txn.metadata?.planId });
});

// ─── Webhook ──────────────────────────────────────────────────────────────────

router.post('/api/paystack/webhook', async (req, res): Promise<void> => {
  if (!PAYSTACK_SECRET_KEY) {
    res.status(503).json({ error: 'PAYSTACK_SECRET_KEY not configured' });
    return;
  }

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

  try {
    switch (event.event) {

      // ── Initial payment via checkout ──────────────────────────────────────
      case 'charge.success': {
        const meta = (event.data.metadata ?? {}) as { userId?: string; planId?: string; billingCycle?: string };
        if (!meta.userId || !meta.planId) {
          console.warn('[Paystack] charge.success webhook missing metadata — skipping (may be handled by verify endpoint)', JSON.stringify(meta));
          break;
        }
        const billingCycle = (meta.billingCycle ?? 'monthly') as 'monthly' | 'yearly';

        // No row is pre-created at /initialize anymore. Duplicate webhook
        // deliveries, or a race with /verify, are handled by
        // upsertPaymentStatus's onConflict + monotonic-status guard.
        await upsertPaymentStatus({
          user_id: meta.userId,
          paystack_reference: event.data.reference,
          amount: Number(event.data.amount ?? 0) / 100 / 1600,
          currency: 'USD',
          status: 'success',
          plan_id: meta.planId,
          billing_cycle: billingCycle,
          description: `ReceiptGuard ${meta.planId} plan (${billingCycle})`,
          paid_at: new Date().toISOString(),
        });

        // Activate / extend subscription and upgrade profile
        await activateOrRenewSubscription({
          userId: meta.userId,
          planId: meta.planId,
          billingCycle,
          paystackCustomerCode: event.data.customer?.customer_code,
          reference: event.data.reference,
        });

        await supabaseAdmin.from('activity_logs').insert({
          user_id: meta.userId, type: 'payment_received',
          description: `Payment confirmed: ${event.data.currency} ${(event.data.amount ?? 0) / 100}`,
          metadata: { reference: event.data.reference, planId: meta.planId, billingCycle },
        });
        break;
      }

      // ── Recurring invoice paid (subscription renewal) ─────────────────────
      // Paystack fires this event for every successful recurring charge.
      // This is the primary mechanism for extending the subscription period.
      case 'invoice.payment_succeeded':
      case 'invoice.update': {
        const invoiceData = event.data;
        const custCode = invoiceData.customer?.customer_code;
        if (!custCode) break;

        // Look up user by customer code
        const { data: subRow } = await supabaseAdmin
          .from('user_subscriptions')
          .select('user_id, plan_id')
          .eq('paystack_customer_id', custCode)
          .maybeSingle();

        if (!subRow?.user_id) {
          console.warn('[Paystack] invoice.payment_succeeded — no user found for customer:', custCode);
          break;
        }

        // Determine billing cycle from subscription amount
        const paidAmountNgn = (invoiceData.amount ?? 0) / 100;
        // Yearly if >= 4x monthly NGN equivalent (rough heuristic)
        const billingCycle = paidAmountNgn >= 50_000 ? 'yearly' : 'monthly';

        await activateOrRenewSubscription({
          userId: subRow.user_id,
          planId: subRow.plan_id ?? 'pro',
          billingCycle,
          paystackCustomerCode: custCode,
          reference: invoiceData.transaction?.reference ?? `renewal_${Date.now()}`,
        });

        // Record the payment
        await supabaseAdmin.from('payments').insert({
          user_id: subRow.user_id,
          paystack_reference: invoiceData.transaction?.reference ?? `renewal_${Date.now()}`,
          amount: paidAmountNgn / 1600, // convert NGN back to USD approx
          currency: 'USD',
          status: 'success',
          plan_id: subRow.plan_id ?? 'pro',
          billing_cycle: billingCycle,
          description: `ReceiptGuard Pro renewal (${billingCycle})`,
          paid_at: new Date().toISOString(),
          metadata: { amountNgn: paidAmountNgn, event: event.event },
        }).then(undefined, (e: any) => console.warn('[Paystack] payment insert for renewal failed:', e?.message));

        await supabaseAdmin.from('activity_logs').insert({
          user_id: subRow.user_id, type: 'subscription_renewed',
          description: `Pro subscription renewed (${billingCycle})`,
          metadata: { custCode, event: event.event },
        });
        break;
      }

      // ── Subscription cancelled / disabled ─────────────────────────────────
      case 'subscription.disable': {
        const custCode = event.data.customer?.customer_code;
        if (!custCode) break;

        const { data: subRow } = await supabaseAdmin
          .from('user_subscriptions')
          .select('user_id, id')
          .eq('paystack_customer_id', custCode)
          .maybeSingle();

        if (subRow?.user_id) {
          await supabaseAdmin.from('user_subscriptions')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('paystack_customer_id', custCode);

          await supabaseAdmin.from('profiles').update({ plan_id: 'free' }).eq('id', subRow.user_id);

          await supabaseAdmin.from('activity_logs').insert({
            user_id: subRow.user_id, type: 'subscription_cancelled',
            description: 'Subscription cancelled via Paystack',
            metadata: { custCode },
          });
        }
        break;
      }

      // ── Recurring payment failed ──────────────────────────────────────────
      case 'invoice.payment_failed': {
        const meta2 = (event.data.metadata ?? {}) as { userId?: string };
        const custCode2 = event.data.customer?.customer_code;

        // Resolve user via metadata OR customer code
        let failedUserId = meta2.userId;
        if (!failedUserId && custCode2) {
          const { data: subRow } = await supabaseAdmin
            .from('user_subscriptions')
            .select('user_id')
            .eq('paystack_customer_id', custCode2)
            .maybeSingle();
          failedUserId = subRow?.user_id;
        }

        if (failedUserId) {
          void supabaseAdmin.from('payments').insert({
            user_id: failedUserId,
            paystack_reference: event.data.transaction?.reference ?? `failed_${Date.now()}`,
            amount: (event.data.amount ?? 0) / 100 / 1600,
            currency: 'USD',
            status: 'failed',
            description: 'Subscription renewal payment failed',
            metadata: event.data,
          }).then(undefined, (e: any) => console.warn('[Paystack] failed payment insert error:', e?.message));

          await supabaseAdmin.from('activity_logs').insert({
            user_id: failedUserId, type: 'payment_failed',
            description: 'Subscription renewal payment failed',
            metadata: { custCode: custCode2 },
          });

          // Notify the user in-app
          void supabaseAdmin.from('notifications').insert({
            user_id: failedUserId, type: 'payment_failed',
            title: 'Subscription renewal failed',
            body: 'Your Pro subscription renewal payment failed. Please update your payment method to keep Pro access.',
            is_read: false,
            metadata: { event: event.event },
          }).then(undefined, () => {});
        }
        break;
      }
    }
  } catch (err: any) {
    console.error(`[Paystack] webhook handler error for event "${event.event}", returning 500 for retry:`, err.message);
    res.sendStatus(500);
    return;
  }

  res.sendStatus(200);
});

// ─── Cancel Subscription ──────────────────────────────────────────────────────

router.post('/api/paystack/cancel', requireAuth, async (req, res): Promise<void> => {
  // `.single()` would throw the PGRST116 coercion error when the user has no
  // active subscription (0 rows) instead of hitting the `!sub` 404 below.
  // `.maybeSingle()` fixes that, but its `error` must still be checked —
  // otherwise a real DB failure would be misreported as "no subscription".
  const { data: sub, error: subError } = await supabaseAdmin
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', req.userId)
    .eq('status', 'active')
    .maybeSingle();

  if (subError) {
    console.error('[Paystack] cancel: subscription lookup failed:', subError.message);
    res.status(500).json({ error: 'Failed to look up subscription' });
    return;
  }
  if (!sub) { res.status(404).json({ error: 'No active subscription found' }); return; }

  if (sub.paystack_subscription_id && PAYSTACK_SECRET_KEY) {
    try {
      await paystackRequest('/subscription/disable', {
        method: 'POST',
        body: JSON.stringify({ code: sub.paystack_subscription_id, token: sub.paystack_plan_code }),
      });
    } catch (err: any) {
      console.error('[Paystack] subscription disable failed:', err.message);
    }
  }

  await supabaseAdmin.from('user_subscriptions').update({
    status: 'cancelled',
    cancel_at_period_end: true,
    updated_at: new Date().toISOString(),
  }).eq('id', sub.id);

  await supabaseAdmin.from('activity_logs').insert({
    user_id: req.userId, type: 'subscription_cancelled',
    description: 'Pro subscription cancelled by user',
  });

  res.json({ message: 'Subscription cancelled. You retain Pro access until the end of the billing period.' });
});

router.get('/api/paystack/subscription', requireAuth, async (req, res): Promise<void> => {
  // `.single()` throws "Cannot coerce the result to a single JSON object" for
  // free users who have never subscribed (0 rows). `.maybeSingle()` returns
  // null instead, which is the correct "no subscription yet" response — but
  // its `error` must still be checked so a real DB failure isn't reported
  // as "no subscription".
  const { data, error } = await supabaseAdmin
    .from('user_subscriptions')
    .select('*, plans(*)')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Paystack] subscription lookup failed:', error.message);
    res.status(500).json({ error: 'Failed to look up subscription' });
    return;
  }
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
