import { useState } from 'react'
import { Link } from 'wouter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, X } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

const MONTHLY_USD = 9.99
const YEARLY_USD = 99.99
const YEARLY_SAVINGS_PCT = Math.round((1 - YEARLY_USD / (MONTHLY_USD * 12)) * 100)

const FREE_ROWS = [
  { label: 'Gmail accounts', free: '1', pro: 'Unlimited' },
  { label: 'Receipt storage', free: '50 receipts', pro: 'Unlimited' },
  { label: 'Active subscriptions', free: '5', pro: 'Unlimited' },
  { label: 'Renewal reminders', free: 'Basic (3-day)', pro: 'Advanced (30/14/7/3/1 day)' },
  { label: 'Spending analytics', free: 'Basic dashboard', pro: 'Full reports & trends' },
  { label: 'CSV & PDF export', free: false, pro: true },
  { label: 'Warranty tracking', free: true, pro: true },
  { label: 'Search', free: true, pro: true },
  { label: 'Priority support', free: false, pro: true },
]

const FAQ = [
  {
    q: 'Can I cancel at any time?',
    a: 'Yes. You can cancel your Pro subscription at any time. You retain Pro access until the end of the current billing period, then automatically revert to the Free plan.',
  },
  {
    q: 'Is my Gmail data safe?',
    a: 'We request read-only access to your Gmail inbox. We never read personal conversations — only emails matching known receipt and purchase formats. OAuth tokens are encrypted server-side using AES-256 and are never exposed to the client.',
  },
  {
    q: 'What happens when I hit the Free plan limit?',
    a: 'You\'ll see a prompt to upgrade when you reach 50 receipts, 5 subscriptions, or try to connect a second Gmail account. Your existing data is never deleted.',
  },
  {
    q: 'Do you store my payment info?',
    a: 'No. Payments are processed by Paystack. ReceiptGuard never sees or stores your card details.',
  },
  {
    q: 'Is there a free trial for Pro?',
    a: 'The Free plan is permanently free with no time limit. Pro pricing starts at $9.99/month.',
  },
]

export default function PricingPage() {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">R</div>
              <span className="font-bold text-lg">ReceiptGuard</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard"><Button variant="outline" size="sm">Dashboard</Button></Link>
            ) : (
              <>
                <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
                <Link href="/signup"><Button size="sm">Get started free</Button></Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-20 space-y-20">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Simple, transparent pricing</h1>
          <p className="text-xl text-muted-foreground max-w-xl mx-auto">
            Start free, upgrade when you need more. No hidden fees, no surprises.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex bg-secondary rounded-lg p-1 gap-1 mt-4">
            <button
              onClick={() => setCycle('monthly')}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${cycle === 'monthly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setCycle('yearly')}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${cycle === 'yearly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Yearly
              <Badge className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary border-0">Save {YEARLY_SAVINGS_PCT}%</Badge>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free */}
          <Card className="flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Free</CardTitle>
              <p className="text-4xl font-bold mt-2">$0 <span className="text-base font-normal text-muted-foreground">/ month</span></p>
              <p className="text-sm text-muted-foreground">Forever free. No credit card required.</p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-6">
              <ul className="space-y-3">
                {FREE_ROWS.map(row => (
                  <li key={row.label} className="flex items-start gap-2.5 text-sm">
                    {row.free === false
                      ? <X className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                      : <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                    <span className={row.free === false ? 'text-muted-foreground line-through' : 'text-foreground'}>
                      {row.label}{typeof row.free === 'string' ? ` — ${row.free}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                {user ? (
                  <Link href="/dashboard"><Button variant="outline" className="w-full">Go to Dashboard</Button></Link>
                ) : (
                  <Link href="/signup"><Button variant="outline" className="w-full">Get started free</Button></Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pro */}
          <Card className="flex flex-col border-primary/50 bg-primary/5 relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <Badge className="text-xs">Most popular</Badge>
            </div>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Pro</CardTitle>
              {cycle === 'yearly' ? (
                <div className="mt-2">
                  <p className="text-4xl font-bold">$99.99 <span className="text-base font-normal text-muted-foreground">/ year</span></p>
                  <p className="text-sm text-muted-foreground mt-1">${(YEARLY_USD / 12).toFixed(2)}/month · billed annually</p>
                </div>
              ) : (
                <p className="text-4xl font-bold mt-2">$9.99 <span className="text-base font-normal text-muted-foreground">/ month</span></p>
              )}
              <p className="text-sm text-muted-foreground">Everything you need, unlimited.</p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-6">
              <ul className="space-y-3">
                {FREE_ROWS.map(row => (
                  <li key={row.label} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-foreground">
                      {row.label}{typeof row.pro === 'string' ? ` — ${row.pro}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <Link href={user ? '/billing' : '/signup'}>
                  <Button className="w-full">
                    {user ? 'Upgrade to Pro' : 'Start with Pro'}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feature comparison table */}
        <div>
          <h2 className="text-2xl font-bold text-center mb-8">Full feature comparison</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Feature</th>
                  <th className="text-center px-6 py-3 font-medium">Free</th>
                  <th className="text-center px-6 py-3 font-medium text-primary">Pro</th>
                </tr>
              </thead>
              <tbody>
                {FREE_ROWS.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-6 py-3 text-foreground">{row.label}</td>
                    <td className="px-6 py-3 text-center">
                      {row.free === true ? <CheckCircle2 className="w-4 h-4 text-foreground/60 mx-auto" />
                        : row.free === false ? <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                        : <span className="text-muted-foreground">{row.free}</span>}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {row.pro === true ? <CheckCircle2 className="w-4 h-4 text-primary mx-auto" />
                        : row.pro === false ? <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                        : <span className="text-primary font-medium">{row.pro}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-4">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="border border-border rounded-lg p-5">
                <h3 className="font-semibold text-sm mb-2">{q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Ready to get started?</h2>
          <p className="text-muted-foreground">Join thousands of users who track their finances smarter.</p>
          <div className="flex justify-center gap-3">
            <Link href="/signup"><Button size="lg">Get started free</Button></Link>
            <Link href="/support"><Button size="lg" variant="outline">Talk to us</Button></Link>
          </div>
        </div>

        {/* Footer links */}
        <div className="text-center text-sm text-muted-foreground border-t border-border pt-8">
          <Link href="/privacy"><span className="hover:text-foreground cursor-pointer">Privacy Policy</span></Link>
          {' · '}
          <Link href="/terms"><span className="hover:text-foreground cursor-pointer">Terms of Service</span></Link>
          {' · '}
          <Link href="/support"><span className="hover:text-foreground cursor-pointer">Support</span></Link>
        </div>
      </div>
    </div>
  )
}
