import React from "react"
import { Link } from "wouter"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  useGetDashboardSummary, useGetSpendingTrend, useListActivity,
  useGetTopMerchants, useGetUpcomingRenewals, useGetSubscriptionBreakdown,
  useGetUserSettings,
} from "@workspace/api-client-react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell,
} from "recharts"
import {
  ArrowDownRight, CreditCard, Receipt, Repeat, ShieldAlert, Activity,
  Building2, Calendar, Mail, TrendingUp, Sparkles, CheckCircle2,
  AlertTriangle, Crown, Info,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { formatCurrency, convertByCurrency } from "@/lib/currency"
import { useTranslation } from "@/lib/i18n"
import { MerchantLogo } from "@/components/ui/merchant-logo"

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || ''

async function getAuthToken() {
  const { supabase } = await import('@/lib/supabase')
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

async function fetchGmailAccounts() {
  const token = await getAuthToken()
  const res = await fetch(`${API_BASE}/api/gmail/accounts`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return []
  return res.json()
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
  const { data: activities, isLoading: loadingActivity } = useListActivity({ limit: 5 })
  const { data: merchants, isLoading: loadingMerchants } = useGetTopMerchants()
  const { data: renewals, isLoading: loadingRenewals } = useGetUpcomingRenewals()
  const { data: breakdown, isLoading: loadingBreakdown } = useGetSubscriptionBreakdown()
  const { data: gmailAccounts = [] } = useQuery({ queryKey: ['gmail', 'accounts'], queryFn: fetchGmailAccounts, retry: false })
  const { data: subscription, isLoading: loadingSubscription } = useQuery({ queryKey: ['paystack', 'subscription'], queryFn: fetchSubscription, retry: false })
  const { data: userSettings } = useGetUserSettings()
  const { data: fxData } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: fetchExchangeRates,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: false,
  })

  const { t, locale } = useTranslation()
  const currency = userSettings?.currency || 'USD'
  const rates = fxData?.rates ?? {}
  const ratesStale = fxData?.stale ?? true
  const ratesAvailable = !ratesStale && Object.keys(rates).length > 0

  // Convert monthly spending using per-currency breakdown if rates are available
  const rawSummary = summary as any
  const monthlySpending: number = (() => {
    const byCurrency = rawSummary?.monthlySpendingByCurrency
    if (byCurrency && ratesAvailable) {
      return convertByCurrency(byCurrency, currency, rates)
    }
    return rawSummary?.monthlySpending ?? 0
  })()

  const safeActivities  = toSafeArray<any>(activities,  'activities')
  const safeRenewals    = toSafeArray<any>(renewals,    'renewals')
  const safeMerchants   = toSafeArray<any>(merchants,   'merchants')
  const safeCategoryBreakdown = toSafeArray<any>(breakdown?.categoryBreakdown, 'breakdown.categoryBreakdown')
  const safeTrends      = toSafeArray<any>(trends, 'trends')

  const COLORS = ['var(--chart-1)','var(--chart-2)','var(--chart-3)','var(--chart-4)','var(--chart-5)']

  const fmt = (v: number) => formatCurrency(v, currency, locale)

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Gmail not connected banner */}
        {(gmailAccounts as any[]).length === 0 && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/30 bg-primary/5 px-5 py-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">{t('dash_connect_gmail_msg')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('dash_connect_gmail_hint')}</p>
              </div>
            </div>
            <Link href="/connect-gmail">
              <Button size="sm" className="shrink-0">{t('dash_connect_gmail')}</Button>
            </Link>
          </div>
        )}

        {/* Stale rates notice */}
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

        <header className="flex justify-between items-end pb-4 border-b border-border">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">
              {t('dash_welcome')} {loadingSummary
                ? <Skeleton className="inline-block h-8 w-32 align-bottom" />
                : (summary?.firstName || 'there')}
            </h1>
            <p className="text-muted-foreground">{t('dash_subtitle')}</p>
          </div>
          {summary?.plan === "free" && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
              {t('dash_free_plan')}
            </Badge>
          )}
        </header>

        {/* Subscription Plan Card */}
        <PlanCard plan={summary?.plan} subscription={subscription} loading={loadingSummary || loadingSubscription} t={t} />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            title={t('dash_stat_spending')}
            value={summary ? fmt(monthlySpending) : null}
            loading={loadingSummary}
            icon={CreditCard}
            colSpan="col-span-2 md:col-span-1"
          />
          <StatCard
            title={t('dash_stat_subs')}
            value={summary ? fmt(Number(summary.subscriptionsMonthlyTotal ?? 0)) : null}
            subtext={summary && summary.subscriptionsMonthlyTotal > 0
              ? `~${fmt(Number((rawSummary).annualSavings ?? 0))}/yr saved`
              : undefined}
            loading={loadingSummary}
            icon={TrendingUp}
          />
          <StatCard
            title={t('dash_stat_active_subs')}
            value={summary?.activeSubscriptions}
            loading={loadingSummary}
            icon={Repeat}
          />
          <StatCard
            title={t('dash_stat_receipts')}
            value={summary?.validReceiptCount}
            loading={loadingSummary}
            icon={Receipt}
          />
          <StatCard
            title={t('dash_stat_warranties')}
            value={summary?.activeWarranties}
            loading={loadingSummary}
            icon={ShieldAlert}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Spending Trend */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">{t('dash_spending_trend')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTrends ? (
                <Skeleton className="w-full h-[300px]" />
              ) : safeTrends.length === 0 ? (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <CreditCard className="w-10 h-10 opacity-20" />
                  <p className="text-sm">{t('dash_no_spending')}</p>
                  <p className="text-xs">{t('dash_no_spending_hint')}</p>
                </div>
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={safeTrends} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} dy={10} />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                        tickFormatter={(val) => formatCurrency(val, currency, locale)}
                        width={70}
                      />
                      <Tooltip
                        cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                        contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--foreground)' }}
                        formatter={(val: number) => [fmt(val), t('dash_stat_spending')]}
                      />
                      <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subscriptions Pie */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Repeat className="w-5 h-5" /> {t('dash_subs_breakdown')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBreakdown ? (
                <Skeleton className="w-full h-[250px]" />
              ) : safeCategoryBreakdown.length === 0 ? (
                <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Repeat className="w-10 h-10 opacity-20" />
                  <p className="text-sm text-center">{t('dash_no_subs')}</p>
                  <p className="text-xs text-center">{t('dash_no_subs_hint')}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={safeCategoryBreakdown}
                          cx="50%" cy="50%"
                          innerRadius={60} outerRadius={80}
                          paddingAngle={5}
                          dataKey="total" nameKey="category"
                        >
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
                  <div className="w-full mt-4 space-y-2">
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

          {/* Upcoming Renewals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" /> {t('dash_upcoming_renewals')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRenewals ? (
                <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="w-full h-12" />)}</div>
              ) : safeRenewals.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
                  <Calendar className="w-8 h-8 opacity-20" />
                  <p className="text-sm text-center">{t('dash_no_renewals')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {safeRenewals.slice(0, 4).map((renewal: any) => (
                    <div key={renewal.id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-3">
                        <MerchantLogo name={renewal.companyName || null} size="xs" />
                        <div>
                          <p className="font-medium text-foreground">{renewal.companyName || t('subs_unknown')}</p>
                          <p className="text-xs text-muted-foreground">
                            {renewal.daysUntilRenewal === 0
                              ? t('dash_today')
                              : t('dash_in_days', {
                                  n: renewal.daysUntilRenewal,
                                  s: renewal.daysUntilRenewal === 1 ? '' : 's',
                                })}
                          </p>
                        </div>
                      </div>
                      <div className="font-medium text-foreground">{fmt(renewal.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" /> {t('dash_recent_activity')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingActivity ? (
                <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="w-full h-12" />)}</div>
              ) : safeActivities.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
                  <Activity className="w-8 h-8 opacity-20" />
                  <p className="text-sm text-center">{t('dash_no_activity')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {safeActivities.map((activity: any) => (
                    <div key={activity.id} className="flex gap-3 text-sm">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0" />
                      <div>
                        <p className="text-foreground">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(activity.createdAt).toLocaleDateString(locale)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Merchants */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5" /> {t('dash_top_merchants')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMerchants ? (
                <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="w-full h-12" />)}</div>
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
                        <p className="text-xs text-muted-foreground">
                          {merchant.purchaseCount} purchase{merchant.purchaseCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="font-semibold text-foreground shrink-0">
                        {fmt(Number(merchant.totalSpent ?? 0))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
                    <Badge
                      variant="outline"
                      className={`text-xs px-1.5 py-0 ${
                        status === 'active' && !cancelAtEnd
                          ? 'text-emerald-600 border-emerald-500/30'
                          : cancelAtEnd
                          ? 'text-amber-600 border-amber-500/30'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {cancelAtEnd ? 'Cancelling' : status === 'active' ? 'Active' : status}
                    </Badge>
                  )}
                </div>
              )}
              {loading ? (
                <Skeleton className="h-3.5 w-40" />
              ) : isPro && renewalDate ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {cancelAtEnd
                    ? <><AlertTriangle className="w-3 h-3 text-amber-500" /> Access until {renewalDate}</>
                    : <><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Renews {renewalDate}</>
                  }
                </p>
              ) : !isPro ? (
                <p className="text-xs text-muted-foreground">50 receipts · 5 subscriptions · 1 Gmail</p>
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

function StatCard({ title, value, loading, icon: Icon, subtext, colSpan = "" }: {
  title: string
  value: string | number | null | undefined
  loading: boolean
  icon: React.ElementType
  subtext?: string
  colSpan?: string
}) {
  return (
    <Card className={colSpan}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-3">
          <p className="text-xs font-medium text-muted-foreground leading-snug">{title}</p>
          <div className="p-1.5 bg-secondary rounded-md text-foreground shrink-0">
            <Icon className="w-3.5 h-3.5" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div>
            <h3 className="text-2xl font-bold tracking-tight">
              {value !== undefined && value !== null ? value : '--'}
            </h3>
            {subtext && (
              <p className="text-xs mt-1 text-emerald-500 font-medium flex items-center gap-1">
                <ArrowDownRight className="w-3 h-3" />
                {subtext}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
