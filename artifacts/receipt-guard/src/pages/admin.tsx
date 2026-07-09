import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Users, DollarSign, TrendingUp, Activity, Mail, ShieldAlert,
  UserX, Search, MessageSquare, Bug, Lightbulb, LifeBuoy, RefreshCw,
  AlertTriangle, CheckCircle2, Sparkles, Calendar, Inbox, Loader2,
} from 'lucide-react'

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
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  // 204 No Content — no body to parse
  if (res.status === 204) return null
  return res.json()
}

function useAdminStats() {
  return useQuery({ queryKey: ['admin', 'stats'], queryFn: () => apiFetch('/api/admin/stats'), retry: false })
}
function useAdminUsers(search: string) {
  return useQuery({
    queryKey: ['admin', 'users', search],
    // Backend returns { users: [...], total, page, pageSize }
    queryFn: () => apiFetch(`/api/admin/users?search=${encodeURIComponent(search)}&limit=50`),
    retry: false,
  })
}
function useAdminPayments() {
  return useQuery({ queryKey: ['admin', 'payments'], queryFn: () => apiFetch('/api/admin/payments?limit=20'), retry: false })
}
function useAdminFeedback() {
  return useQuery({ queryKey: ['admin', 'feedback'], queryFn: () => apiFetch('/api/admin/feedback?limit=30'), retry: false })
}
function useAdminGmailAccounts(search: string) {
  return useQuery({
    queryKey: ['admin', 'gmail', search],
    queryFn: () => apiFetch(`/api/admin/gmail-accounts?search=${encodeURIComponent(search)}&pageSize=50`),
    retry: false,
  })
}

function SmtpTestCard({ apiFetch }: { apiFetch: (path: string, opts?: RequestInit) => Promise<any> }) {
  const [result, setResult] = useState<{ success: boolean; configured: boolean; message?: string; error?: string; hint?: string } | null>(null)
  const [testing, setTesting] = useState(false)

  async function runTest() {
    setTesting(true)
    setResult(null)
    try {
      const data = await apiFetch('/api/admin/smtp-test', { method: 'POST' })
      setResult(data)
    } catch (e: any) {
      setResult({ success: false, configured: false, error: e.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Mail className="w-4 h-4" /> SMTP / Email Delivery
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Send a test email to verify feedback notifications are working</p>
          </div>
          <Button size="sm" variant="outline" onClick={runTest} disabled={testing}>
            {testing ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Testing…</> : 'Send Test Email'}
          </Button>
        </div>
      </CardHeader>
      {result && (
        <CardContent className="pt-0">
          <div className={`flex items-start gap-2.5 p-3 rounded-lg text-sm border ${result.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400' : 'bg-destructive/10 border-destructive/30 text-destructive'}`}>
            {result.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <div>
              <p className="font-medium">{result.success ? 'Email delivered' : result.configured ? 'SMTP error' : 'Not configured'}</p>
              <p className="text-xs mt-0.5 opacity-80">{result.message ?? result.error}</p>
              {result.hint && <p className="text-xs mt-1 font-mono opacity-70">{result.hint}</p>}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export default function AdminPage() {
  const [tab, setTab] = useState<'overview' | 'users' | 'payments' | 'feedback' | 'subscriptions' | 'gmail'>('overview')
  const [search, setSearch] = useState('')
  const qc = useQueryClient()

  const { data: stats, isLoading: loadingStats, error: statsError } = useAdminStats()
  // Backend wraps users in { users: [...], total, page, pageSize }
  const { data: usersData, isLoading: loadingUsers } = useAdminUsers(search)
  const users = usersData?.users ?? []
  const { data: payments, isLoading: loadingPayments } = useAdminPayments()
  const { data: feedback, isLoading: loadingFeedback } = useAdminFeedback()
  const { data: gmailData, isLoading: loadingGmail } = useAdminGmailAccounts(search)

  const patchUser = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); toast.success('User updated') },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteUser = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); toast.success('User deleted') },
    onError: (e: Error) => toast.error(e.message),
  })

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'users' as const, label: 'Users' },
    { id: 'payments' as const, label: 'Payments' },
    { id: 'subscriptions' as const, label: 'Subscriptions' },
    { id: 'gmail' as const, label: 'Gmail Accounts' },
    { id: 'feedback' as const, label: 'Feedback' },
  ]

  const statCards = [
    // Users
    { label: 'Total Users',     value: stats?.totalUsers,    icon: Users },
    { label: 'New Today',       value: stats?.newUsersToday, icon: Activity },
    { label: 'New (30d)',       value: stats?.newUsers30d,   icon: Activity },
    { label: 'Active Users',    value: stats?.activeUsers,   icon: CheckCircle2 },
    { label: 'Free Users',      value: stats?.freeUsers,     icon: Users },
    { label: 'Pro Users',       value: stats?.payingUsers,   icon: Sparkles },
    // Engagement
    { label: 'DAU',             value: stats?.dau,           icon: Activity },
    { label: 'WAU',             value: stats?.wau,           icon: Activity },
    { label: 'MAU',             value: stats?.mau,           icon: Activity },
    // Revenue
    { label: 'MRR',             value: stats?.mrr           != null ? `$${(stats.mrr           as number).toFixed(2)}` : null, icon: DollarSign },
    { label: 'ARR',             value: stats?.arr           != null ? `$${(stats.arr           as number).toFixed(2)}` : null, icon: TrendingUp },
    { label: 'Total Revenue',   value: stats?.totalRevenue  != null ? `$${(stats.totalRevenue  as number).toFixed(2)}` : null, icon: TrendingUp },
    { label: 'Failed Payments', value: stats?.failedPaymentsCount, icon: AlertTriangle },
    // Conversion & churn
    { label: 'Conversion',      value: stats?.conversionRate   != null ? `${(stats.conversionRate   as number).toFixed(1)}%` : null, icon: TrendingUp },
    { label: 'New Pro (30d)',   value: stats?.newProUpgrades30d, icon: Sparkles },
    { label: 'Churn (30d)',     value: stats?.churnedCount30d,   icon: AlertTriangle },
    // Content & scans
    { label: 'Total Receipts',  value: stats?.totalReceipts,           icon: Inbox },
    { label: 'Gmail Accounts',  value: stats?.connectedGmailAccounts,  icon: Mail },
    { label: 'Scan Success',    value: stats?.scanSuccessRate != null ? `${(stats.scanSuccessRate as number).toFixed(1)}%` : null, icon: CheckCircle2 },
    { label: 'Open Feedback',   value: stats?.openFeedbackCount, icon: RefreshCw },
  ]

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-primary" /> Admin Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">System-wide metrics and user management</p>
          </div>
          <Badge variant="destructive" className="text-xs">Admin Only</Badge>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 border-b border-border">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {statsError && (
              <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {(statsError as Error).message}
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statCards.map(({ label, value, icon: Icon }) => (
                <Card key={label}>
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                      <div className="p-1.5 bg-secondary rounded-md"><Icon className="w-3.5 h-3.5" /></div>
                    </div>
                    {loadingStats ? <Skeleton className="h-7 w-20" /> : (
                      <p className="text-2xl font-bold">{value ?? '—'}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* SMTP Test */}
            <SmtpTestCard apiFetch={apiFetch} />
          </div>
        )}

        {/* USERS */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by email or name…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                {loadingUsers ? (
                  <div className="p-6 space-y-3">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : !users.length ? (
                  <div className="p-12 text-center text-muted-foreground">No users found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3">Plan</th>
                          <th className="px-4 py-3">Joined</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(users as any[]).map((u) => (
                          <tr key={u.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium">{u.full_name || '—'}</p>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={u.plan_id === 'pro' ? 'default' : 'outline'} className="text-xs capitalize">
                                {u.plan_id || 'free'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={u.is_suspended ? 'destructive' : 'outline'} className="text-xs">
                                {u.is_suspended ? 'Suspended' : 'Active'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => patchUser.mutate({ id: u.id, updates: { is_suspended: !u.is_suspended } })}
                                  disabled={patchUser.isPending}
                                >
                                  {u.is_suspended ? 'Unsuspend' : 'Suspend'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    if (confirm(`Delete user ${u.email as string}? This cannot be undone.`)) {
                                      deleteUser.mutate(u.id as string)
                                    }
                                  }}
                                  disabled={deleteUser.isPending}
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* PAYMENTS */}
        {tab === 'payments' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" /> Recent Payments
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingPayments ? (
                <div className="p-6 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : !payments?.length ? (
                <div className="p-12 text-center text-muted-foreground">No payments yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Plan</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payments as any[]).map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground">
                            {p.profiles?.email ?? String(p.user_id).slice(0, 8) + '…'}
                          </td>
                          <td className="px-4 py-3 capitalize">{p.plan_id || '—'}</td>
                          <td className="px-4 py-3 font-medium">₦{Number(p.amount).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={p.status === 'success' ? 'default' : p.status === 'failed' ? 'destructive' : 'outline'}
                              className="text-xs capitalize"
                            >
                              {p.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* SUBSCRIPTIONS */}
        {tab === 'subscriptions' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Active Pro subscriptions sorted by nearest expiry date.</p>
            {loadingStats ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : !(stats?.upcomingExpiries as any[])?.length ? (
              <div className="p-12 text-center text-muted-foreground">No active subscriptions found.</div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          <th className="px-4 py-3">User ID</th>
                          <th className="px-4 py-3">Plan</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Expires</th>
                          <th className="px-4 py-3">Days Left</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stats?.upcomingExpiries as any[] ?? []).map((sub: any) => {
                          const expiry = new Date(sub.current_period_end)
                          const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                          return (
                            <tr key={sub.user_id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{String(sub.user_id).slice(0, 12)}…</td>
                              <td className="px-4 py-3"><Badge variant="default" className="text-xs capitalize">{sub.plan_id}</Badge></td>
                              <td className="px-4 py-3"><Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30">Active</Badge></td>
                              <td className="px-4 py-3 text-muted-foreground">{expiry.toLocaleDateString()}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-medium ${daysLeft <= 7 ? 'text-destructive' : daysLeft <= 30 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                  {daysLeft > 0 ? `${daysLeft}d` : 'Expired'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* GMAIL ACCOUNTS */}
        {tab === 'gmail' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Gmail address…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                {loadingGmail ? (
                  <div className="p-6 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : !(gmailData?.accounts as any[])?.length ? (
                  <div className="p-12 text-center text-muted-foreground">No Gmail accounts connected.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          <th className="px-4 py-3">Gmail</th>
                          <th className="px-4 py-3">Owner</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Last Scanned</th>
                          <th className="px-4 py-3">Connected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {((gmailData?.accounts ?? []) as any[]).map((acc: any) => (
                          <tr key={acc.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Inbox className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">{acc.email}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              <div>
                                <p>{acc.profiles?.full_name || '—'}</p>
                                <p className="text-xs">{acc.profiles?.email || String(acc.user_id).slice(0, 12) + '…'}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={acc.is_active ? 'outline' : 'secondary'} className={`text-xs ${acc.is_active ? 'text-emerald-600 border-emerald-500/30' : ''}`}>
                                {acc.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">
                              {acc.last_scanned_at ? new Date(acc.last_scanned_at).toLocaleString() : 'Never'}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">
                              {new Date(acc.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
                      {gmailData?.total ?? 0} connected account{(gmailData?.total ?? 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* FEEDBACK */}
        {tab === 'feedback' && (
          <div className="space-y-4">
            {loadingFeedback ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : !feedback?.length ? (
              <div className="p-12 text-center text-muted-foreground">No feedback submitted yet.</div>
            ) : (
              (feedback as any[]).map((f) => {
                const icons: Record<string, React.ElementType> = {
                  feedback: MessageSquare, feature_request: Lightbulb, bug_report: Bug, support: LifeBuoy,
                }
                const Icon = icons[f.type as string] ?? MessageSquare
                return (
                  <Card key={f.id}>
                    <CardContent className="p-4 flex gap-4 items-start">
                      <div className="p-2 bg-secondary rounded-lg shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className="text-xs capitalize">{(f.type as string)?.replace(/_/g, ' ')}</Badge>
                          <Badge variant={f.status === 'open' ? 'secondary' : 'outline'} className="text-xs">{f.status}</Badge>
                          <span className="text-xs text-muted-foreground">{f.profiles?.email ?? f.profiles?.full_name ?? 'Unknown user'}</span>
                          <span className="text-xs text-muted-foreground">{new Date(f.created_at as string).toLocaleDateString()}</span>
                        </div>
                        {f.subject && <p className="text-sm font-medium mb-1">{f.subject as string}</p>}
                        <p className="text-sm text-muted-foreground leading-relaxed">{(f.body ?? f.message) as string}</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
