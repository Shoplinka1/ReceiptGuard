import React from "react"
import { Link } from "wouter"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useGetDashboardSummary, useGetSpendingTrend, useListActivity, useGetTopMerchants, useGetUpcomingRenewals, useGetSubscriptionBreakdown } from "@workspace/api-client-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts"
import { ArrowUpRight, ArrowDownRight, CreditCard, Receipt, Repeat, ShieldAlert, Activity, Building2, Calendar, Mail, TrendingUp } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || ''

async function getAuthToken() {
  const { supabase } = await import('@/lib/supabase')
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

async function fetchGmailAccounts() {
  const token = await getAuthToken()
  const res = await fetch(`${API_BASE}/api/gmail/accounts`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) return []
  return res.json()
}

/**
 * Safely coerces an API response to an array.
 *
 * Why this exists: react-query sets `data` to whatever the server returns.
 * If the response is an error envelope ({ error: "..." }), a wrapper object
 * ({ data: [...] }), or an HTML fallback string (HTTP 200 but wrong
 * Content-Type), calling .map() on it throws "TypeError: x.map is not a
 * function" and crashes the render. This helper absorbs all of those cases.
 */
function toSafeArray<T>(value: unknown, fieldName: string): T[] {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) return value as T[]

  // Try common wrapper keys returned by some APIs.
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

  const safeActivities  = toSafeArray<typeof activities extends (infer U)[] | undefined ? U : never>(activities,  'activities')
  const safeRenewals    = toSafeArray<typeof renewals   extends (infer U)[] | undefined ? U : never>(renewals,    'renewals')
  const safeMerchants   = toSafeArray<typeof merchants  extends (infer U)[] | undefined ? U : never>(merchants,   'merchants')
  const safeCategoryBreakdown = toSafeArray<NonNullable<NonNullable<typeof breakdown>['categoryBreakdown']>[number]>(
    breakdown?.categoryBreakdown, 'breakdown.categoryBreakdown'
  )
  const safeTrends = toSafeArray<typeof trends extends (infer U)[] | undefined ? U : never>(trends, 'trends')

  const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Gmail not connected banner */}
        {(gmailAccounts as any[]).length === 0 && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/30 bg-primary/5 px-5 py-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Connect your Gmail inbox</p>
                <p className="text-xs text-muted-foreground mt-0.5">ReceiptGuard needs Gmail access to automatically scan your receipts and track subscriptions.</p>
              </div>
            </div>
            <Link href="/connect-gmail">
              <Button size="sm" className="shrink-0">Connect Gmail</Button>
            </Link>
          </div>
        )}

        <header className="flex justify-between items-end pb-4 border-b border-border">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">
              Welcome back, {loadingSummary ? <Skeleton className="inline-block h-8 w-32 align-bottom" /> : (summary?.firstName || 'there')}
            </h1>
            <p className="text-muted-foreground">Here's your financial overview for this month.</p>
          </div>
          {summary?.plan === "free" && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
              Free Plan
            </Badge>
          )}
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            title="Monthly Spending"
            value={summary ? `$${Number(summary.monthlySpending ?? 0).toFixed(2)}` : null}
            loading={loadingSummary}
            icon={CreditCard}
            colSpan="col-span-2 md:col-span-1"
          />
          <StatCard
            title="Monthly Subs"
            value={summary ? `$${Number(summary.subscriptionsMonthlyTotal ?? 0).toFixed(2)}` : null}
            subtext={summary && summary.subscriptionsMonthlyTotal > 0 ? `~$${Number((summary as any).annualSavings ?? 0).toFixed(0)}/yr saved` : undefined}
            loading={loadingSummary}
            icon={TrendingUp}
          />
          <StatCard
            title="Active Subs"
            value={summary?.activeSubscriptions}
            loading={loadingSummary}
            icon={Repeat}
          />
          <StatCard
            title="Receipts Stored"
            value={summary?.validReceiptCount}
            loading={loadingSummary}
            icon={Receipt}
          />
          <StatCard
            title="Active Warranties"
            value={summary?.activeWarranties}
            loading={loadingSummary}
            icon={ShieldAlert}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Spending Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTrends ? (
                <Skeleton className="w-full h-[300px]" />
              ) : safeTrends.length === 0 ? (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <CreditCard className="w-10 h-10 opacity-20" />
                  <p className="text-sm">No spending data yet.</p>
                  <p className="text-xs">Connect Gmail to import your receipts.</p>
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
                        tickFormatter={(val) => `$${val}`}
                        width={60}
                      />
                      <Tooltip
                        cursor={{fill: 'var(--muted)', opacity: 0.4}}
                        contentStyle={{backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px'}}
                        itemStyle={{color: 'var(--foreground)'}}
                        formatter={(val: number) => [`$${val.toFixed(2)}`, 'Spending']}
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
                <Repeat className="w-5 h-5" /> Subs Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBreakdown ? (
                 <Skeleton className="w-full h-[250px]" />
              ) : safeCategoryBreakdown.length === 0 ? (
                <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Repeat className="w-10 h-10 opacity-20" />
                  <p className="text-sm text-center">No active subscriptions yet.</p>
                  <p className="text-xs text-center">Import receipts from Gmail to track them automatically.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={safeCategoryBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="total"
                          nameKey="category"
                        >
                          {safeCategoryBreakdown.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px'}}
                          itemStyle={{color: 'var(--foreground)'}}
                          formatter={(val: number) => [`$${val.toFixed(2)}/mo`, '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full mt-4 space-y-2">
                    {safeCategoryBreakdown.map((cat, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="capitalize">{cat.category}</span>
                        </div>
                        <span className="font-medium">${Number(cat.total ?? 0).toFixed(2)}/mo</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Side Feed: Upcoming Renewals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" /> Upcoming Renewals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRenewals ? (
                <div className="space-y-4">
                  {[1,2,3].map(i => <Skeleton key={i} className="w-full h-12" />)}
                </div>
              ) : safeRenewals.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
                  <Calendar className="w-8 h-8 opacity-20" />
                  <p className="text-sm text-center">No renewals in the next 30 days.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {safeRenewals.slice(0, 4).map((renewal: any) => (
                    <div key={renewal.id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center font-bold text-xs shrink-0">
                          {(renewal.companyName || '?').substring(0,1)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{renewal.companyName || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">
                            {renewal.daysUntilRenewal === 0 ? 'Today' : `In ${renewal.daysUntilRenewal} day${renewal.daysUntilRenewal === 1 ? '' : 's'}`}
                          </p>
                        </div>
                      </div>
                      <div className="font-medium text-foreground">${(renewal.amount ?? 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Side Feed: Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingActivity ? (
                <div className="space-y-4">
                  {[1,2,3].map(i => <Skeleton key={i} className="w-full h-12" />)}
                </div>
              ) : safeActivities.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
                  <Activity className="w-8 h-8 opacity-20" />
                  <p className="text-sm text-center">No activity yet.</p>
                  <p className="text-xs text-center">Actions you take will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {safeActivities.map((activity: any) => (
                    <div key={activity.id} className="flex gap-3 text-sm">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0" />
                      <div>
                        <p className="text-foreground">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(activity.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Side Feed: Top Merchants */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5" /> Top Merchants
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMerchants ? (
                <div className="space-y-4">
                  {[1,2,3].map(i => <Skeleton key={i} className="w-full h-12" />)}
                </div>
              ) : safeMerchants.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
                  <Building2 className="w-8 h-8 opacity-20" />
                  <p className="text-sm text-center">No merchant data yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {safeMerchants.slice(0,5).map((merchant: any, i: number) => (
                    <div key={merchant.id} className="flex items-center gap-3 text-sm">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{merchant.name}</p>
                        <p className="text-xs text-muted-foreground">{merchant.purchaseCount} purchase{merchant.purchaseCount !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="font-semibold text-foreground shrink-0">${Number(merchant.totalSpent ?? 0).toFixed(2)}</div>
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
            <h3 className="text-2xl font-bold tracking-tight">{value !== undefined && value !== null ? value : '--'}</h3>
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
