import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetUserProfile } from '@workspace/api-client-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Sparkles, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

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
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  // 204 No Content — no body to parse
  if (res.status === 204) return null
  return res.json()
}

const PRO_FEATURES = [
  'Unlimited Gmail accounts',
  'Unlimited receipts',
  'Unlimited subscriptions',
  'Unlimited reminders',
  'Warranty & return tracking',
  'CSV & PDF export',
  'Spending reports',
  'Advanced filters',
  'Custom categories',
  'Priority support',
]
const FREE_FEATURES = [
  '1 Gmail account',
  'Up to 50 receipts',
  'Up to 5 active subscriptions',
  'Basic dashboard',
  'Basic reminders',
  'Search',
]

export default function BillingPage() {
  const { data: profile, isLoading: loadingProfile, refetch: refetchProfile } = useGetUserProfile()
  const isPro = profile?.plan === 'pro'
  const [initError, setInitError] = useState<string | null>(null)
  const qc = useQueryClient()

  // When Paystack redirects back with ?ref=<reference>, verify the payment
  // so the plan is activated immediately without waiting for a webhook.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (!ref) return

    // Remove the query param from URL without reloading
    const cleanUrl = window.location.pathname
    window.history.replaceState({}, '', cleanUrl)

    apiFetch(`/api/paystack/verify/${encodeURIComponent(ref)}`)
      .then((data) => {
        if (data?.status === 'success') {
          toast.success('Payment confirmed! Your plan has been upgraded.')
          refetchProfile()
          qc.invalidateQueries({ queryKey: ['payments', 'history'] })
        } else {
          toast.info('Payment is being processed. Your plan will update shortly.')
        }
      })
      .catch(() => {
        toast.error('Could not verify payment. Please contact support if your plan is not updated.')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: paymentHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ['payments', 'history'],
    // Backend exposes /api/paystack/payments
    queryFn: () => apiFetch('/api/paystack/payments'),
    retry: false,
  })

  const initCheckout = useMutation({
    mutationFn: () => apiFetch('/api/paystack/initialize', {
      method: 'POST',
      // Backend expects { planId, billingCycle }
      body: JSON.stringify({ planId: 'pro', billingCycle: 'monthly' }),
    }),
    onSuccess: (data) => {
      // Backend returns { authorizationUrl, reference }
      if (data?.authorizationUrl) {
        window.location.href = data.authorizationUrl
      } else {
        toast.error('No checkout URL returned from payment provider.')
      }
    },
    onError: (e: any) => {
      setInitError(e.message)
      toast.error(e.message)
    },
  })

  const cancelSub = useMutation({
    mutationFn: () => apiFetch('/api/paystack/cancel', { method: 'POST' }),
    onSuccess: () => toast.success('Subscription cancelled. You will keep Pro access until the end of your billing period.'),
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Plans</h1>
          <p className="text-sm text-muted-foreground">Manage your subscription and payment history.</p>
        </div>

        {/* Current plan hero */}
        <Card className={`border-primary/50 relative overflow-hidden ${isPro ? 'bg-gradient-to-br from-primary/5 to-background' : ''}`}>
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <Sparkles className="w-24 h-24" />
          </div>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            {loadingProfile ? (
              <Skeleton className="h-4 w-48" />
            ) : (
              <CardDescription>
                You are on the <strong className="text-foreground capitalize">{profile?.plan || 'Free'}</strong> plan.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-end gap-3">
              {loadingProfile ? <Skeleton className="h-10 w-24" /> : (
                <>
                  <span className="text-4xl font-bold">{isPro ? '₦4,999' : '₦0'}</span>
                  <span className="text-muted-foreground mb-1">/ month</span>
                  {isPro && <Badge className="ml-2 mb-1">Active</Badge>}
                </>
              )}
            </div>

            {!isPro ? (
              <div className="bg-secondary/50 rounded-xl p-6 border border-border">
                <h3 className="font-semibold text-lg mb-4">Upgrade to Pro to unlock:</h3>
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
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {initError}
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
                    : 'Upgrade to Pro — ₦4,999/mo'}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => initCheckout.mutate()} disabled={initCheckout.isPending}>
                  Manage Subscription
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => cancelSub.mutate()}
                  disabled={cancelSub.isPending}
                >
                  {cancelSub.isPending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling…</>
                    : 'Cancel Subscription'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Free</CardTitle>
              <p className="text-2xl font-bold">₦0 <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {FREE_FEATURES.map(ft => (
                  <li key={ft} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50" />{ft}
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
              <p className="text-2xl font-bold">₦4,999 <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {PRO_FEATURES.map(ft => (
                  <li key={ft} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-primary" />{ft}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Payment history */}
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : !paymentHistory?.length ? (
              <p className="text-center py-6 text-muted-foreground text-sm">No payment history yet.</p>
            ) : (
              <div className="space-y-1">
                {paymentHistory.map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center py-3 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-sm">{p.plan_id ? `ReceiptGuard ${p.plan_id}` : 'ReceiptGuard'}</p>
                      <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={p.status === 'success' ? 'default' : 'destructive'} className="text-xs capitalize">{p.status}</Badge>
                      <span className="font-medium text-sm">₦{Number(p.amount).toLocaleString()}</span>
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
