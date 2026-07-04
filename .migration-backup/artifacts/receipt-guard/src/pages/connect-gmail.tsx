import { useState } from 'react'
import { useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, Mail, Lock, CheckCircle2, Loader2, Trash2, RefreshCw } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

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
  return res.json()
}

function useGmailAccounts() {
  return useQuery({ queryKey: ['gmail', 'accounts'], queryFn: () => apiFetch('/api/gmail/accounts'), retry: false })
}

export default function ConnectGmailPage() {
  const [, setLocation] = useLocation()
  const qc = useQueryClient()
  const [connecting, setConnecting] = useState(false)
  const [scanning, setScanning] = useState<string | null>(null)

  const { data: accounts = [], isLoading } = useGmailAccounts()

  const disconnect = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/gmail/accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gmail'] }); toast.success('Gmail disconnected') },
    onError: (e: any) => toast.error(e.message),
  })

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const { url } = await apiFetch('/api/gmail/auth-url')
      window.location.href = url
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to get Gmail authorization URL')
      setConnecting(false)
    }
  }

  const handleScan = async (accountId: string) => {
    setScanning(accountId)
    try {
      const result = await apiFetch('/api/gmail/scan', { method: 'POST', body: JSON.stringify({ accountId, forceRescan: false }) })
      toast.success(result?.message ?? 'Scan started')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setScanning(null)
    }
  }

  const hasAccounts = accounts.length > 0

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary mb-6 border border-border">
            <Mail className="w-8 h-8 text-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">Connect your inbox</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Give ReceiptGuard read-only Gmail access to automatically detect receipts, subscriptions, and warranties.
          </p>
        </div>

        {/* Connected accounts */}
        {!isLoading && hasAccounts && (
          <div className="mb-8 space-y-3">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Connected accounts</p>
            {accounts.map((acc: any) => (
              <Card key={acc.id} className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{acc.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Connected {acc.created_at ? new Date(acc.created_at).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5"
                      onClick={() => handleScan(acc.id)}
                      disabled={scanning === acc.id}
                    >
                      {scanning === acc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Scan
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-destructive hover:bg-destructive/10"
                      onClick={() => disconnect.mutate(acc.id)}
                      disabled={disconnect.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={handleConnect} disabled={connecting}>
                {connecting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting…</> : '+ Add another account'}
              </Button>
              <Button onClick={() => setLocation('/dashboard')}>Go to Dashboard</Button>
            </div>
          </div>
        )}

        {/* Feature cards - show when no accounts yet */}
        {!hasAccounts && (
          <>
            <div className="grid gap-4 mb-10">
              {[
                {
                  icon: ShieldCheck, title: 'Strictly Read-Only',
                  desc: 'We cannot send, delete, or modify any emails. Our systems only extract data from emails matching known receipt formats.',
                },
                {
                  icon: Lock, title: 'Bank-level Encryption',
                  desc: 'Your credentials are never stored. We use secure OAuth tokens and encrypt all extracted financial data at rest.',
                },
                {
                  icon: CheckCircle2, title: 'Zero Personal Email Scanning',
                  desc: 'Our algorithm explicitly ignores emails from personal contacts. We only process emails from recognized merchants and payment processors.',
                },
              ].map(({ icon: Icon, title, desc }) => (
                <Card key={title} className="bg-card/50 border-border">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="outline" size="lg" className="rounded-full px-8 h-12" onClick={() => setLocation('/dashboard')}>
                Skip for now
              </Button>
              <Button size="lg" className="rounded-full px-8 h-12 font-semibold" onClick={handleConnect} disabled={connecting}>
                {connecting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting to Google…</> : 'Connect Gmail'}
              </Button>
            </div>
          </>
        )}

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  )
}
