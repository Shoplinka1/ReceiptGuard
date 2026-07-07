import React, { useState, useEffect } from "react"
import { Link } from "wouter"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useGetDashboardSummary, useGetSpendingTrend, useListActivity, useGetTopMerchants, useGetUpcomingRenewals, useGetSubscriptionBreakdown } from "@workspace/api-client-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts"
import { ArrowUpRight, ArrowDownRight, CreditCard, Receipt, Repeat, ShieldAlert, Activity, Building2, Calendar, Mail } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { getEntries, subscribe, type DebugEntry } from "@/lib/debug-log"

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

  // Log the unexpected shape so the debug panel / console reveals it.
  if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
    console.warn(
      `[dashboard] Expected array for "${fieldName}" but got:`,
      typeof value === 'string' ? value.slice(0, 200) : value,
    )
  }

  // Try common wrapper keys returned by some APIs.
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of ['data', fieldName, 'items', 'results', 'activities', 'renewals', 'merchants']) {
      if (Array.isArray(obj[key])) {
        console.warn(`[dashboard] Unwrapped "${fieldName}" from response key "${key}"`)
        return obj[key] as T[]
      }
    }
  }

  return []
}

// ── Debug banner component ─────────────────────────────────────────────────
function DebugBanner({
  queryStates,
}: {
  queryStates: Array<{ name: string; isLoading: boolean; isError: boolean; error: unknown; data: unknown }>
}) {
  const [entries, setEntries] = useState<DebugEntry[]>(() => getEntries())
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const unsub = subscribe(() => setEntries([...getEntries()]))
    return unsub
  }, [])

  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '(not set)'

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '12px', background: '#0f172a', color: '#94a3b8', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: '8px 14px', background: '#1e293b', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>🐛 DEBUG PANEL (click to {open ? 'hide' : 'show'})</span>
        <span style={{ color: '#64748b' }}>remove before final release</span>
      </div>
      {open && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Env var */}
          <div>
            <span style={{ color: '#64748b' }}>VITE_API_URL: </span>
            <span style={{ color: apiUrl === '(not set)' ? '#ef4444' : '#4ade80' }}>{apiUrl}</span>
          </div>

          {/* React Query states */}
          <div>
            <div style={{ color: '#64748b', marginBottom: '4px' }}>React Query states:</div>
            {queryStates.map(q => {
              const errMsg = q.isError
                ? (q.error instanceof Error ? q.error.message : String(q.error))
                : null
              const dataType = q.data === undefined ? 'undefined' : q.data === null ? 'null' : typeof q.data === 'string' ? `string(${(q.data as string).slice(0,40)})` : Array.isArray(q.data) ? `array[${(q.data as unknown[]).length}]` : `object(${Object.keys(q.data as object).slice(0,3).join(',')})`
              return (
                <div key={q.name} style={{ marginLeft: '8px', marginBottom: '2px' }}>
                  <span style={{ color: '#cbd5e1' }}>{q.name}: </span>
                  {q.isLoading && <span style={{ color: '#fbbf24' }}>loading…</span>}
                  {q.isError && <span style={{ color: '#ef4444' }}>ERROR — {errMsg}</span>}
                  {!q.isLoading && !q.isError && <span style={{ color: '#4ade80' }}>ok — {dataType}</span>}
                </div>
              )
            })}
          </div>

          {/* Fetch log */}
          <div>
            <div style={{ color: '#64748b', marginBottom: '4px' }}>Fetch log ({entries.filter(e => e.url.includes('/api/')).length} API calls):</div>
            {entries.filter(e => e.url.includes('/api/')).length === 0 && (
              <div style={{ marginLeft: '8px', color: '#fbbf24' }}>No /api/ requests captured yet — VITE_API_URL may be wrong or auth token may be missing</div>
            )}
            {entries.filter(e => e.url.includes('/api/')).map((e, i) => (
              <div key={i} style={{ marginLeft: '8px', marginBottom: '6px', borderLeft: '2px solid #334155', paddingLeft: '8px' }}>
                <div><span style={{ color: '#64748b' }}>url: </span><span style={{ color: '#e2e8f0', wordBreak: 'break-all' }}>{e.url}</span></div>
                <div>
                  <span style={{ color: '#64748b' }}>status: </span>
                  <span style={{ color: e.status === 200 ? '#4ade80' : '#ef4444' }}>{e.status ?? 'network error'}</span>
                  <span style={{ color: '#64748b' }}> · content-type: </span>
                  <span style={{ color: e.isJson ? '#4ade80' : '#f87171' }}>{e.contentType ?? 'none'}</span>
                  <span style={{ color: '#64748b' }}> · body: </span>
                  <span style={{ color: e.isJson ? '#4ade80' : '#f87171' }}>{e.isJson ? 'JSON ✓' : 'NOT JSON ✗'}</span>
                </div>
                {e.bodySnippet && (
                  <div style={{ color: '#f87171', marginTop: '2px', wordBreak: 'break-all' }}>
                    snippet: {e.bodySnippet}
                  </div>
                )}
                {e.error && (
                  <div style={{ color: '#ef4444' }}>network error: {e.error}</div>
                )}
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  )
}
// ──────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary, isError: errSummary, error: errSummaryVal } = useGetDashboardSummary()
  const { data: trends, isLoading: loadingTrends, isError: errTrends, error: errTrendsVal } = useGetSpendingTrend()
  const { data: activities, isLoading: loadingActivity, isError: errActivity, error: errActivityVal } = useListActivity({ limit: 5 })
  const { data: merchants, isLoading: loadingMerchants, isError: errMerchants, error: errMerchantsVal } = useGetTopMerchants()
  const { data: renewals, isLoading: loadingRenewals, isError: errRenewals, error: errRenewalsVal } = useGetUpcomingRenewals()
  const { data: breakdown, isLoading: loadingBreakdown, isError: errBreakdown, error: errBreakdownVal } = useGetSubscriptionBreakdown()
  const { data: gmailAccounts = [] } = useQuery({ queryKey: ['gmail', 'accounts'], queryFn: fetchGmailAccounts, retry: false })

  const queryStates = [
    { name: 'summary', isLoading: loadingSummary, isError: errSummary, error: errSummaryVal, data: summary },
    { name: 'trends', isLoading: loadingTrends, isError: errTrends, error: errTrendsVal, data: trends },
    { name: 'activities', isLoading: loadingActivity, isError: errActivity, error: errActivityVal, data: activities },
    { name: 'merchants', isLoading: loadingMerchants, isError: errMerchants, error: errMerchantsVal, data: merchants },
    { name: 'renewals', isLoading: loadingRenewals, isError: errRenewals, error: errRenewalsVal, data: renewals },
    { name: 'breakdown', isLoading: loadingBreakdown, isError: errBreakdown, error: errBreakdownVal, data: breakdown },
  ]

  // Coerce every list-typed query result to a guaranteed array before render.
  // This prevents "x.map is not a function" if the API returns an error
  // envelope, a wrapper object, or an HTML string instead of a plain array.
  const safeActivities  = toSafeArray<typeof activities extends (infer U)[] | undefined ? U : never>(activities,  'activities')
  const safeRenewals    = toSafeArray<typeof renewals   extends (infer U)[] | undefined ? U : never>(renewals,    'renewals')
  const safeMerchants   = toSafeArray<typeof merchants  extends (infer U)[] | undefined ? U : never>(merchants,   'merchants')
  const safeCategoryBreakdown = toSafeArray<NonNullable<typeof breakdown>['categoryBreakdown'][number]>(
    breakdown?.categoryBreakdown, 'breakdown.categoryBreakdown'
  )
  const safeTrends = toSafeArray<typeof trends extends (infer U)[] | undefined ? U : never>(trends, 'trends')

  const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── DEBUG BANNER ── */}
        <DebugBanner queryStates={queryStates} />

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
              Welcome back, {summary?.firstName || 'User'}
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
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard 
            title="Monthly Spending" 
            value={summary ? `${summary.monthlySpending.toFixed(2)}` : null} 
            loading={loadingSummary} 
            icon={CreditCard} 
            colSpan="md:col-span-1 lg:col-span-2"
          />
          <StatCard 
            title="Money Saved" 
            value={summary ? `${summary.moneySaved.toFixed(2)}` : null} 
            loading={loadingSummary} 
            icon={ArrowDownRight} 
            trend="+12% from last month"
            trendUp={true}
          />
          <StatCard 
            title="Active Subs" 
            value={summary?.activeSubscriptions} 
            loading={loadingSummary} 
            icon={Repeat} 
          />
          <StatCard 
            title="Receipts Stored" 
            value={summary?.totalReceipts} 
            loading={loadingSummary} 
            icon={Receipt} 
          />
          <StatCard 
            title="Warranties" 
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
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} tickFormatter={(val) => `${val}`} />
                      <Tooltip 
                        cursor={{fill: 'var(--muted)', opacity: 0.4}} 
                        contentStyle={{backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px'}} 
                        itemStyle={{color: 'var(--foreground)'}}
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
              ) : (
                <div className="flex flex-col items-center">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={breakdown?.categoryBreakdown || []}
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
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full mt-4 space-y-2">
                    {safeCategoryBreakdown.map((cat, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="capitalize">{cat.category}</span>
                        </div>
                        <span className="font-medium">${cat.total.toFixed(2)}</span>
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
              ) : (
                <div className="space-y-4">
                  {safeRenewals.slice(0, 4).map(renewal => (
                    <div key={renewal.id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center font-bold text-xs">
                          {(renewal.companyName || '?').substring(0,1)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{renewal.companyName || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">In {renewal.daysUntilRenewal} days</p>
                        </div>
                      </div>
                      <div className="font-medium text-foreground">${(renewal.amount ?? 0).toFixed(2)}</div>
                    </div>
                  ))}
                  {safeRenewals.length === 0 && !loadingRenewals && (
                    <p className="text-sm text-muted-foreground text-center py-4">No upcoming renewals.</p>
                  )}
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
              ) : (
                <div className="space-y-4">
                  {safeActivities.map(activity => (
                    <div key={activity.id} className="flex gap-3 text-sm">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0" />
                      <div>
                        <p className="text-foreground">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(activity.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                  {safeActivities.length === 0 && !loadingActivity && (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p>
                  )}
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
              ) : (
                <div className="space-y-4">
                  {safeMerchants.slice(0,4).map(merchant => (
                    <div key={merchant.id} className="flex justify-between items-center text-sm">
                      <div className="font-medium text-foreground">{merchant.name}</div>
                      <div className="text-muted-foreground">${merchant.totalSpent.toFixed(2)}</div>
                    </div>
                  ))}
                  {safeMerchants.length === 0 && !loadingMerchants && (
                    <p className="text-sm text-muted-foreground text-center py-4">No data available.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </AppShell>
  )
}

function StatCard({ title, value, loading, icon: Icon, trend, trendUp, colSpan = "" }: any) {
  return (
    <Card className={colSpan}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="p-2 bg-secondary rounded-lg text-foreground">
            <Icon className="w-4 h-4" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div>
            <h3 className="text-3xl font-bold tracking-tight">{value !== undefined ? value : '--'}</h3>
            {trend && (
              <p className={`text-xs mt-2 font-medium flex items-center gap-1 ${trendUp ? 'text-emerald-500' : 'text-red-500'}`}>
                {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {trend}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
