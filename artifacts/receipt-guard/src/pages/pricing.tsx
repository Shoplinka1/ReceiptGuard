import { useState } from 'react'
import { Link } from 'wouter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, X, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

const MONTHLY_USD = 9.99
const YEARLY_USD = 99.99
const FAMILY_MONTHLY = 19.99
const FAMILY_YEARLY = 199.99
const YEARLY_SAVINGS_PCT = Math.round((1 - YEARLY_USD / (MONTHLY_USD * 12)) * 100)

type PlanValue = true | false | string

interface FeatureRow {
  label: string
  free: PlanValue
  pro: PlanValue
  family: PlanValue
}

const FEATURE_ROWS: FeatureRow[] = [
  { label: 'Purchases',              free: '50',        pro: 'Unlimited', family: 'Unlimited' },
  { label: 'Subscriptions',          free: '5',         pro: 'Unlimited', family: 'Unlimited' },
  { label: 'Warranties',             free: '10',        pro: 'Unlimited', family: 'Unlimited' },
  { label: 'Returns tracking',       free: true,        pro: true,        family: true },
  { label: 'Document storage',       free: '100 MB',    pro: '10 GB',     family: '50 GB' },
  { label: 'Import sources',         free: 'Manual',    pro: 'All',       family: 'All' },
  { label: 'OCR receipt scan',       free: false,       pro: true,        family: true },
  { label: 'CSV import',             free: false,       pro: true,        family: true },
  { label: 'Renewal reminders',      free: 'Basic',     pro: 'Advanced',  family: 'Advanced' },
  { label: 'Spending analytics',     free: 'Basic',     pro: 'Full',      family: 'Full' },
  { label: 'CSV & PDF export',       free: false,       pro: true,        family: true },
  { label: 'Family members',         free: false,       pro: false,       family: 'Up to 5' },
  { label: 'Shared purchase vault',  free: false,       pro: false,       family: true },
  { label: 'Shared warranties',      free: false,       pro: false,       family: true },
  { label: 'Priority support',       free: false,       pro: true,        family: true },
]

const FAQ = [
  {
    q: 'Can I cancel at any time?',
    a: 'Yes. Cancel your Pro subscription at any time from Settings → Billing. You retain Pro access until the end of the billing period, then revert to Free. Your data is never deleted.',
  },
  {
    q: 'What happens when I hit the Free plan limit?',
    a: "You'll see a prompt to upgrade when you reach 50 purchases, 5 subscriptions, or 10 warranties. Existing data is never deleted.",
  },
  {
    q: 'Do you store my payment info?',
    a: 'No. Payments are processed by Paystack. ReceiptGuard never sees or stores your card details.',
  },
  {
    q: 'Is there a free trial for Pro?',
    a: 'The Free plan is permanently free with no time limit. Pro pricing starts at $9.99/month with no credit card required to get started.',
  },
  {
    q: 'When will the Family plan be available?',
    a: 'The Family plan is in active development. Sign up for Pro now and you\'ll be notified when Family launches — with a discounted migration offer for existing Pro subscribers.',
  },
  {
    q: 'How do I import my purchases?',
    a: 'You can add purchases manually today. The Import Center supports additional sources — Amazon, PayPal, CSV, OCR, and more — launching progressively throughout 2025.',
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="font-semibold text-sm md:text-base pr-4">{q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-5 text-muted-foreground text-sm leading-relaxed border-t border-border/50 pt-4">
          {a}
        </div>
      )}
    </div>
  )
}

function CellValue({ val, isPrimary = false }: { val: PlanValue; isPrimary?: boolean }) {
  if (val === true) return <CheckCircle2 className={`w-4 h-4 mx-auto ${isPrimary ? 'text-primary' : 'text-foreground/60'}`} />
  if (val === false) return <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />
  return <span className={`text-sm ${isPrimary ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{val}</span>
}

export default function PricingPage() {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  const { user } = useAuth()

  const proPrice = cycle === 'yearly' ? YEARLY_USD : MONTHLY_USD
  const familyPrice = cycle === 'yearly' ? FAMILY_YEARLY : FAMILY_MONTHLY

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
            Start free. Upgrade when you need more. No hidden fees, no surprises.
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
        <div className="grid sm:grid-cols-3 gap-6">
          {/* Free */}
          <Card className="flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Free</CardTitle>
              <p className="text-4xl font-bold mt-2">$0 <span className="text-base font-normal text-muted-foreground">/ month</span></p>
              <p className="text-sm text-muted-foreground">Forever free. No credit card required.</p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-6">
              <ul className="space-y-2.5 text-sm">
                {['50 purchases', '5 subscriptions', '10 warranties', 'Returns tracking', 'Document storage (100 MB)', 'Manual imports', 'Basic analytics'].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{f}</span>
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
              <div className="mt-2">
                {cycle === 'yearly' ? (
                  <>
                    <p className="text-4xl font-bold">${YEARLY_USD} <span className="text-base font-normal text-muted-foreground">/ year</span></p>
                    <p className="text-sm text-muted-foreground mt-1">${(YEARLY_USD / 12).toFixed(2)}/month · billed annually</p>
                  </>
                ) : (
                  <p className="text-4xl font-bold">${MONTHLY_USD} <span className="text-base font-normal text-muted-foreground">/ month</span></p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Everything you need, unlimited.</p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-6">
              <ul className="space-y-2.5 text-sm">
                {['Unlimited purchases', 'Unlimited subscriptions', 'Unlimited warranties', 'Returns tracking', 'Document storage (10 GB)', 'All import sources', 'OCR receipt scan', 'CSV import & export', 'Advanced reminders', 'Full analytics & reports', 'Priority support'].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <Link href={user ? '/settings?tab=billing' : '/signup'}>
                  <Button className="w-full">
                    {user ? 'Upgrade to Pro' : 'Start with Pro'}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Family */}
          <Card className="flex flex-col border-border relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
            </div>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-4 h-4" /> Family
              </CardTitle>
              <div className="mt-2">
                {cycle === 'yearly' ? (
                  <>
                    <p className="text-4xl font-bold">${FAMILY_YEARLY} <span className="text-base font-normal text-muted-foreground">/ year</span></p>
                    <p className="text-sm text-muted-foreground mt-1">${(FAMILY_YEARLY / 12).toFixed(2)}/month · billed annually</p>
                  </>
                ) : (
                  <p className="text-4xl font-bold">${FAMILY_MONTHLY} <span className="text-base font-normal text-muted-foreground">/ month</span></p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Everything in Pro, shared with your household.</p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-6">
              <ul className="space-y-2.5 text-sm">
                {['Everything in Pro', 'Up to 5 family members', 'Shared purchase vault', 'Shared warranties', 'Shared subscriptions view', 'Document storage (50 GB)', 'Family spending analytics', 'Admin member controls'].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <Button className="w-full" variant="outline" disabled>
                  Coming Soon
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Pro subscribers get early access + a discounted migration offer.
                </p>
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
                  <th className="text-center px-4 py-3 font-medium">Free</th>
                  <th className="text-center px-4 py-3 font-medium text-primary">Pro</th>
                  <th className="text-center px-4 py-3 font-medium text-foreground/70">Family</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-6 py-3 text-foreground">{row.label}</td>
                    <td className="px-4 py-3 text-center"><CellValue val={row.free} /></td>
                    <td className="px-4 py-3 text-center"><CellValue val={row.pro} isPrimary /></td>
                    <td className="px-4 py-3 text-center"><CellValue val={row.family} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQ.map(({ q, a }) => <FAQItem key={q} q={q} a={a} />)}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Ready to get started?</h2>
          <p className="text-muted-foreground">Join thousands of users who manage their purchases smarter.</p>
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
