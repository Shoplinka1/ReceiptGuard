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
  AlertTriangle, CheckCircle2,
} from 'lucide-react'

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

export default function AdminPage() {
  const [tab, setTab] = useState<'overview' | 'users' | 'payments' | 'feedback'>('overview')
  const [search, setSearch] = useState('')
  const qc = useQueryClient()

  const { data: stats, isLoading: loadingStats, error: statsError } = useAdminStats()
  // Backend wraps users in { users: [...], total, page, pageSize }
  const { data: usersData, isLoading: loadingUsers } = useAdminUsers(search)
  const users = usersData?.users ?? []
  const { data: payments, isLoading: loadingPayments } = useAdminPayments()
  const { data: feedback, isLoading: loadingFeedback } = useAdminFeedback()

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
    { id: 'feedback' as const, label: 'Feedback' },
  ]

  // Backend stat keys: totalUsers, newUsers30d, payingUsers, mrr, arr, conversionRate,
  // totalReceipts, connectedGmailAccounts, openFeedbackCount
  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers, icon: Users },
    { label: 'Paying Users', value: stats?.payingUsers, icon: CheckCircle2 },
    { label: 'MRR', value: stats?.mrr != null ? `$${(stats.mrr as number).toFixed(2)}` : null, icon: DollarSign },
    { label: 'ARR', value: stats?.arr != null ? `$${(stats.arr as number).toFixed(2)}` : null, icon: TrendingUp },
    { label: 'New (30d)', value: stats?.newUsers30d, icon: Activity },
    { label: 'Conversion', value: stats?.conversionRate != null ? `${(stats.conversionRate as number).toFixed(1)}%` : null, icon: TrendingUp },
    { label: 'Gmail Accounts', value: stats?.connectedGmailAccounts, icon: Mail },
    { label: 'Open Feedback', value: stats?.openFeedbackCount, icon: RefreshCw },
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
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs capitalize">
                            {(f.type as string)?.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {f.profiles?.email ?? 'Unknown user'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(f.created_at as string).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">{f.message as string}</p>
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
