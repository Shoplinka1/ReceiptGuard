import React, { useState } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useGetUserSettings, useUpdateUserSettings } from '@workspace/api-client-react'
import { useTheme } from '@/components/theme-provider'
import { useAuth } from '@/hooks/use-auth'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, CheckCircle2 } from 'lucide-react'

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
  return res.json()
}

type FeedbackType = 'feedback' | 'feature_request' | 'bug_report' | 'support'

const feedbackTypes: { value: FeedbackType; label: string; description: string; placeholder: string }[] = [
  {
    value: 'feedback',
    label: 'General Feedback',
    description: 'Help us improve ReceiptGuard with your thoughts.',
    placeholder: 'Share your thoughts about ReceiptGuard…',
  },
  {
    value: 'feature_request',
    label: 'Feature Request',
    description: 'Tell us what feature would make ReceiptGuard better for you.',
    placeholder: 'Describe the feature you would like to see…',
  },
  {
    value: 'bug_report',
    label: 'Bug Report',
    description: 'Found something broken? Let us know so we can fix it.',
    placeholder: 'Describe the bug, steps to reproduce, and expected behavior…',
  },
  {
    value: 'support',
    label: 'Contact Support',
    description: 'Need help? Our team will get back to you as soon as possible.',
    placeholder: 'Describe your issue and we will get back to you…',
  },
]

function FeedbackForm({ type }: { type: FeedbackType }) {
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const cfg = feedbackTypes.find(t => t.value === type)!

  const submit = useMutation({
    mutationFn: () => apiFetch('/api/feedback', { method: 'POST', body: JSON.stringify({ type, message }) }),
    onSuccess: () => { setSent(true); setMessage('') },
    onError: (e: Error) => toast.error(e.message),
  })

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <CheckCircle2 className="w-12 h-12 text-primary" />
        <div>
          <p className="text-lg font-semibold">Thank you!</p>
          <p className="text-sm text-muted-foreground mt-1">Your {cfg.label.toLowerCase()} has been submitted.</p>
        </div>
        <Button variant="outline" onClick={() => setSent(false)}>Send another</Button>
      </div>
    )
  }

  return (
    <form onSubmit={e => { e.preventDefault(); if (message.trim()) submit.mutate() }} className="space-y-4">
      <Textarea
        placeholder={cfg.placeholder}
        value={message}
        onChange={e => setMessage(e.target.value)}
        rows={6}
        required
        className="resize-none"
        disabled={submit.isPending}
      />
      <Button type="submit" disabled={submit.isPending || !message.trim()}>
        {submit.isPending
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
          : `Submit ${cfg.label}`}
      </Button>
    </form>
  )
}

export default function SettingsPage() {
  const { data: settings } = useGetUserSettings()
  const updateSettings = useUpdateUserSettings()
  const { theme, setTheme } = useTheme()
  const { updatePassword } = useAuth()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    updateSettings.mutate({ data: { theme: newTheme } })
  }

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

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your preferences, security, and support.</p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="flex w-full overflow-x-auto lg:w-auto">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>

          {/* GENERAL */}
          <TabsContent value="general" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Regional Preferences</CardTitle>
                <CardDescription>Set your default currency and timezone.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Default Currency</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={settings?.currency || 'USD'}
                    onChange={e => updateSettings.mutate({ data: { currency: e.target.value } })}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="NGN">NGN (₦)</option>
                    <option value="CAD">CAD (C$)</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Timezone</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={settings?.timezone || 'UTC'}
                    onChange={e => updateSettings.mutate({ data: { timezone: e.target.value } })}
                  >
                    <option value="UTC">UTC</option>
                    <option value="Africa/Lagos">West Africa Time (WAT)</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">London (GMT)</option>
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
                  <Switch
                    checked={settings?.emailNotifications ?? true}
                    onCheckedChange={v => updateSettings.mutate({ data: { emailNotifications: v } })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Browser Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive push notifications in your browser</p>
                  </div>
                  <Switch
                    checked={settings?.browserNotifications ?? true}
                    onCheckedChange={v => updateSettings.mutate({ data: { browserNotifications: v } })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* APPEARANCE */}
          <TabsContent value="appearance" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Theme</CardTitle>
                <CardDescription>Select your preferred color scheme.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                {(['light', 'dark', 'system'] as const).map(t => (
                  <Button
                    key={t}
                    variant={theme === t ? 'default' : 'outline'}
                    onClick={() => handleThemeChange(t)}
                    className="capitalize"
                  >
                    {t === 'system' ? 'System Default' : `${t} Mode`}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SECURITY */}
          <TabsContent value="security" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your account password. Must be at least 8 characters.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-sm">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">New Password</label>
                    <Input
                      type="password"
                      minLength={8}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Confirm New Password</label>
                    <Input
                      type="password"
                      minLength={8}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={changingPassword}>
                    {changingPassword
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating…</>
                      : 'Update Password'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DATA */}
          <TabsContent value="data" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Export Data</CardTitle>
                <CardDescription>Download all your receipts, subscriptions, and warranties.</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button variant="outline" disabled>
                  Export as CSV <span className="ml-2 text-xs text-muted-foreground">(Pro)</span>
                </Button>
                <Button variant="outline" disabled>
                  Export as PDF <span className="ml-2 text-xs text-muted-foreground">(Pro)</span>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>These actions are permanent and cannot be undone.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  disabled
                >
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FEEDBACK */}
          <TabsContent value="feedback" className="mt-6">
            <Tabs defaultValue="feedback" className="w-full">
              <TabsList className="flex w-full overflow-x-auto lg:w-auto">
                {feedbackTypes.map(t => (
                  <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
                ))}
              </TabsList>
              {feedbackTypes.map(t => (
                <TabsContent key={t.value} value={t.value} className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t.label}</CardTitle>
                      <CardDescription>{t.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FeedbackForm type={t.value} />
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
