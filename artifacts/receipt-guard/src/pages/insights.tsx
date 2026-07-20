import React, { useState, useMemo } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend,
} from 'recharts'
import {
  TrendingUp, DollarSign, ShoppingBag, Calendar,
  Building2, CreditCard, Award, PieChart as PieIcon,
} from 'lucide-react'
import {
  useGetSpendingTrend, useGetTopMerchants, useGetSubscriptionBreakdown,
  useGetDashboardSummary, useGetUserSettings,
} from '@workspace/api-client-react'
import { formatCurrency } from '@/lib/currency'
import { useTranslation } from '@/lib/i18n'
import { MerchantLogo } from '@/components/ui/merchant-logo'

const COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)', '#6366f1', '#f59e0b', '#10b981',
]

function toArray<T>(v: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(v)) return v as T[]
  if (v && typeof v === 'object') {
    for (const k of ['data', 'items', 'results', 'trends', 'merchants', 'breakdown']) {
      if (Array.isArray((v as any)[k])) return (v as any)[k]
    }
  }
  return fallback
}

function StatCard({ title, value, sub, icon: Icon, loading }: {
  title: string; value: string; sub?: string; icon: React.ElementType; loading?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-3">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <div className="p-1.5 rounded-md bg-primary/10">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
        </div>
        {loading ? <Skeleton className="h-8 w-24" /> : (
          <>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function InsightsPage() {
  const { data: userSettings } = useGetUserSettings()
  const { locale } = useTranslation()
  const currency = userSettings?.currency || 'USD'
  const fmt = (v: number) => formatCurrency(v, currency, locale)

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary()
  const { data: trendsRaw, isLoading: loadingTrends } = useGetSpendingTrend()
  const { data: merchantsRaw, isLoading: loadingMerchants } = useGetTopMerchants()
  const { data: breakdown, isLoading: loadingBreakdown } = useGetSubscriptionBreakdown()

  const trends = toArray<any>(trendsRaw)
  const merchants = toArray<any>(merchantsRaw)
  const catBreakdown = toArray<any>(breakdown?.categoryBreakdown)

  // Summary numbers
  const totalSpend = useMemo(() => {
    return trends.reduce((sum: number, m: any) => sum + Number(m.total ?? 0), 0)
  }, [trends])

  const avgMonthly = useMemo(() => {
    return trends.length > 0 ? totalSpend / trends.length : 0
  }, [totalSpend, trends])

  const bestMonth = useMemo(() => {
    if (!trends.length) return null
    return trends.reduce((best: any, m: any) => Number(m.total) > Number(best?.total ?? 0) ? m : best, null)
  }, [trends])

  const tooltipStyle = {
    backgroundColor: 'var(--card)',
    borderColor: 'var(--border)',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '12px',
  }

  const rawSummary = summary as any

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Spending Insights</h1>
            <p className="text-sm text-muted-foreground">Understand where your money goes.</p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Tracked Spend"
            value={loadingTrends ? '—' : fmt(totalSpend)}
            sub={`across ${trends.length} month${trends.length !== 1 ? 's' : ''}`}
            icon={DollarSign}
            loading={loadingTrends}
          />
          <StatCard
            title="Avg Monthly Spend"
            value={loadingTrends ? '—' : fmt(avgMonthly)}
            sub="per month average"
            icon={TrendingUp}
            loading={loadingTrends}
          />
          <StatCard
            title="Total Purchases"
            value={loadingSummary ? '—' : String(rawSummary?.validReceiptCount ?? 0)}
            sub="across all time"
            icon={ShoppingBag}
            loading={loadingSummary}
          />
          <StatCard
            title="Peak Month"
            value={loadingTrends || !bestMonth ? '—' : fmt(Number(bestMonth.total))}
            sub={bestMonth?.label ?? ''}
            icon={Award}
            loading={loadingTrends}
          />
        </div>

        {/* Spending Trend — full width */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Monthly Spending Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTrends ? (
              <Skeleton className="w-full h-[280px]" />
            ) : trends.length === 0 ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                <TrendingUp className="w-10 h-10 opacity-20" />
                <p className="text-sm">Add purchases to see your spending trend.</p>
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spending-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={v => fmt(v)} width={70} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: 'var(--foreground)' }}
                      formatter={(v: number) => [fmt(v), 'Spending']}
                    />
                    <Area type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} fill="url(#spending-gradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Two columns: Top Merchants + Subscription Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Merchants */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Top Merchants
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMerchants ? (
                <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="w-full h-10" />)}</div>
              ) : merchants.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  <p className="text-sm">No merchant data yet.</p>
                </div>
              ) : (
                <>
                  <div className="h-[220px] mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={merchants.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.5} />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} tickFormatter={v => fmt(v)} />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} width={80} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          itemStyle={{ color: 'var(--foreground)' }}
                          formatter={(v: number) => [fmt(v), 'Total spent']}
                        />
                        <Bar dataKey="totalSpent" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2.5">
                    {merchants.slice(0, 5).map((m: any, i: number) => (
                      <div key={m.id ?? i} className="flex items-center gap-3 text-sm">
                        <span className="text-xs text-muted-foreground w-5 shrink-0 font-mono">{i + 1}</span>
                        <MerchantLogo name={m.name} size="xs" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.purchaseCount} purchase{m.purchaseCount !== 1 ? 's' : ''}</p>
                        </div>
                        <p className="font-bold">{fmt(Number(m.totalSpent))}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Subscription breakdown */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <PieIcon className="w-4 h-4" /> Subscription Spend by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBreakdown ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="w-full h-10" />)}</div>
              ) : catBreakdown.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                  <p className="text-sm">No subscription data yet.</p>
                </div>
              ) : (
                <>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={catBreakdown}
                          cx="50%" cy="50%"
                          innerRadius={55} outerRadius={80}
                          paddingAngle={4}
                          dataKey="total"
                          nameKey="category"
                        >
                          {catBreakdown.map((_: any, i: number) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          itemStyle={{ color: 'var(--foreground)' }}
                          formatter={(v: number) => [`${fmt(v)}/mo`, '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2.5 mt-2">
                    {catBreakdown.map((cat: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="capitalize">{cat.category?.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-muted-foreground">({cat.count})</span>
                        </div>
                        <span className="font-semibold">{fmt(Number(cat.total))}/mo</span>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-border flex justify-between text-sm font-bold">
                      <span>Total monthly</span>
                      <span>{fmt(catBreakdown.reduce((s: number, c: any) => s + Number(c.total), 0))}/mo</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Billing cycle split */}
        {!loadingBreakdown && breakdown && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Subscription Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Monthly subs',   value: String((breakdown as any).monthlyCount ?? 0),                                   sub: 'billed monthly' },
                  { label: 'Annual subs',    value: String((breakdown as any).yearlyCount ?? 0),                                    sub: 'billed yearly' },
                  { label: 'Monthly total',  value: fmt((breakdown as any).monthlyTotal ?? 0),                                      sub: 'from monthly billing' },
                  { label: 'Monthly equiv.', value: fmt((breakdown as any).grandMonthlyEquivalent ?? 0),                            sub: 'all subs combined' },
                ].map(item => (
                  <div key={item.label} className="p-4 rounded-xl bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground font-medium mb-1">{item.label}</p>
                    <p className="text-xl font-bold">{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
