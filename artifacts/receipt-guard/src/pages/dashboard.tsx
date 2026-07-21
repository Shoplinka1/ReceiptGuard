import React from "react"
import { Link } from "wouter"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  useGetDashboardSummary, useGetSpendingTrend,
  useGetTopMerchants, useGetUpcomingRenewals, useGetSubscriptionBreakdown,
  useGetUserSettings, useListReceipts,
} from "@workspace/api-client-react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell,
} from "recharts"
import {
  ShoppingBag, Repeat, ShieldCheck, RotateCcw,
  Building2, Calendar, TrendingUp, Sparkles, CheckCircle2,
  AlertTriangle, Crown, Info, ArrowRight,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { formatCurrency, convertByCurrency } from "@/lib/currency"
import { useTranslation } from "@/lib/i18n"
import { MerchantLogo } from "@/components/ui/merchant-logo"
import { format, differenceInDays } from "date-fns"

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || ''

async function getAuthToken() {
  const { supabase } = await import('@/lib/supabase')
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

async function fetchSubscription() {
  const token = await getAuthToken()
  const res = await fetch(`${API_BASE}/api/paystack/subscription`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  return res.json()
}

async function fetchExchangeRates() {
  const token = await getAuthToken()
  const res = await fetch(`${API_BASE}/api/exchange-rates`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return { rates: {}, stale: true }
  return res.json() as Promise<{ base: string; rates: Record<string, number>; stale: boolean; updatedAt: string | null }>
}

async function fetchWarranties() {
  const token = await getAuthToken()
  const res = await fetch(`${API_BASE}/api/warranties`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : (data?.items ?? data?.warranties ?? [])
}

async function fetchOpenReturns() {
  const token = await getAuthToken()
  const res = await fetch(`${API_BASE}/api/returns?status=open`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

function toSafeArray<T>(value: unknown, fieldName: string): T[] {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) return value as T[]
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of ['data', fieldName, 'items', 'results', 'activities', 'renewals', 'merchants']) {
      if (Array.isArray(obj[key])) return obj[key] as T[]
    }
  }
  return []
}

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary()
  const { data: trends, isLoading: loadingTrends } = useGetSpendingTrend()
  const { data: merchants, isLoading: loadingMerchants } = useGetTopMerchants()
  const { data: renewals, isLoading: loadingRenewals } = useGetUpcomingRenewals()
  const { data: breakdown, isLoading: loadingBreakdown } = useGetSubscriptionBreakdown()
  const { data: recentPurchasesData, isLoading: loadingPurchases } = useListReceipts({ search: '' })
  const { data: subscription, isLoading: loadingSubscription } = useQuery({ queryKey: ['paystack', 'subscription'], queryFn: fetchSubscription, retry: false })
  const { data: warrantiesData } = useQuery({ queryKey: ['warranties-dashboard'], queryFn: fetchWarranties, retry: false })
  const { data: openReturnsData } = useQuery({ queryKey: ['returns-dashboard'], queryFn: fetchOpenReturns, retry: false })
  const { data: userSettings } = useGetUserSettings()
  const { data: fxData } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: fetchExchangeRates,
    staleTime: 60 * 60 * 1000,
    retry: false,
  })

  const { t, locale } = useTranslation()
  const currency = userSettings?.currency || 'USD'
  const rates = fxData?.rates ?? {}
  const ratesStale = fxData?.stale ?? true
  const ratesAvailable = !ratesStale && Object.keys(rates).length > 0

  const rawSummary = summary as any
  const monthlySubTotal = rawSummary?.subscriptionsMonthlyTotal ?? 0
  const openReturnsCount = rawSummary?.openReturnsCount ?? 0

  const safeRenewals    = toSafeArray<any>(renewals,    'renewals')
  const safeMerchants   = toSafeArray<any>(merchants,   'merchants')
  const safeCategoryBreakdown = toSafeArray<any>(breakdown?.categoryBreakdown, 'breakdown.categoryBreakdown')
  const safeTrends      = toSafeArray<any>(trends, 'trends')
  const recentPurchases = (recentPurchasesData?.items ?? []).slice(0, 5)

  // Returns with deadline within 7 days
  const today = new Date()
  const urgentReturns = (openReturnsData as any[] ?? [])
    .filter((r: any) => {
      if (!r.returnDeadline) return false
      const dl = new Date(r.returnDeadline)
      const daysLeft = differenceInDays(dl, today)
      return daysLeft >= 0 && daysLeft <= 7
    })
    .slice(0, 4)

  // Warranties expiring in next 60 days
  const expiringWarranties = (warrantiesData as any[] ?? [])
    .filter((w: any) => {
      if (!w.warranty_end_date && !w.warrantyEndDate) return false
      const endDate = new Date(w.warranty_end_date ?? w.warrantyEndDate)
      const daysLeft = differenceInDays(endDate, today)
      return daysLeft >= 0 && daysLeft <= 60
    })
    .slice(0, 4)

  const COLORS = ['var(--chart-1)','var(--chart-2)','var(--chart-3)','var(--chart-4)','var(--chart-5)']
  const fmt = (v: number) => formatCurrency(v, currency, locale)

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Currency notice */}
        {!ratesStale && ratesAvailable && currency !== 'USD' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>{t('dash_converted_note', { currency })}</span>
          </div>
        )}
        {ratesStale && currency !== 'USD' && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{t('dash_rate_unavailable')}</span>
          </div>
        )}

        {/* Header */}
        <header className="flex justify-between items-end pb-4 border-b border-border">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">
              {t('dash_welcome')} {loadingSummary
                ? <Skeleton className="inline-block h-8 w-32 align-bottom" />
                : (summary?.firstName || 'there')}
            </h1>
            <p className="text-muted-foreground">Your purchase vault at a glance.</p>
          </div>
          {summary?.plan === "free" && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
              {t('dash_free_plan')}
            </Badge>
          )}
        </header>

        {/* Plan Card */}
        <PlanCard plan={summary?.plan} subscription={subscription} loading={loadingSummary || loadingSubscription} t={t} />

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Purchases"
            value={summary ? (summary.validReceiptCount ?? 0) : null}
            loading={loadingSummary}
            icon={ShoppingBag}
            href="/purchases"
          />
          <StatCard
            title="Active Subscriptions"
            value={summary?.activeSubscriptions}
            loading={loadingSummary}
            icon={Repeat}
            href="/subscriptions"
          />
          <StatCard
            title="Active Warranties"
            value={summary?.activeWarranties}
            loading={loadingSummary}
            icon={ShieldCheck}
            href="/warranties"
          />
          <StatCard
            title="Open Returns"
            value={loadingSummary ? null : openReturnsCount}
            loading={loadingSummary}
            icon={RotateCcw}
            href="/returns"
            accent={openReturnsCount > 0}
          />
        </div>

        {/* Monthly Subscription Cost — feature card */}
        {(loadingSummary || monthlySubTotal > 0) && (
          <Card className="bg-gradient-to-br from-primary/8 via-primary/4 to-transparent border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Monthly Subscription Cost</p>
                  {loadingSummary ? (
                    <Skeleton className="h-10 w-32" />
                  ) : (
                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl font-bold tracking-tight">{fmt(monthlySubTotal)}</span>
                      <span className="text-muted-foreground text-sm">/mo</span>
                      <span className="text-muted-foreground text-sm hidden sm:inline">
                        · {fmt(monthlySubTotal * 12)}/yr
                      </span>
                    </div>
                  )}
                </div>
                <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="w-5 h-5" />
                  <Link href="/subscriptions">
                    <Button variant="outline" size="sm">View all</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main grid: Upcoming Renewals + Recent Purchases */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Renewals */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> {t('dash_upcoming_renewals')}
                </CardTitle>
                <Link href="/subscriptions">
                  <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground">
                    View all <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loadingRenewals ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="w-full h-10" />)}</div>
              ) : safeRenewals.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
                  <Calendar className="w-8 h-8 opacity-20" />
                  <p className="text-sm text-center">{t('dash_no_renewals')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {safeRenewals.slice(0, 5).map((renewal: any) => (
                    <div key={renewal.id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-3">
                        <MerchantLogo name={renewal.companyName || null} size="xs" />
                        <div>
                          <p className="font-medium text-foreground">{renewal.companyName || t('subs_unknown')}</p>
                          <p className="text-xs text-muted-foreground">
                            {renewal.daysUntilRenewal === 0
                              ? t('dash_today')
                              : t('dash_in_days', { n: renewal.daysUntilRenewal, s: renewal.daysUntilRenewal === 1 ? '' : 's' })}
                          </p>
                        </div>
                      </div>
                      <div className="font-medium text-foreground shrink-0">{fmt(renewal.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Purchases */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" /> Recent Purchases
                </CardTitle>
                <Link href="/purchases">
                  <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground">
                    View all <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPurchases ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="w-full h-10" />)}</div>
              ) : recentPurchases.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
                  <ShoppingBag className="w-8 h-8 opacity-20" />
                  <p className="text-sm text-center">No purchases yet.</p>
                  <Link href="/purchases">
                    <Button size="sm" variant="outline" className="mt-1">Add first purchase</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentPurchases.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center text-xs font-bold shrink-0">
                          {(p.merchantName ?? '?').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground truncate max-w-[140px]">{p.merchantName}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.purchaseDate ? format(new Date(p.purchaseDate), 'MMM d') : '—'}
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold shrink-0">{formatCurrency(p.amount ?? 0, p.currency || 'USD')}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Return Windows Closing */}
        {urgentReturns.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-blue-500" /> Return Windows Closing Soon
                </CardTitle>
                <Link href="/returns">
                  <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground">
                    View all <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {urgentReturns.map((r: any, i: number) => {
                  const dl = new Date(r.returnDeadline)
                  const daysLeft = differenceInDays(dl, today)
                  return (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-lg text-sm border ${daysLeft <= 3 ? 'bg-destructive/5 border-destructive/20' : 'bg-blue-500/5 border-blue-500/20'}`}>
                      <div>
                        <p className="font-medium text-foreground">{r.merchantName}</p>
                        <p className="text-xs text-muted-foreground">Deadline {format(dl, 'MMM d, yyyy')}</p>
                      </div>
                      <Badge variant="outline" className={`text-xs shrink-0 ${daysLeft <= 3 ? 'text-destructive border-destructive/40' : 'text-blue-600 border-blue-500/40'}`}>
                        {daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expiring Soon */}
        {expiringWarranties.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Expiring Soon
                </CardTitle>
                <Link href="/warranties">
                  <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground">
                    View all <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {expiringWarranties.map((w: any, i: number) => {
                  const endDate = new Date(w.warranty_end_date ?? w.warrantyEndDate)
                  const daysLeft = differenceInDays(endDate, today)
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-sm">
                      <div>
                        <p className="font-medium text-foreground">{w.product_name ?? w.productName ?? 'Warranty'}</p>
                        <p className="text-xs text-muted-foreground">
                          Expires {format(endDate, 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-amber-600 border-amber-500/40 text-xs shrink-0">
                        {daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analytics: Spending Trend + Top Merchants */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t('dash_spending_trend')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTrends ? (
                <Skeleton className="w-full h-[240px]" />
              ) : safeTrends.length === 0 ? (
                <div className="h-[240px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <ShoppingBag className="w-10 h-10 opacity-20" />
                  <p className="text-sm">No spending data yet.</p>
                  <p className="text-xs">Add purchases to see your trend.</p>
                </div>
              ) : (
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={safeTrends} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={(val) => formatCurrency(val, currency, locale)} width={65} />
                      <Tooltip
                        cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                        contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--foreground)' }}
                        formatter={(val: number) => [fmt(val), 'Spending']}
                      />
                      <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Merchants */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" /> {t('dash_top_merchants')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMerchants ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="w-full h-10" />)}</div>
              ) : safeMerchants.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
                  <Building2 className="w-8 h-8 opacity-20" />
                  <p className="text-sm text-center">{t('dash_no_merchants')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {safeMerchants.slice(0, 5).map((merchant: any, i: number) => (
                    <div key={merchant.id} className="flex items-center gap-3 text-sm">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <MerchantLogo name={merchant.name} size="xs" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{merchant.name}</p>
                        <p className="text-xs text-muted-foreground">{merchant.purchaseCount} purchase{merchant.purchaseCount !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="font-semibold text-foreground shrink-0">{fmt(Number(merchant.totalSpent ?? 0))}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Subscriptions Breakdown */}
        {(loadingBreakdown || safeCategoryBreakdown.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Repeat className="w-4 h-4" /> {t('dash_subs_breakdown')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBreakdown ? (
                <Skeleton className="w-full h-[200px]" />
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="h-[180px] w-[180px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={safeCategoryBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="total" nameKey="category">
                          {safeCategoryBreakdown.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                          itemStyle={{ color: 'var(--foreground)' }}
                          formatter={(val: number) => [`${fmt(val)}/mo`, '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full space-y-2">
                    {safeCategoryBreakdown.map((cat: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="capitalize">{cat.category}</span>
                        </div>
                        <span className="font-medium">{fmt(Number(cat.total ?? 0))}/mo</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}

function PlanCard({ plan, subscription, loading, t }: {
  plan: 'free' | 'pro' | undefined
  subscription: any
  loading: boolean
  t: (key: string, vars?: any) => string
}) {
  const isPro = plan === 'pro'
  const status: string | undefined = subscription?.status
  const periodEnd: string | undefined = subscription?.current_period_end
  const cancelAtEnd: boolean = subscription?.cancel_at_period_end ?? false
  const renewalDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isPro ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}>
              {isPro ? <Crown className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-5 w-24 mb-1" />
              ) : (
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-foreground">
                    {isPro ? t('dash_pro_plan') : t('dash_free_plan')}
                  </p>
                  {isPro && status && (
                    <Badge variant="outline" className={`text-xs px-1.5 py-0 ${
                      status === 'active' && !cancelAtEnd ? 'text-emerald-600 border-emerald-500/30'
                        : cancelAtEnd ? 'text-amber-600 border-amber-500/30'
                        : 'text-muted-foreground'
                    }`}>
                      {cancelAtEnd ? 'Cancelling' : status === 'active' ? 'Active' : status}
                    </Badge>
                  )}
                </div>
              )}
              {loading ? (
                <Skeleton className="h-3.5 w-48" />
              ) : isPro && renewalDate ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {cancelAtEnd
                    ? <><AlertTriangle className="w-3 h-3 text-amber-500" /> Access until {renewalDate}</>
                    : <><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Renews {renewalDate}</>
                  }
                </p>
              ) : !isPro ? (
                <p className="text-xs text-muted-foreground">50 purchases · 5 subscriptions · 10 warranties</p>
              ) : null}
            </div>
          </div>
          {!loading && !isPro && (
            <Link href="/settings?tab=billing">
              <Button size="sm" className="shrink-0 text-xs h-8">{t('dash_upgrade')}</Button>
            </Link>
          )}
          {!loading && isPro && cancelAtEnd && (
            <Link href="/settings?tab=billing">
              <Button size="sm" variant="outline" className="shrink-0 text-xs h-8">{t('dash_manage_plan')}</Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function StatCard({ title, value, loading, icon: Icon, href, accent = false }: {
  title: string
  value: string | number | null | undefined
  loading: boolean
  icon: React.ElementType
  href?: string
  accent?: boolean
}) {
  const content = (
    <Card className={`transition-colors ${href ? 'hover:border-primary/40 cursor-pointer' : ''} ${accent && Number(value) > 0 ? 'border-amber-500/30 bg-amber-500/5' : ''}`}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-3">
          <p className="text-xs font-medium text-muted-foreground leading-snug">{title}</p>
          <div className={`p-1.5 rounded-md shrink-0 ${accent && Number(value) > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-secondary text-foreground'}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <h3 className="text-2xl font-bold tracking-tight">
            {value !== undefined && value !== null ? value : '--'}
          </h3>
        )}
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{content}</Link> : content
}
