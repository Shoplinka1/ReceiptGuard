import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { useGetUserProfile } from '@workspace/api-client-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Sparkles, Loader2, AlertTriangle, CreditCard, Receipt, Repeat, ShieldCheck, Mail } from 'lucide-react'
import { toast } from 'sonner'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || ''

async function getAuthToken() {
  const { supabase } = await import('@/lib/supabase')
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

async function apiFetch(path: string, opts?: RequestInit) {
  const token = await getAuthToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as any)?.error ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// Display prices in USD. Backend converts USD → NGN before charging via Paystack.
const MONTHLY_USD = 5.99
const YEARLY_USD  = 59.99
const YEARLY_SAVINGS_PCT = Math.round((1 - YEARLY_USD / (MONTHLY_USD * 12)) * 100)

function fmtUSD(amount: number) {
  return `${amount.toFixed(2)}`
}

const PRO_FEATURES = [
  'Unlimited Gmail accounts',
  'Unlimited receipts & subscriptions',
  'Unlimited warranties',
  'Unlimited reminders',
  'CSV & PDF export',
  'Spending reports & analytics',
  'Advanced filters & categories',
  'Priority support',
]
const FREE_FEATURES = [
  '1 Gmail account',
  'Up to 100 receipts',
  'Up to 10 warranties',
  'Up to 5 active subscriptions',
  'Basic dashboard & reminders',
  'Search',
]

interface UsageData {
  isPro: boolean
  receipts: { used: number; limit: number | null }
  subscriptions: { used: number; limit: number | null }
  warranties: { used: number; limit: number | null }
  gmailAccounts: { used: number; limit: number | null }
}

function UsageBar({ label, used, limit, icon: Icon }: {
  label: string; used: number; limit: number | null; icon: React.ComponentType<{ className?: string }>
}) {
  if (limit === null) return null // Pro — unlimited, no bar needed
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const isNearLimit = pct >= 80
  const isAtLimit   = pct >= 100
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="w-3.5 h-3.5" />
          {label}
        </div>
        <span className={`font-medium tabular-nums ${isAtLimit ? 'text-destructive' : isNearLimit ? 'text-amber-500' : 'text-foreground'}`}>
          {used} / {limit}
        </span>
      </div>
      <Progress
        value={pct}
        className={`h-1.5 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-amber-500' : ''}`}
      />
    </div>
  )
}

export default function BillingPage() {
  const { data: profile, isLoading: loadingProfile, refetch: refetchProfile } = useGetUserProfile()
  const isPro = profile?.plan === 'pro'
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [initError, setInitError] = useState<string | null>(null)
  const qc = useQueryClient()

  // Verify payment when Paystack redirects back with ?ref=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (!ref) return
    window.history.replaceState({}, '', window.location.pathname)
    apiFetch(`/api/paystack/verify/${encodeURIComponent(ref)}`)
      .then((data: any) => {
        if (data?.status === 'success') {
          toast.success('Payment confirmed! Your plan has been upgraded.')
          refetchProfile()
          qc.invalidateQueries({ queryKey: ['payments', 'history'] })
          qc.invalidateQueries({ queryKey: ['user', 'usage'] })
          qc.invalidateQueries({ queryKey: ['sub', 'details'] })
        } else {
          toast.info('Payment is being processed. Your plan will update shortly.')
        }
      })
      .catch(() => toast.error('Could not verify payment. Contact support if your plan is not updated.'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: paymentHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ['payments', 'history'],
    queryFn: () => apiFetch('/api/paystack/payments'),
    retry: false,
  })

  const { data: usage, isLoading: loadingUsage } = useQuery<UsageData>({
    queryKey: ['user', 'usage'],
    queryFn: () => apiFetch('/api/user/usage'),
    retry: false,
  })

  // Fetch active subscription details (period end, cancel status) — Pro only
  const { data: subDetails } = useQuery({
    queryKey: ['sub', 'details'],
    queryFn: () => apiFetch('/api/paystack/subscription'),
    retry: false,
    enabled: isPro,
  })

  const initCheckout = useMutation({
    mutationFn: () => apiFetch('/api/paystack/initialize', {
      method: 'POST',
      body: JSON.stringify({ planId: 'pro', billingCycle, frontendUrl: window.location.origin }),
    }),
    onSuccess: (data: any) => {
      if (data?.authorizationUrl) {
        window.location.href = data.authorizationUrl
      } else {
        toast.error('No checkout URL returned from payment provider.')
      }
    },
    onError: (e: any) => { setInitError(e.message); toast.error(e.message) },
  })

  const cancelSub = useMutation({
    mutationFn: () => apiFetch('/api/paystack/cancel', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Subscription cancelled. You keep Pro until the end of the billing period.')
      refetchProfile()
      qc.invalidateQueries({ queryKey: ['sub', 'details'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  const displayUSD   = billingCycle === 'yearly' ? YEARLY_USD  : MONTHLY_USD
  const displayLabel = billingCycle === 'yearly' ? '/year'     : '/month'

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Plans</h1>
          <p className="text-sm text-muted-foreground">Manage your subscription and payment history.</p>
        </div>

        {/* Current plan hero */}
        <Card className={`border-primary/40 relative overflow-hidden ${isPro ? 'bg-gradient-to-br from-primary/5 to-background' : ''}`}>
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <Sparkles className="w-32 h-32" />
          </div>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            {loadingProfile ? <Skeleton className="h-4 w-48" /> : (
              <CardDescription>
                You are on the <strong className="text-foreground capitalize">{profile?.plan || 'Free'}</strong> plan.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-end gap-2">
              {loadingProfile ? <Skeleton className="h-10 w-32" /> : (
                <>
                  <span className="text-4xl font-bold">
                    {isPro ? fmtUSD(displayUSD) : '$0'}
                  </span>
                  <span className="text-muted-foreground mb-1">{isPro ? displayLabel : '/ month'}</span>
                  {isPro && <Badge className="ml-2 mb-1">Active</Badge>}
                </>
              )}
            </div>

            {/* Subscription renewal info — Pro only */}
            {isPro && subDetails && (
              <div className="text-sm text-muted-foreground space-y-1 mb-2">
                {subDetails.current_period_end && (
                  <p>
                    {subDetails.cancel_at_period_end
                      ? <>Cancelled — access ends <strong className="text-foreground">{new Date(subDetails.current_period_end).toLocaleDateString()}</strong></>
                      : <>Next renewal: <strong className="text-foreground">{new Date(subDetails.current_period_end).toLocaleDateString()}</strong></>}
                  </p>
                )}
              </div>
            )}

            {/* Usage bars — free plan only */}
            {!isPro && (
              <div className="bg-secondary/40 rounded-xl p-4 border border-border space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your usage</p>
                {loadingUsage ? (
                  <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-6 w-full" />)}</div>
                ) : (
                  <>
                    <UsageBar label="Receipts"       used={usage?.receipts.used ?? 0}      limit={usage?.receipts.limit ?? 100}     icon={Receipt}    />
                    <UsageBar label="Subscriptions"  used={usage?.subscriptions.used ?? 0} limit={usage?.subscriptions.limit ?? 5}  icon={Repeat}     />
                    <UsageBar label="Warranties"     used={usage?.warranties.used ?? 0}    limit={usage?.warranties.limit ?? 10}    icon={ShieldCheck} />
                    <UsageBar label="Gmail accounts" used={usage?.gmailAccounts.used ?? 0} limit={usage?.gmailAccounts.limit ?? 1}  icon={Mail}       />
                  </>
                )}
              </div>
            )}

            {!isPro ? (
              <div className="space-y-6">
                {/* Billing cycle toggle */}
                <div className="inline-flex bg-secondary rounded-lg p-1 gap-1">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${billingCycle === 'monthly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${billingCycle === 'yearly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Yearly
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/40 text-primary bg-primary/5">
                      Save {YEARLY_SAVINGS_PCT}%
                    </Badge>
                  </button>
                </div>

                <div className="bg-secondary/50 rounded-xl p-6 border border-border">
                  <h3 className="font-semibold text-lg mb-1">Upgrade to Pro</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {billingCycle === 'yearly'
                      ? `${fmtUSD(YEARLY_USD)}/year · that's ${fmtUSD(parseFloat((YEARLY_USD / 12).toFixed(2)))}/month`
                      : `${fmtUSD(MONTHLY_USD)}/month · billed monthly`}
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                    {PRO_FEATURES.map(ft => (
                      <li key={ft} className="flex items-center gap-2.5 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        <span>{ft}</span>
                      </li>
                    ))}
                  </ul>
                  {initError && (
                    <div className="flex items-center gap-2 mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                      <AlertTriangle className="w-4 h-4 shrink-0" />{initError}
                    </div>
                  )}
                  <Button
                    size="lg"
                    className="w-full sm:w-auto"
                    onClick={() => { setInitError(null); initCheckout.mutate() }}
                    disabled={initCheckout.isPending}
                  >
                    {initCheckout.isPending
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redirecting to checkout…</>
                      : `Upgrade to Pro — ${fmtUSD(displayUSD)}${displayLabel}`}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {!(subDetails as any)?.cancel_at_period_end && (
                  <Button
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => cancelSub.mutate()}
                    disabled={cancelSub.isPending}
                  >
                    {cancelSub.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling…</> : 'Cancel Subscription'}
                  </Button>
                )}
                {(subDetails as any)?.cancel_at_period_end && (
                  <p className="text-sm text-muted-foreground self-center">
                    Your subscription is cancelled and will not renew.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan comparison */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Compare Plans</h2>

          <div className="flex justify-center mb-6">
            <div className="inline-flex bg-secondary rounded-lg p-1 gap-1">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${billingCycle === 'monthly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${billingCycle === 'yearly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Yearly <Badge className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary border-0">Save {YEARLY_SAVINGS_PCT}%</Badge>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Free</CardTitle>
                <p className="text-2xl font-bold">$0 <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {FREE_FEATURES.map(ft => (
                    <li key={ft} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 opacity-40" />{ft}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Pro</CardTitle>
                  <Badge className="text-xs">Recommended</Badge>
                </div>
                {billingCycle === 'yearly' ? (
                  <div>
                    <p className="text-2xl font-bold">{fmtUSD(YEARLY_USD)} <span className="text-sm font-normal text-muted-foreground">/ year</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5">${(YEARLY_USD / 12).toFixed(2)}/month · billed annually</p>
                  </div>
                ) : (
                  <p className="text-2xl font-bold">{fmtUSD(MONTHLY_USD)} <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
                )}
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-4">
                  {PRO_FEATURES.map(ft => (
                    <li key={ft} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-primary" />{ft}
                    </li>
                  ))}
                </ul>
                {!isPro && (
                  <Button size="sm" className="w-full" onClick={() => { setInitError(null); initCheckout.mutate() }} disabled={initCheckout.isPending}>
                    {initCheckout.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Redirecting…</> : 'Upgrade Now'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Payment history */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              <CardTitle>Payment History</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : !(paymentHistory as any[])?.length ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No payment history yet.</p>
            ) : (
              <div className="space-y-1">
                {(paymentHistory as any[]).map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center py-3 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-sm">{p.plan_id ? `ReceiptGuard ${String(p.plan_id).charAt(0).toUpperCase() + String(p.plan_id).slice(1)}` : 'ReceiptGuard'}</p>
                      <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={p.status === 'success' ? 'default' : 'destructive'} className="text-xs capitalize">{p.status}</Badge>
                      <span className="font-mono font-medium text-sm">
                        {fmtUSD(Number(p.amount))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
