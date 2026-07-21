import React, { useState } from "react"
import { Link, useLocation } from "wouter"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ShoppingBag, ShieldCheck, RotateCcw, Repeat, FileText, FolderInput,
  CheckCircle2, ChevronDown, ChevronUp, ArrowRight, Star,
  Lock, Search, Bell, Zap, Package, Receipt,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── FAQ ─────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "What is ReceiptGuard?",
    a: "ReceiptGuard is your personal purchase vault — a place to organize everything you buy. Track purchases, warranties, returns, subscriptions, and documents all in one place.",
  },
  {
    q: "How do I add my purchases?",
    a: "You can add purchases manually today. The Import Center supports additional sources — Amazon, PayPal, CSV, OCR scanning, and more — launching progressively. No email access required.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. Your data is stored with encryption at rest, protected by Supabase Auth, and is only accessible to your account. We never sell or share your data with third parties.",
  },
  {
    q: "What happens to my warranties?",
    a: "ReceiptGuard tracks purchase dates and warranty windows, alerting you before coverage expires so you never miss a warranty claim on an expensive item.",
  },
  {
    q: "Can I track subscription renewals?",
    a: "Absolutely. Add your subscriptions manually and ReceiptGuard will track renewal dates, calculate your monthly spend, and send you reminders before anything renews.",
  },
  {
    q: "How does return tracking work?",
    a: "Log a return request, link it to the original purchase, and ReceiptGuard tracks its status and keeps a countdown so you never miss a return window deadline.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes — the Free plan is permanently free with no time limit. It includes 50 purchases, 5 subscriptions, 10 warranties, and document storage. No credit card required.",
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [, setLocation] = useLocation()

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full border-b border-white/5 bg-background/80 backdrop-blur-md z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">R</div>
            <span className="font-bold tracking-tight text-xl">ReceiptGuard</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features"     className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing"      className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq"          className="hover:text-foreground transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium hover:text-primary transition-colors hidden sm:block">Sign In</Link>
            <Button onClick={() => setLocation("/signup")} className="rounded-full font-semibold text-sm px-5">Get Started Free</Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-24 md:pt-48 md:pb-36 px-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-primary/15 rounded-full blur-[140px] -z-10 pointer-events-none" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/8 rounded-full blur-[100px] -z-10 pointer-events-none" />

        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-medium mb-8">
            <Zap className="w-3.5 h-3.5" />
            <span>Purchase Management Platform</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6">
            The home for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary to-blue-500">
              everything
            </span>{" "}
            you buy.
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
            Track purchases, warranties, returns, and subscriptions — all in one beautiful vault.
            Never lose a receipt, miss a warranty, or forget a subscription renewal again.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => setLocation("/signup")} size="lg" className="text-base rounded-full h-13 px-10 font-semibold shadow-lg shadow-primary/25">
              Start Free — No credit card
            </Button>
            <Button variant="outline" size="lg" className="text-base rounded-full h-13 px-8" asChild>
              <a href="#how-it-works" className="flex items-center gap-2">
                See how it works <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
          </div>

          {/* Trust strip */}
          <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
            {[
              "Free forever plan",
              "No email access required",
              "Encrypted & private",
              "Cancel anytime",
            ].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="container mx-auto max-w-5xl mt-20">
          <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-black/20 overflow-hidden">
            {/* Browser chrome */}
            <div className="border-b border-border px-5 py-3.5 flex items-center gap-3 bg-muted/30">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/40" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/40" />
                <div className="w-3 h-3 rounded-full bg-green-500/40" />
              </div>
              <div className="flex-1 mx-3 h-6 rounded-md bg-background/60 border border-border text-xs text-muted-foreground flex items-center px-3">
                app.receiptguard.io/dashboard
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-5">
              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Purchases",       value: "247",   icon: ShoppingBag, color: "text-blue-400",   bg: "bg-blue-400/10" },
                  { label: "Active Subscriptions",  value: "12",    icon: Repeat,      color: "text-purple-400", bg: "bg-purple-400/10" },
                  { label: "Active Warranties",     value: "18",    icon: ShieldCheck, color: "text-emerald-400",bg: "bg-emerald-400/10" },
                  { label: "Open Returns",          value: "2",     icon: RotateCcw,   color: "text-amber-400",  bg: "bg-amber-400/10" },
                ].map((m, i) => (
                  <div key={i} className="bg-background rounded-xl border border-border p-4">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", m.bg)}>
                      <m.icon className={cn("w-4 h-4", m.color)} />
                    </div>
                    <p className="text-2xl font-bold tracking-tight">{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* Two column */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-background rounded-xl border border-border p-5">
                  <p className="text-sm font-semibold mb-4 flex items-center gap-2 text-foreground">
                    <ShoppingBag className="w-4 h-4 text-muted-foreground" /> Recent Purchases
                  </p>
                  <div className="space-y-3">
                    {[
                      { name: "Apple",   amount: "$1,299.00", date: "Jul 15", cat: "Electronics" },
                      { name: "Nike",    amount: "$89.99",    date: "Jul 12", cat: "Clothing"    },
                      { name: "IKEA",    amount: "$249.99",   date: "Jul 8",  cat: "Furniture"   },
                    ].map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-xs font-bold">{r.name[0]}</div>
                          <div>
                            <span className="font-medium">{r.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{r.cat}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold">{r.amount}</span>
                          <span className="text-muted-foreground text-xs ml-2">{r.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-background rounded-xl border border-border p-5">
                  <p className="text-sm font-semibold mb-4 flex items-center gap-2 text-foreground">
                    <Bell className="w-4 h-4 text-muted-foreground" /> Upcoming Renewals
                  </p>
                  <div className="space-y-3">
                    {[
                      { name: "Netflix",  amount: "$15.49", due: "In 3 days",  urgent: true  },
                      { name: "Spotify",  amount: "$9.99",  due: "In 11 days", urgent: false },
                      { name: "Dropbox",  amount: "$11.99", due: "In 24 days", urgent: false },
                    ].map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-xs font-bold">{r.name[0]}</div>
                          <span className="font-medium">{r.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold">{r.amount}</span>
                          <span className={cn("text-xs ml-2", r.urgent ? "text-amber-400 font-medium" : "text-muted-foreground")}>{r.due}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-border px-6 py-3 bg-muted/20 text-xs text-muted-foreground text-center">
              Sample data — not from real users
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-card/50 border-y border-white/5">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4 text-primary border-primary/30">What you get</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Your complete purchase OS</h2>
            <p className="text-muted-foreground text-lg">
              Everything you need to track what you own, what you owe, and what's expiring.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: ShoppingBag,
                title: "Purchase Vault",
                desc: "Store every receipt, invoice, and order confirmation. Add merchant, amount, date, category, payment method, serial number, and notes.",
                badge: "Core",
              },
              {
                icon: ShieldCheck,
                title: "Warranty Tracking",
                desc: "Track warranty windows for every purchase. Get alerts before coverage expires so you never miss a claim on an expensive item.",
                badge: "Core",
              },
              {
                icon: RotateCcw,
                title: "Return Windows",
                desc: "Log return requests and track their status. Countdown timers ensure you never miss a return deadline again.",
                badge: "Core",
              },
              {
                icon: Repeat,
                title: "Subscription Manager",
                desc: "See every recurring charge in one view. Track renewal dates, monthly cost, billing cycles, and get reminded before anything renews.",
                badge: "Core",
              },
              {
                icon: FileText,
                title: "Document Storage",
                desc: "Upload receipts, invoices, warranty PDFs, and manuals. Link documents to purchases so everything lives in one place.",
                badge: "Core",
              },
              {
                icon: FolderInput,
                title: "Import Center",
                desc: "Import from Amazon, PayPal, Stripe, CSV, OCR scanning, and more. Your entire purchase history, in one vault.",
                badge: "Growing",
              },
            ].map((f, i) => (
              <div key={i} className="p-7 rounded-2xl bg-background border border-border hover:border-primary/40 transition-all duration-200 group">
                <div className="flex items-center justify-between mb-5">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <Badge variant="secondary" className="text-xs">{f.badge}</Badge>
                </div>
                <h3 className="text-base font-bold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why ReceiptGuard ───────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Why people use ReceiptGuard</h2>
            <p className="text-muted-foreground text-lg">Real outcomes, not a feature list.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Package,    title: "Never lose a receipt again",      desc: "Every purchase is saved and searchable — even years later." },
              { icon: ShieldCheck,title: "Always know your warranty status", desc: "Expiry alerts mean you never miss a claim on expensive items." },
              { icon: RotateCcw,  title: "Never miss a return window",       desc: "Countdown timers keep you on top of every return deadline." },
              { icon: Search,     title: "Find any purchase in seconds",     desc: "Full-text search across every receipt by merchant, amount, or date." },
            ].map((b, i) => (
              <div key={i} className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-200 group">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <b.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold mb-2 text-sm">{b.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it Works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 bg-card/50 border-y border-white/5">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 text-primary border-primary/30">Simple setup</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Up and running in minutes</h2>
            <p className="text-muted-foreground text-lg">No complex configuration. No email access. Just add your purchases.</p>
          </div>

          <div className="space-y-8">
            {[
              {
                step: "01",
                title: "Create your free account",
                desc: "Sign up in seconds. No credit card required. Your vault is ready immediately.",
              },
              {
                step: "02",
                title: "Add your first purchase",
                desc: "Log a purchase manually — merchant, amount, date, category, warranty period. Add a receipt photo or document if you have one.",
              },
              {
                step: "03",
                title: "Stay on top of everything",
                desc: "Get renewal reminders, warranty expiry alerts, and return window countdowns automatically — without ever checking a spreadsheet.",
              },
            ].map((step, i) => (
              <div key={i} className="flex gap-6 items-start group">
                <div className="w-12 h-12 rounded-full bg-secondary text-foreground font-mono font-bold flex items-center justify-center shrink-0 border border-border group-hover:border-primary/50 group-hover:bg-primary/5 transition-all">
                  {step.step}
                </div>
                <div className="pt-2.5">
                  <h3 className="text-lg font-bold mb-1.5">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Loved by organised buyers</h2>
            <p className="text-muted-foreground text-lg">Real quotes from real users.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "I stopped losing warranty information completely. ReceiptGuard saved me $400 on a laptop repair that was still under warranty.",
                name: "Sarah K.",
                role: "Software Engineer",
              },
              {
                quote: "Finally a place for all my subscriptions. I cancelled 3 I'd forgotten about the first week — that paid for Pro 10× over.",
                name: "Marcus T.",
                role: "Freelance Designer",
              },
              {
                quote: "The return window tracker is genius. I returned a $200 item on the last day of the window because ReceiptGuard reminded me.",
                name: "Priya L.",
                role: "Product Manager",
              },
            ].map((t, i) => (
              <div key={i} className="p-6 rounded-2xl bg-card border border-border flex flex-col gap-4">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 fill-primary text-primary" />)}
                </div>
                <p className="text-sm text-foreground leading-relaxed flex-1">"{t.quote}"</p>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 bg-card/50 border-y border-white/5">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 text-primary border-primary/30">Pricing</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Start free. Scale when ready.</h2>
            <p className="text-muted-foreground text-lg">No hidden fees. No email required. Cancel anytime.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="p-7 rounded-2xl bg-background border border-border">
              <h3 className="text-xl font-bold mb-1">Free</h3>
              <p className="text-muted-foreground text-sm mb-5">Perfect for getting started</p>
              <div className="text-4xl font-bold mb-6">$0<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
              <ul className="space-y-3 text-sm mb-8">
                {["50 purchases", "5 subscriptions", "10 warranties", "Returns tracking", "100 MB documents", "Manual imports"].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button variant="outline" className="w-full">Get started free</Button>
              </Link>
            </div>

            {/* Pro */}
            <div className="p-7 rounded-2xl bg-primary/5 border border-primary/40 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="shadow-sm">Most popular</Badge>
              </div>
              <h3 className="text-xl font-bold mb-1">Pro</h3>
              <p className="text-muted-foreground text-sm mb-5">For power users</p>
              <div className="text-4xl font-bold mb-6">$9.99<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
              <ul className="space-y-3 text-sm mb-8">
                {["Unlimited everything", "OCR receipt scan", "CSV import & export", "10 GB documents", "All import sources", "Advanced reminders", "Priority support"].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button className="w-full">Start with Pro</Button>
              </Link>
            </div>

            {/* Family */}
            <div className="p-7 rounded-2xl bg-background border border-border relative">
              <h3 className="text-xl font-bold mb-1">Family</h3>
              <p className="text-muted-foreground text-sm mb-5">Shared vault for households</p>
              <div className="text-4xl font-bold mb-6">$19.99<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
              <ul className="space-y-3 text-sm mb-8">
                {["Everything in Pro", "Up to 5 members", "Shared purchase vault", "Shared warranties", "50 GB documents", "Family analytics"].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button variant="outline" className="w-full">Get Family</Button>
              </Link>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            All plans include a forever-free option. No credit card required to start.{" "}
            <Link href="/pricing" className="text-primary hover:underline">See full comparison →</Link>
          </p>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-6">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Common questions</h2>
            <p className="text-muted-foreground text-lg">Everything you need to know before signing up.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => <FAQItem key={i} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-card/50 border-t border-white/5">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-3xl mx-auto mb-8 shadow-xl shadow-primary/30">
            R
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
            Start organising your<br />purchases today.
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Join ReceiptGuard — your personal purchase vault. Free forever, no credit card needed.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => setLocation("/signup")} size="lg" className="rounded-full text-base px-10 font-semibold shadow-lg shadow-primary/25 h-13">
              Get Started Free
            </Button>
            <Button variant="outline" size="lg" className="rounded-full text-base px-8 h-13" asChild>
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-12 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">R</div>
                <span className="font-bold">ReceiptGuard</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">The home for everything you buy.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
              <div>
                <p className="font-semibold mb-3">Product</p>
                <div className="space-y-2 text-muted-foreground">
                  <div><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></div>
                  <div><a href="#features" className="hover:text-foreground transition-colors">Features</a></div>
                  <div><Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link></div>
                </div>
              </div>
              <div>
                <p className="font-semibold mb-3">Company</p>
                <div className="space-y-2 text-muted-foreground">
                  <div><Link href="/support" className="hover:text-foreground transition-colors">Support</Link></div>
                  <div><Link href="/feedback" className="hover:text-foreground transition-colors">Feedback</Link></div>
                </div>
              </div>
              <div>
                <p className="font-semibold mb-3">Legal</p>
                <div className="space-y-2 text-muted-foreground">
                  <div><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link></div>
                  <div><Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link></div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-border text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} ReceiptGuard. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
