import { useState } from 'react'
import { Link } from 'wouter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, ChevronDown, ChevronUp, Mail, MessageSquare, ShieldCheck } from 'lucide-react'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || ''

const FAQ = [
  {
    q: 'How do I connect my Gmail account?',
    a: "Go to Settings → Gmail Accounts (or click "Connect Gmail" on your dashboard) and click "Connect Gmail". You'll be taken to Google's consent screen. ReceiptGuard only requests read-only access — we never read personal conversations.",
  },
  {
    q: 'What emails does ReceiptGuard scan?',
    a: 'Only emails matching known receipt, invoice, and purchase confirmation patterns — e.g. "Your order is confirmed", "Receipt from Amazon", or "Invoice #12345". Personal conversations, newsletters, and promotions are never scanned.',
  },
  {
    q: 'How do I upgrade to Pro?',
    a: "Go to Billing (in the sidebar) and click "Upgrade to Pro". You'll be taken to a secure Paystack checkout. After payment, your account upgrades instantly.",
  },
  {
    q: 'How do I cancel my Pro subscription?',
    a: 'Go to Billing and click "Cancel Subscription". You retain Pro access until the end of the current billing period, then automatically revert to the Free plan.',
  },
  {
    q: 'Why is my Gmail not connecting?',
    a: 'Make sure you allow read-only access on the Google consent screen. If you see a redirect error, contact us at receiptguard01@gmail.com with the error message and we\'ll help you resolve it.',
  },
  {
    q: 'Is my payment information safe?',
    a: 'Yes. All payments are processed by Paystack. ReceiptGuard never sees or stores your card details.',
  },
  {
    q: 'Can I export my data?',
    a: 'CSV and PDF export are available on the Pro plan from Settings → Data.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Go to Settings → Security → Danger Zone and click "Delete Account". This permanently removes all your data and cannot be undone.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span>{q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 pt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100">
          {a}
        </div>
      )}
    </div>
  )
}

export default function SupportPage() {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    setStatus('sending')
    try {
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'support', subject: subject.trim(), body: message.trim() }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error((b as any)?.error ?? 'Failed to send message')
      }
      setStatus('sent')
      setSubject('')
      setMessage('')
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Something went wrong')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Minimal public header — no auth required */}
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              R
            </div>
            <span className="font-bold text-lg text-gray-900 tracking-tight">ReceiptGuard</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-sm text-gray-600">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16 space-y-14">
        {/* Page title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Support Center</h1>
          <p className="text-lg text-gray-500">Get help with ReceiptGuard. We read and respond to every message.</p>
        </div>

        {/* Quick contact cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          <a
            href="mailto:receiptguard01@gmail.com"
            className="flex flex-col items-center gap-3 p-6 border border-gray-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors text-center"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900">Email Us</p>
              <p className="text-xs text-gray-500 mt-0.5">receiptguard01@gmail.com</p>
            </div>
          </a>

          <div className="flex flex-col items-center gap-3 p-6 border border-gray-200 rounded-xl text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900">Contact Form</p>
              <p className="text-xs text-gray-500 mt-0.5">Response within 1–2 business days</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 p-6 border border-gray-200 rounded-xl text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900">Privacy & Data</p>
              <p className="text-xs text-gray-500 mt-0.5">
                <Link href="/privacy" className="text-emerald-600 hover:underline">Privacy Policy</Link>
                {' · '}
                <Link href="/terms" className="text-emerald-600 hover:underline">Terms</Link>
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-5">Frequently asked questions</h2>
          <div className="space-y-2">
            {FAQ.map(item => <FaqItem key={item.q} {...item} />)}
          </div>
        </section>

        {/* Contact form */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-5">Send a message</h2>
          <div className="border border-gray-200 rounded-xl p-8">
            {status === 'sent' ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                <div>
                  <p className="font-semibold text-gray-900">Message sent!</p>
                  <p className="text-sm text-gray-500 mt-1">We'll reply to your email within 1–2 business days.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setStatus('idle')}>Send another</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Subject</label>
                  <Input
                    placeholder="Brief description of your issue"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    maxLength={120}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Message</label>
                  <Textarea
                    placeholder="Describe your issue in detail…"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={5}
                    className="resize-none"
                    required
                  />
                </div>
                {status === 'error' && (
                  <p className="text-sm text-red-600">{errorMsg} — or email us directly at receiptguard01@gmail.com</p>
                )}
                <div className="flex items-center gap-3">
                  <Button
                    type="submit"
                    disabled={status === 'sending' || !subject.trim() || !message.trim()}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    {status === 'sending' ? 'Sending…' : 'Send message'}
                  </Button>
                  <Badge variant="outline" className="text-xs text-gray-500">Replies within 1–2 business days</Badge>
                </div>
                <p className="text-xs text-gray-400">
                  You can also email us directly at{' '}
                  <a href="mailto:receiptguard01@gmail.com" className="text-emerald-600 hover:underline">
                    receiptguard01@gmail.com
                  </a>
                </p>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-400">
          <p>© {new Date().getFullYear()} ReceiptGuard Inc. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-gray-700 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-700 transition-colors">Terms of Service</Link>
            <Link href="/support" className="hover:text-gray-700 transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
