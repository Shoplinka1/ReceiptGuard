import React, { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetUserSettings, useUpdateUserSettings, useGetUserProfile } from '@workspace/api-client-react'
import { useTheme } from '@/components/theme-provider'
import { useAuth } from '@/hooks/use-auth'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2, CheckCircle2, Trash2, Mail, AlertTriangle, RefreshCw,
  Sparkles, CreditCard, ChevronDown, ChevronUp, ExternalLink, LogOut,
  User, Globe, Palette, Shield, HelpCircle, MessageSquare,
} from 'lucide-react'
import { useLocation, Link } from 'wouter'

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
    throw new Error((body as any)?.error ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ─── Types ───────────────────────────────────────────────────────────────────

type FeedbackType = 'feedback' | 'feature_request' | 'bug_report' | 'support'

// ─── Gmail Accounts Tab ──────────────────────────────────────────────────────

function GmailTab() {
  const qc = useQueryClient()
  const { data: accounts, isLoading, refetch } = useQuery({
    queryKey: ['gmail-accounts'],
    queryFn: () => apiFetch('/api/gmail/accounts'),
    retry: false,
  })

  const connectMutation = useMutation({
    mutationFn: () => apiFetch('/api/gmail/auth-url'),
    onSuccess: (data: any) => { if (data?.url) window.location.href = data.url },
    onError: (e: any) => toast.error(e.message?.includes('limit') ? 'Free plan allows 1 Gmail account. Upgrade to Pro for unlimited.' : e.message),
  })

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/gmail/accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Gmail account disconnected')
      qc.invalidateQueries({ queryKey: ['gmail-accounts'] })
      refetch()
    },
    onError: (e: any) => toast.error(e.message),
  })

  const scanMutation = useMutation({
    mutationFn: (id: string) => apiFetch('/api/gmail/scan', { method: 'POST', body: JSON.stringify({ accountId: id }) }),
    onSuccess: (data: any) => {
      toast.success(`Scan complete: ${data?.receiptsFound ?? 0} new receipts found`)
      qc.invalidateQueries({ queryKey: ['receipts'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <div className="space-y-6 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Connected Gmail Accounts</CardTitle>
          <CardDescription>
            ReceiptGuard scans connected accounts for receipts, invoices, and subscription confirmations.
            Read-only access — we never modify your email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading accounts…
            </div>
          ) : !(accounts as any[])?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No Gmail accounts connected</p>
              <p className="text-xs mt-1">Connect your Gmail to start scanning for receipts automatically.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {(accounts as any[]).map((acc: any) => (
                <div key={acc.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{acc.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Last scanned: {acc.lastSyncAt ? new Date(acc.lastSyncAt).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                    {acc.isActive && <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30 bg-emerald-500/5">Active</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => scanMutation.mutate(acc.id)} disabled={scanMutation.isPending}>
                      {scanMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span className="ml-1.5 hidden sm:inline">Scan now</span>
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive" onClick={() => disconnectMutation.mutate(acc.id)} disabled={disconnectMutation.isPending}>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="ml-1.5 hidden sm:inline">Disconnect</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending} className="mt-2">
            {connectMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Connecting…</> : '+ Connect Gmail Account'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Billing Tab ─────────────────────────────────────────────────────────────

const PRO_FEATURES = [
  'Unlimited Gmail accounts', 'Unlimited receipts & subscriptions',
  'Unlimited reminders', 'Warranty & return tracking',
  'CSV & PDF export', 'Spending reports & analytics',
  'Advanced filters & categories', 'Priority support',
]

const MONTHLY_USD = 5.99
const YEARLY_USD = 59.99
const YEARLY_SAVINGS_PCT = Math.round((1 - YEARLY_USD / (MONTHLY_USD * 12)) * 100)

function BillingTab() {
  const { data: profile, isLoading: loadingProfile, refetch: refetchProfile } = useGetUserProfile()
  const isPro = profile?.plan === 'pro'
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [initError, setInitError] = useState<string | null>(null)
  const qc = useQueryClient()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (!ref) return
    const url = new URL(window.location.href)
    url.searchParams.delete('ref')
    window.history.replaceState({}, '', url.toString())
    apiFetch(`/api/paystack/verify/${encodeURIComponent(ref)}`)
      .then((data: any) => {
        if (data?.status === 'success') {
          toast.success('Payment confirmed! Your plan has been upgraded to Pro.')
          refetchProfile()
          qc.invalidateQueries({ queryKey: ['payments', 'history'] })
        } else {
          toast.info('Payment is being processed. Your plan will update shortly.')
        }
      })
      .catch(() => toast.error('Could not verify payment. Contact support if your plan is not updated.'))
  }, [])

  const { data: paymentHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ['payments', 'history'],
    queryFn: () => apiFetch('/api/paystack/payments'),
    retry: false,
  })

  const { data: subscription } = useQuery({
    queryKey: ['paystack-subscription'],
    queryFn: () => apiFetch('/api/paystack/subscription'),
    retry: false,
  })

  const initCheckout = useMutation({
    mutationFn: () => apiFetch('/api/paystack/initialize', {
      method: 'POST',
      body: JSON.stringify({ planId: 'pro', billingCycle, frontendUrl: window.location.origin }),
    }),
    onSuccess: (data: any) => {
      if (data?.authorizationUrl) window.location.href = data.authorizationUrl
      else toast.error('No checkout URL returned from payment provider.')
    },
    onError: (e: any) => { setInitError(e.message); toast.error(e.message) },
  })

  const cancelSub = useMutation({
    mutationFn: () => apiFetch('/api/paystack/cancel', { method: 'POST' }),
    onSuccess: () => { toast.success('Subscription cancelled. You keep Pro until the end of the billing period.'); refetchProfile() },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <div className="space-y-6 mt-6">
      <Card className={`border-primary/40 relative overflow-hidden ${isPro ? 'bg-gradient-to-br from-primary/5 to-background' : ''}`}>
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none"><Sparkles className="w-24 h-24" /></div>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          {loadingProfile ? <Skeleton className="h-4 w-48" /> : (
            <CardDescription>You are on the <strong className="text-foreground capitalize">{profile?.plan || 'Free'}</strong> plan.</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isPro && subscription && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Status: <Badge className="ml-1">Active</Badge></p>
              {subscription.current_period_end && (
                <p>Renews: <span className="text-foreground font-medium">{new Date(subscription.current_period_end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
              )}
            </div>
          )}

          {!isPro ? (
            <div className="space-y-4">
              <div className="inline-flex bg-secondary rounded-lg p-1 gap-1">
                <button onClick={() => setBillingCycle('monthly')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${billingCycle === 'monthly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Monthly</button>
                <button onClick={() => setBillingCycle('yearly')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${billingCycle === 'yearly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  Yearly
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/40 text-primary bg-primary/5">Save {YEARLY_SAVINGS_PCT}%</Badge>
                </button>
              </div>

              <div className="bg-secondary/50 rounded-xl p-5 border border-border">
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-bold">${billingCycle === 'yearly' ? YEARLY_USD : MONTHLY_USD}</span>
                  <span className="text-muted-foreground mb-1">{billingCycle === 'yearly' ? '/year' : '/month'}</span>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-xs text-muted-foreground mb-3">${(YEARLY_USD / 12).toFixed(2)}/month · billed annually</p>
                )}
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  {PRO_FEATURES.map(ft => (
                    <li key={ft} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />{ft}
                    </li>
                  ))}
                </ul>
                {initError && (
                  <div className="flex items-center gap-2 mb-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{initError}
                  </div>
                )}
                <Button size="lg" className="w-full sm:w-auto" onClick={() => { setInitError(null); initCheckout.mutate() }} disabled={initCheckout.isPending}>
                  {initCheckout.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redirecting to checkout…</> : `Upgrade to Pro — $${billingCycle === 'yearly' ? YEARLY_USD : MONTHLY_USD}${billingCycle === 'yearly' ? '/yr' : '/mo'}`}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => initCheckout.mutate()} disabled={initCheckout.isPending}>Manage Subscription</Button>
              <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive" onClick={() => cancelSub.mutate()} disabled={cancelSub.isPending}>
                {cancelSub.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling…</> : 'Cancel Subscription'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
            <p className="text-center py-6 text-muted-foreground text-sm">No payment history yet.</p>
          ) : (
            <div className="space-y-1">
              {(paymentHistory as any[]).map((p: any) => (
                <div key={p.id} className="flex justify-between items-center py-3 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-sm">{p.plan_id ? `ReceiptGuard ${p.plan_id}` : 'ReceiptGuard'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={p.status === 'success' ? 'default' : 'destructive'} className="text-xs capitalize">{p.status}</Badge>
                    <span className="font-mono font-medium text-sm">${Number(p.amount).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── General Tab ─────────────────────────────────────────────────────────────

function GeneralTab() {
  const { data: settings } = useGetUserSettings()
  const updateSettings = useUpdateUserSettings()

  return (
    <div className="space-y-6 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Regional Preferences</CardTitle>
          <CardDescription>Set your default currency, timezone, and language.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Language</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={(settings as any)?.language || 'en'}
              onChange={e => updateSettings.mutate({ data: { language: e.target.value } as any })}>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
              <option value="de">Deutsch</option>
              <option value="pt">Português</option>
              <option value="yo">Yorùbá</option>
              <option value="ig">Igbo</option>
              <option value="ha">Hausa</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Default Currency</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={settings?.currency || 'USD'}
              onChange={e => updateSettings.mutate({ data: { currency: e.target.value } })}>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="NGN">NGN (₦)</option>
              <option value="CAD">CAD (C$)</option>
              <option value="AUD">AUD (A$)</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Timezone</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={settings?.timezone || 'UTC'}
              onChange={e => updateSettings.mutate({ data: { timezone: e.target.value } })}>
              <option value="UTC">UTC</option>
              <option value="Africa/Lagos">West Africa Time (WAT)</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Paris">Central European Time (CET)</option>
              <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
              <option value="Australia/Sydney">Australian Eastern Time (AEST)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Choose how you receive renewal and warranty alerts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Email Notifications</p>
              <p className="text-xs text-muted-foreground">Receive reminders and alerts via email</p>
            </div>
            <Switch checked={settings?.emailNotifications ?? true} onCheckedChange={v => updateSettings.mutate({ data: { emailNotifications: v } })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Browser Notifications</p>
              <p className="text-xs text-muted-foreground">Receive push notifications in your browser</p>
            </div>
            <Switch checked={settings?.browserNotifications ?? true} onCheckedChange={v => updateSettings.mutate({ data: { browserNotifications: v } })} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Appearance Tab ───────────────────────────────────────────────────────────

function AppearanceTab() {
  const { theme, setTheme } = useTheme()
  const updateSettings = useUpdateUserSettings()

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    updateSettings.mutate({ data: { theme: newTheme } })
  }

  return (
    <div className="space-y-6 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Select your preferred color scheme.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {(['light', 'dark', 'system'] as const).map(t => (
            <Button key={t} variant={theme === t ? 'default' : 'outline'} onClick={() => handleThemeChange(t)} className="capitalize min-w-[120px]">
              {t === 'light' ? '☀️ Light Mode' : t === 'dark' ? '🌙 Dark Mode' : '⚙️ System Default'}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const { updatePassword, signOut } = useAuth()
  const [, setLocation] = useLocation()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return }
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setChangingPassword(true)
    try {
      await updatePassword(newPassword)
      toast.success('Password updated successfully')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? 'Failed to update password')
    } finally {
      setChangingPassword(false)
    }
  }

  const deleteAccount = useMutation({
    mutationFn: () => apiFetch('/api/user/account', { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success('Account deleted. Goodbye!')
      await signOut()
      setLocation('/')
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to delete account'),
  })

  return (
    <div className="space-y-6 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password. Must be at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-sm">
            <div className="grid gap-2">
              <label className="text-sm font-medium">New Password</label>
              <Input type="password" minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Confirm New Password</label>
              <Input type="password" minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating…</> : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>These actions are permanent and cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showDeleteConfirm ? (
            <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete Account
            </Button>
          ) : (
            <div className="space-y-4 p-4 bg-destructive/5 border border-destructive/20 rounded-lg max-w-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Delete your account?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This permanently deletes all your receipts, subscriptions, warranties, and account data. This <strong>cannot</strong> be undone.
                  </p>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block">Type <strong>DELETE</strong> to confirm</label>
                <Input placeholder="DELETE" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} className="font-mono" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirm('') }}>Cancel</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteConfirm !== 'DELETE' || deleteAccount.isPending}
                  onClick={() => deleteAccount.mutate()}
                >
                  {deleteAccount.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</> : 'Delete My Account'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Support Tab ─────────────────────────────────────────────────────────────

const feedbackTypes: { value: FeedbackType; label: string; placeholder: string }[] = [
  { value: 'feedback', label: 'General Feedback', placeholder: 'Share your thoughts about ReceiptGuard…' },
  { value: 'feature_request', label: 'Feature Request', placeholder: 'Describe the feature you would like to see…' },
  { value: 'bug_report', label: 'Bug Report', placeholder: 'Describe the bug, steps to reproduce, and expected behavior…' },
  { value: 'support', label: 'Contact Support', placeholder: 'Describe your issue and we will get back to you…' },
]

const faqItems = [
  { q: 'How does ReceiptGuard scan my Gmail?', a: 'We use read-only Gmail access to search for receipts, invoices, and order confirmations. We never read personal emails or modify your inbox.' },
  { q: 'Is my data secure?', a: 'Yes. All data is encrypted at rest and in transit. Gmail tokens are stored securely and never shared. We use Supabase with row-level security.' },
  { q: 'What happens when my Pro subscription expires?', a: 'Your account is automatically downgraded to the Free plan. You retain access to your existing data, but premium features become unavailable until you renew.' },
  { q: 'Can I cancel my subscription at any time?', a: 'Yes. Cancel anytime from Settings → Billing. You keep Pro access until the end of your current billing period.' },
  { q: 'How do I upgrade from Free to Pro?', a: 'Go to Settings → Billing and click Upgrade to Pro. We accept payment via Paystack. Pro is $5.99/month or $59.99/year.' },
  { q: 'What currencies does ReceiptGuard support for tracking?', a: 'ReceiptGuard tracks receipts in any currency. Your display currency can be set in Settings → General. Pro billing is in USD.' },
]

function SupportTab() {
  const { signOut } = useAuth()
  const [, setLocation] = useLocation()
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feedback')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const submitFeedback = useMutation({
    mutationFn: () => apiFetch('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ type: feedbackType, subject: subject.trim() || feedbackTypes.find(t => t.value === feedbackType)!.label, body: message.trim() }),
    }),
    onSuccess: () => { setSent(true); setSubject(''); setMessage('') },
    onError: (e: Error) => toast.error(e.message),
  })

  const cfg = feedbackTypes.find(t => t.value === feedbackType)!

  return (
    <div className="space-y-6 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Send a Message</CardTitle>
          <CardDescription>Submit feedback, report a bug, request a feature, or contact support. We'll respond to your registered email.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-primary" />
              <div>
                <p className="text-lg font-semibold">Message sent!</p>
                <p className="text-sm text-muted-foreground mt-1">We received your {cfg.label.toLowerCase()} and will follow up if needed.</p>
              </div>
              <Button variant="outline" onClick={() => setSent(false)}>Send another</Button>
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); if (message.trim()) submitFeedback.mutate() }} className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Type</label>
                <div className="flex flex-wrap gap-2">
                  {feedbackTypes.map(t => (
                    <button key={t.value} type="button" onClick={() => setFeedbackType(t.value)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${feedbackType === t.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Subject <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Input placeholder={cfg.label} value={subject} onChange={e => setSubject(e.target.value)} maxLength={120} disabled={submitFeedback.isPending} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea placeholder={cfg.placeholder} value={message} onChange={e => setMessage(e.target.value)} rows={5} required className="resize-none" disabled={submitFeedback.isPending} />
              </div>
              <Button type="submit" disabled={submitFeedback.isPending || !message.trim()}>
                {submitFeedback.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : `Submit ${cfg.label}`}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {faqItems.map((item, i) => (
            <div key={i} className="border border-border rounded-lg overflow-hidden">
              <button className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left hover:bg-secondary/50 transition-colors" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                {item.q}
                {openFaq === i ? <ChevronUp className="w-4 h-4 shrink-0 ml-2 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 shrink-0 ml-2 text-muted-foreground" />}
              </button>
              {openFaq === i && (
                <div className="px-4 pb-3 text-sm text-muted-foreground border-t border-border">{item.a}</div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link href="/privacy">
            <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
              <span className="text-sm font-medium">Privacy Policy</span>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </div>
          </Link>
          <Link href="/terms">
            <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
              <span className="text-sm font-medium">Terms of Service</span>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </div>
          </Link>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Signed in to ReceiptGuard</p>
          <p className="text-xs text-muted-foreground mt-0.5">Signing out will clear your local session.</p>
        </div>
        <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          onClick={async () => { await signOut(); setLocation('/') }}>
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </div>
    </div>
  )
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab() {
  const { data: profile, isLoading, refetch } = useGetUserProfile()
  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if ((profile as any)?.name) setFullName((profile as any).name)
  }, [(profile as any)?.name])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await apiFetch('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: fullName }),
      })
      toast.success('Profile updated')
      refetch()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <div className="mt-6 space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>

  return (
    <div className="space-y-6 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your display name. Your email is managed by your authentication provider.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4 max-w-sm">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Full Name</label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Email</label>
              <Input value={(profile as any)?.email ?? ''} disabled className="opacity-60" />
              <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Plan</label>
              <div className="flex items-center gap-2">
                <Badge variant={profile?.plan === 'pro' ? 'default' : 'outline'} className="capitalize">{profile?.plan || 'Free'}</Badge>
                {profile?.plan !== 'pro' && <span className="text-xs text-muted-foreground">— Upgrade in the Billing tab</span>}
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

const TABS = [
  { value: 'profile', label: 'Profile', icon: User },
  { value: 'gmail', label: 'Gmail', icon: Mail },
  { value: 'billing', label: 'Billing', icon: CreditCard },
  { value: 'general', label: 'General', icon: Globe },
  { value: 'appearance', label: 'Appearance', icon: Palette },
  { value: 'security', label: 'Security', icon: Shield },
  { value: 'support', label: 'Help & Support', icon: HelpCircle },
]

export default function SettingsPage() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const defaultTab = params.get('tab') ?? 'profile'

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your profile, billing, preferences, and support.</p>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="flex w-full overflow-x-auto gap-0 h-auto p-1">
            {TABS.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
                <tab.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="profile"><ProfileTab /></TabsContent>
          <TabsContent value="gmail"><GmailTab /></TabsContent>
          <TabsContent value="billing"><BillingTab /></TabsContent>
          <TabsContent value="general"><GeneralTab /></TabsContent>
          <TabsContent value="appearance"><AppearanceTab /></TabsContent>
          <TabsContent value="security"><SecurityTab /></TabsContent>
          <TabsContent value="support"><SupportTab /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
