import React, { useState } from "react"
import { Link, useLocation } from "wouter"
import { Button } from "@/components/ui/button"
import {
  CheckCircle2, Shield, Search, BellRing, Sparkles, Repeat,
  Lock, Eye, X, Clock, Zap, Mail, Database, Package,
  LayoutDashboard, TrendingUp, CreditCard, ShieldCheck,
  ChevronDown, ChevronUp, ArrowRight,
} from "lucide-react"
import heroImg from "@assets/generated_images/hero-illustration.jpg"
import { cn } from "@/lib/utils"

// ─── FAQ ─────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "Do you read my personal emails?",
    a: "No. ReceiptGuard only accesses emails that match receipt and transaction patterns — order confirmations, invoices, and renewal notices. Personal conversations, social emails, and anything else are never touched.",
  },
  {
    q: "Why do you need Gmail access?",
    a: "Gmail access lets ReceiptGuard automatically detect and organize your receipts, track active subscriptions, and monitor warranty windows — without you having to forward or upload anything manually.",
  },
  {
    q: "Can I disconnect Gmail later?",
    a: "Yes. You can revoke access at any time from your Settings page or directly from your Google Account's third-party app permissions. Your previously imported data remains available.",
  },
  {
    q: "How secure is my data?",
    a: "We use secure Google OAuth for authentication and request read-only Gmail access. Sensitive data is stored with encrypted storage and we never store your Gmail password. You remain in full control of your Google account.",
  },
  {
    q: "Will ReceiptGuard delete or modify my emails?",
    a: "Never. We have read-only access. ReceiptGuard cannot delete, modify, move, or send emails on your behalf.",
  },
  {
    q: "Do you support Outlook or other email providers?",
    a: "Gmail is fully supported today. Outlook and other providers are on the roadmap — sign up to be notified when they become available.",
  },
  {
    q: "Can I upload paper receipts?",
    a: "Manual receipt upload is coming soon. Currently, ReceiptGuard focuses on automatic detection from Gmail, which covers the vast majority of modern receipts.",
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
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full border-b border-white/5 bg-background/80 backdrop-blur-md z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-black font-bold">R</div>
            <span className="font-bold tracking-tight text-xl">ReceiptGuard</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features"     className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it Works</a>
            <a href="#pricing"      className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq"          className="hover:text-foreground transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium hover:text-primary transition-colors">Sign In</Link>
            <Button onClick={() => setLocation("/signup")} className="rounded-full font-semibold">Get Started</Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
        <div className="container mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              <span>Automatic receipt &amp; subscription management</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              Your expenses, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">perfectly organized.</span>
            </h1>

            {/* Improved subheading — outcome-first */}
            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              Never lose a receipt, forget a subscription renewal, or miss a warranty deadline again.
              ReceiptGuard securely scans your Gmail and organizes every purchase automatically.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={() => setLocation("/signup")} size="lg" className="text-base rounded-full h-12 px-8">
                Start Free — No credit card
              </Button>
              <Button variant="outline" size="lg" className="text-base rounded-full h-12 px-8" asChild>
                <a href="#how-it-works">See How It Works</a>
              </Button>
            </div>

            {/* Gmail trust strip — replaces fake social proof */}
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {[
                "Read-only Gmail access",
                "Secure Google OAuth",
                "Encrypted data storage",
                "Disconnect anytime",
              ].map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-border shadow-2xl shadow-primary/10 relative">
              <img src={heroImg} alt="ReceiptGuard dashboard interface" className="object-cover w-full h-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 bg-card/80 backdrop-blur-xl border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Netflix Renewal</p>
                    <p className="text-xs text-muted-foreground">Successfully detected</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">$15.49</p>
                  <p className="text-xs text-muted-foreground">In 3 days</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-card/50 border-y border-white/5">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Everything in one place</h2>
            <p className="text-muted-foreground text-lg">
              We extract only the financial data that matters — so your inbox stays yours.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Search,
                title: "Smart Receipt Extraction",
                desc: "Every receipt from your inbox is automatically detected, categorized, and stored in a searchable archive — no forwarding or uploading required.",
              },
              {
                icon: Repeat,
                title: "Subscription Tracking",
                desc: "See every recurring charge in one view. Get notified before yearly plans renew so you're never caught off guard by a forgotten subscription.",
              },
              {
                icon: Shield,
                title: "Warranty Monitoring",
                desc: "ReceiptGuard tracks purchase dates and warranty windows, then alerts you before your coverage expires on any item.",
              },
            ].map((f, i) => (
              <div key={i} className="p-8 rounded-2xl bg-background border border-border hover:border-primary/50 transition-all duration-200 group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold mb-3">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why people use ReceiptGuard ────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="container mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Why people use ReceiptGuard</h2>
            <p className="text-muted-foreground text-lg">Real outcomes. Not a feature list.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Package,       title: "Never lose a receipt again",           desc: "Every order confirmation and invoice is automatically saved and searchable — even years later." },
              { icon: CreditCard,    title: "Know exactly what renews next",         desc: "See every subscription in one dashboard with renewal dates, amounts, and alerts." },
              { icon: ShieldCheck,   title: "Protect your purchases",               desc: "Warranty countdowns and expiry alerts mean you never miss a claim window on expensive items." },
              { icon: Zap,           title: "Find any purchase in seconds",          desc: "Full-text search across every receipt ever imported — by merchant, amount, date, or item." },
            ].map((b, i) => (
              <div key={i} className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-200 group">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <b.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold mb-2 text-base">{b.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison table ───────────────────────────────────────────────── */}
      <section className="py-24 bg-card/50 border-y border-white/5 px-6">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Why use ReceiptGuard instead of searching Gmail manually?
            </h2>
            <p className="text-muted-foreground text-lg">
              Gmail search finds one email at a time. ReceiptGuard organizes everything automatically.
            </p>
          </div>

          <div className="rounded-2xl border border-border overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-2 bg-muted/60">
              <div className="px-6 py-4 font-semibold text-sm text-muted-foreground">Searching Gmail manually</div>
              <div className="px-6 py-4 font-semibold text-sm text-primary border-l border-border">ReceiptGuard</div>
            </div>
            {/* Rows */}
            {[
              ["Search receipts one by one",       "Automatically organizes every receipt"],
              ["No subscription renewal tracking", "Tracks all recurring subscriptions"],
              ["No warranty monitoring",           "Monitors warranties with expiry alerts"],
              ["No financial overview",            "Shows all purchases in one dashboard"],
              ["No automatic reminders",           "Sends renewal and warranty reminders"],
              ["Easy to miss important purchases", "Instantly finds any purchase"],
            ].map(([bad, good], i) => (
              <div key={i} className={cn("grid grid-cols-2 border-t border-border", i % 2 === 0 ? "" : "bg-muted/20")}>
                <div className="px-6 py-4 flex items-start gap-3 text-sm text-muted-foreground">
                  <X className="w-4 h-4 text-destructive/70 shrink-0 mt-0.5" />
                  {bad}
                </div>
                <div className="px-6 py-4 flex items-start gap-3 text-sm border-l border-border">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  {good}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dashboard preview ──────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              See what you get the moment you connect
            </h2>
            <p className="text-muted-foreground text-lg">
              After connecting Gmail, your dashboard is populated within minutes.
            </p>
          </div>

          {/* Mockup card */}
          <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-black/20 overflow-hidden">
            {/* Top bar */}
            <div className="border-b border-border px-6 py-4 flex items-center gap-3 bg-muted/30">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
              </div>
              <div className="flex-1 mx-4 h-6 rounded-md bg-background/60 border border-border text-xs text-muted-foreground flex items-center px-3">
                app.receiptguard.io/dashboard
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {/* Metric cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Receipts organized",   value: "327",  icon: Package,       color: "text-blue-400" },
                  { label: "Subscriptions found",  value: "14",   icon: Repeat,        color: "text-purple-400" },
                  { label: "Warranties expiring",  value: "3",    icon: ShieldCheck,   color: "text-amber-400" },
                  { label: "Renewing this month",  value: "$89",  icon: CreditCard,    color: "text-emerald-400" },
                ].map((m, i) => (
                  <div key={i} className="bg-background rounded-xl border border-border p-4">
                    <div className={cn("mb-2", m.color)}>
                      <m.icon className="w-5 h-5" />
                    </div>
                    <p className="text-2xl font-bold tracking-tight">{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* Two-column preview */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Recent purchases */}
                <div className="bg-background rounded-xl border border-border p-5">
                  <p className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" /> Recent purchases
                  </p>
                  <div className="space-y-3">
                    {[
                      { name: "Amazon",      amount: "$34.99", date: "Jul 12" },
                      { name: "Apple",       amount: "$9.99",  date: "Jul 10" },
                      { name: "Adobe",       amount: "$54.99", date: "Jul 8"  },
                    ].map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-xs font-bold">{r.name[0]}</div>
                          <span>{r.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium">{r.amount}</span>
                          <span className="text-muted-foreground text-xs ml-2">{r.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upcoming renewals */}
                <div className="bg-background rounded-xl border border-border p-5">
                  <p className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-muted-foreground" /> Upcoming renewals
                  </p>
                  <div className="space-y-3">
                    {[
                      { name: "Netflix",  amount: "$15.49", due: "In 3 days",  urgent: true  },
                      { name: "Spotify",  amount: "$9.99",  due: "In 12 days", urgent: false },
                      { name: "Dropbox",  amount: "$11.99", due: "In 28 days", urgent: false },
                    ].map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-xs font-bold">{r.name[0]}</div>
                          <span>{r.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium">{r.amount}</span>
                          <span className={cn("text-xs ml-2", r.urgent ? "text-amber-400 font-medium" : "text-muted-foreground")}>{r.due}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sample data notice */}
            <div className="border-t border-border px-6 py-3 bg-muted/20 text-xs text-muted-foreground text-center">
              Sample data for illustration — not from real users
            </div>
          </div>
        </div>
      </section>

      {/* ── How it Works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 bg-card/50 border-y border-white/5">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">How it works</h2>
            <p className="text-muted-foreground text-lg">Connect. Scan. Stay protected.</p>
          </div>

          <div className="space-y-10">
            {[
              {
                step: "01",
                title: "Connect your inbox",
                desc: "Sign in with Google. We only request read-only access to emails matching receipt and transaction patterns. Your personal conversations are never accessed.",
              },
              {
                step: "02",
                title: "AI extraction runs",
                desc: "Our models scan your inbox, extracting merchants, totals, dates, and item details automatically. Results appear in your dashboard within minutes.",
              },
              {
                step: "03",
                title: "Stay informed",
                desc: "Receive renewal reminders, warranty alerts, and subscription insights automatically — without manually checking your inbox ever again.",
              },
            ].map((step, i) => (
              <div key={i} className="flex gap-6 items-start group">
                <div className="w-12 h-12 rounded-full bg-secondary text-foreground font-mono font-bold flex items-center justify-center shrink-0 border border-border group-hover:border-primary/50 transition-colors">
                  {step.step}
                </div>
                <div className="pt-2">
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Privacy & Security ─────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Your privacy comes first.</h2>
            <p className="text-muted-foreground text-lg">
              We built ReceiptGuard with a minimal-access, privacy-first approach from day one.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Lock,       title: "Secure Google OAuth",          desc: "We authenticate via Google's official OAuth flow. Your Gmail password is never shared with us." },
              { icon: Eye,        title: "Read-only Gmail access",        desc: "ReceiptGuard can only read emails matching receipt patterns. We cannot write, delete, or send emails." },
              { icon: Database,   title: "Encrypted data storage",        desc: "Your imported receipt and subscription data is stored with encryption at rest." },
              { icon: Mail,       title: "We never send emails for you",  desc: "ReceiptGuard cannot send any email from your account. We only read — never write." },
              { icon: ShieldCheck,"title": "We never delete your emails", desc: "Nothing in your inbox is ever moved, deleted, or modified. Your Gmail stays exactly as it is." },
              { icon: ArrowRight, title: "Disconnect anytime",            desc: "Revoke access instantly from your Settings page or directly from your Google Account permissions." },
            ].map((s, i) => (
              <div key={i} className="flex gap-4 p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <s.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm mb-1">{s.title}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Supported merchants ─────────────────────────────────────────────── */}
      <section className="py-24 bg-card/50 border-y border-white/5 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Works with receipts from your favorite services
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              ReceiptGuard automatically detects receipts from thousands of merchants — from global platforms to local retailers.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {[
              "Amazon", "Apple", "Google", "Microsoft", "Netflix",
              "Spotify", "Uber", "Airbnb", "PayPal", "Shopify",
              "eBay",   "Etsy",  "Steam", "Adobe",   "Dropbox",
              "GitHub", "Notion","Figma",  "Zoom",    "+ thousands more",
            ].map((m, i) => (
              <span
                key={i}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium border border-border bg-background hover:border-primary/40 hover:bg-muted/40 transition-colors",
                  m.startsWith("+") && "text-muted-foreground italic"
                )}
              >
                {m}
              </span>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-8">
            Brand names are property of their respective owners. ReceiptGuard has no affiliation or partnership with any listed service.
          </p>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-6">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Common questions</h2>
            <p className="text-muted-foreground text-lg">Everything you need to know before connecting.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => <FAQItem key={i} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 bg-card/50 border-y border-white/5">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Simple, transparent pricing</h2>
            <p className="text-muted-foreground text-lg">Start for free. Upgrade when you need more.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free */}
            <div className="p-8 rounded-3xl bg-background border border-border">
              <h3 className="text-2xl font-bold mb-2">Free</h3>
              <p className="text-muted-foreground mb-6">Perfect for getting started</p>
              <div className="text-5xl font-bold mb-8">
                $0<span className="text-lg text-muted-foreground font-normal">/mo</span>
              </div>
              <ul className="space-y-4 mb-8">
                {[
                  "Up to 50 receipts/mo",
                  "Track 5 subscriptions",
                  "Basic categorization",
                  "Email support",
                ].map((ft, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    {ft}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full rounded-xl" onClick={() => setLocation("/signup")}>
                Start Free
              </Button>
            </div>

            {/* Pro */}
            <div className="p-8 rounded-3xl bg-background border border-primary relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 rounded-bl-xl font-medium text-sm">Popular</div>
              <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 to-transparent blur-2xl -z-10" />
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <p className="text-muted-foreground mb-6">For the financially organized</p>
              <div className="text-5xl font-bold mb-8">
                $5.99<span className="text-lg text-muted-foreground font-normal">/mo</span>
              </div>
              <ul className="space-y-4 mb-8">
                {[
                  "Unlimited receipts",
                  "Unlimited subscriptions",
                  "Warranty tracking",
                  "Custom renewal alerts",
                  "Priority support",
                ].map((ft, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    {ft}
                  </li>
                ))}
              </ul>
              <Button className="w-full rounded-xl" onClick={() => setLocation("/signup")}>
                Upgrade to Pro
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/15 rounded-full blur-[100px] -z-10 pointer-events-none" />
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
            Stop digging through your inbox.
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
            Start keeping every receipt, subscription, and warranty organized automatically — from the moment you connect.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => setLocation("/signup")} size="lg" className="text-base rounded-full h-12 px-10">
              Get Started Free
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {["No credit card required", "Read-only Gmail access", "Cancel anytime"].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="py-12 border-t border-white/5">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-black font-bold text-xs">R</div>
            <span className="font-bold tracking-tight">ReceiptGuard</span>
          </div>
          <div className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} ReceiptGuard. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms"   className="hover:text-foreground transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
