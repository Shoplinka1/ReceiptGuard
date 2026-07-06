import React from "react"
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

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

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

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary()
  const { data: trends, isLoading: loadingTrends } = useGetSpendingTrend()
  const { data: activities, isLoading: loadingActivity } = useListActivity({ limit: 5 })
  const { data: merchants, isLoading: loadingMerchants } = useGetTopMerchants()
  const { data: renewals, isLoading: loadingRenewals } = useGetUpcomingRenewals()
  const { data: breakdown, isLoading: loadingBreakdown } = useGetSubscriptionBreakdown()
  const { data: gmailAccounts = [] } = useQuery({ queryKey: ['gmail', 'accounts'], queryFn: fetchGmailAccounts, retry: false })

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
                          {(breakdown?.categoryBreakdown || []).map((_, index) => (
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
                    {breakdown?.categoryBreakdown?.map((cat, i) => (
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
                  {renewals?.slice(0, 4).map(renewal => (
                    <div key={renewal.id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center font-bold text-xs">
                          {(renewal.companyName || '?').substring(0,1)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{renewal.companyName}</p>
                          <p className="text-xs text-muted-foreground">In {renewal.daysUntilRenewal} days</p>
                        </div>
                      </div>
                      <div className="font-medium text-foreground">
  ${(renewal.amount ?? 0).toFixed(2)}
</div>
                    </div>
                  ))}
                  {(!renewals || renewals.length === 0) && (
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
                  {activities?.map(activity => (
                    <div key={activity.id} className="flex gap-3 text-sm">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0" />
                      <div>
                        <p className="text-foreground">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(activity.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                  {(!activities || activities.length === 0) && (
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
                  {merchants?.slice(0,4).map(merchant => (
                    <div key={merchant.id} className="flex justify-between items-center text-sm">
                      <div className="font-medium text-foreground">{merchant.name}</div>
                      <div className="text-muted-foreground">${merchant.totalSpent.toFixed(2)}</div>
                    </div>
                  ))}
                  {(!merchants || merchants.length === 0) && (
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
