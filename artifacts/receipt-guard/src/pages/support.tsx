import { useState } from 'react'
import { Link } from 'wouter'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MessageSquare, Mail, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || ''

async function getAuthToken() {
  const { supabase } = await import('@/lib/supabase')
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const FAQ = [
  {
    q: 'How do I connect my Gmail account?',
    a: 'Go to Settings → Gmail Accounts (or click "Connect Gmail" on your dashboard banner) and click "Connect Gmail". You\'ll be taken to Google\'s consent screen. ReceiptGuard only requests read-only access.',
  },
  {
    q: 'What emails does ReceiptGuard scan?',
    a: 'Only emails matching known receipt, invoice, and order confirmation patterns — things like "Your order is confirmed", "Receipt from Amazon", or "Invoice #12345". Personal conversations are never scanned.',
  },
  {
    q: 'How do I upgrade to Pro?',
    a: 'Go to Billing (in the sidebar) and click "Upgrade to Pro". You\'ll be taken to a secure Paystack checkout. After payment, your account upgrades instantly.',
  },
  {
    q: 'How do I cancel my Pro subscription?',
    a: 'Go to Billing and click "Cancel Subscription". You retain Pro access until the end of the current billing period, then automatically revert to the Free plan.',
  },
  {
    q: 'Why is my Gmail not connecting?',
    a: 'Make sure you\'re allowing read-only access on the Google consent screen. If you see a redirect error, ensure the redirect URI in your Google Cloud Console matches exactly. Contact support if the issue persists.',
  },
  {
    q: 'Is my payment information safe?',
    a: 'Yes. ReceiptGuard uses Paystack for all payments. We never see or store your card details.',
  },
  {
    q: 'Can I export my data?',
    a: 'CSV and PDF export are Pro features, available from Settings → Data.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Go to Settings → Data → Danger Zone and click "Delete Account". This permanently removes all your data. This action cannot be undone.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span>{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
          {a}
        </div>
      )}
    </div>
  )
}

export default function SupportPage() {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const submit = useMutation({
    mutationFn: async () => {
      const token = await getAuthToken()
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 'support', subject: subject.trim(), body: message.trim() }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error((b as any)?.error ?? 'Failed to send')
      }
      return res.json()
    },
    onSuccess: () => { setSent(true); setSubject(''); setMessage('') },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-10">
        <header className="pb-4 border-b border-border">
          <h1 className="text-3xl font-bold tracking-tight mb-1">Support</h1>
          <p className="text-muted-foreground">Get help with ReceiptGuard. We read every message.</p>
        </header>

        {/* Quick links */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Link href="/billing">
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors h-full">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Billing & Subscriptions</p>
                  <p className="text-xs text-muted-foreground mt-1">View plans, invoices, cancel or upgrade</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/feedback">
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors h-full">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Send Feedback</p>
                  <p className="text-xs text-muted-foreground mt-1">Feature requests, bug reports, general ideas</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Frequently asked questions</h2>
          <div className="space-y-2">
            {FAQ.map(item => <FaqItem key={item.q} {...item} />)}
          </div>
        </div>

        {/* Contact form */}
        <Card>
          <CardHeader>
            <CardTitle>Contact support</CardTitle>
            <CardDescription>Still need help? Send us a message and we'll get back to you.</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-primary" />
                <p className="font-semibold">Message sent!</p>
                <p className="text-sm text-muted-foreground">We'll reply to your registered email within 1–2 business days.</p>
                <Button variant="outline" onClick={() => setSent(false)}>Send another</Button>
              </div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); if (subject.trim() && message.trim()) submit.mutate() }} className="space-y-4 max-w-lg">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Subject</label>
                  <Input
                    placeholder="Brief description of your issue"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    maxLength={120}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Message</label>
                  <Textarea
                    placeholder="Describe your issue in detail…"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={5}
                    className="resize-none"
                    required
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={submit.isPending || !subject.trim() || !message.trim()}>
                    {submit.isPending ? 'Sending…' : 'Send message'}
                  </Button>
                  <Badge variant="outline" className="text-xs text-muted-foreground">Replies within 1–2 business days</Badge>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
