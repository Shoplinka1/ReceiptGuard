import React from "react"
import { Link, useLocation } from "wouter"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Shield, Search, BellRing, Sparkles, Repeat } from "lucide-react"
import heroImg from "@assets/generated_images/hero-illustration.jpg"
import logoImg from "@assets/generated_images/logo.png"

export default function LandingPage() {
  const [, setLocation] = useLocation()

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans">
      {/* Navbar */}
      <nav className="fixed top-0 w-full border-b border-white/5 bg-background/80 backdrop-blur-md z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Fallback to CSS logo if image fails */}
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-black font-bold">R</div>
            <span className="font-bold tracking-tight text-xl">ReceiptGuard</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium hover:text-primary transition-colors">Sign In</Link>
            <Button onClick={() => setLocation("/signup")} className="rounded-full font-semibold">Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
        <div className="container mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              <span>The Financial Guardian for Professionals</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              Your expenses, <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">perfectly organized.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              ReceiptGuard automatically securely scans your Gmail to track receipts, monitor active subscriptions, and alert you before warranties expire or renewals hit.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={() => setLocation("/signup")} size="lg" className="text-base rounded-full h-12 px-8">
                Start Free Trial
              </Button>
              <Button variant="outline" size="lg" className="text-base rounded-full h-12 px-8">
                See How It Works
              </Button>
            </div>
            <div className="mt-10 flex items-center gap-4 text-sm text-muted-foreground font-medium">
              <div className="flex -space-x-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs">
                    {i}
                  </div>
                ))}
              </div>
              <p>Trusted by 10,000+ professionals</p>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-border shadow-2xl shadow-primary/10 relative">
              <img src={heroImg} alt="ReceiptGuard Interface" className="object-cover w-full h-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent"></div>
              
              {/* Floating UI Elements */}
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

      {/* Features Grid */}
      <section id="features" className="py-24 bg-card/50 border-y border-white/5">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Everything in one place</h2>
            <p className="text-muted-foreground text-lg">We bring order to the chaos of your inbox by extracting only the financial data that matters.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Smart Receipt Extraction", desc: "Instantly pulls receipts from your inbox, categorizes them, and builds a searchable archive.", icon: Search },
              { title: "Subscription Tracking", desc: "Maps out your recurring expenses. Never get surprised by a forgotten yearly renewal again.", icon: Repeat },
              { title: "Warranty Monitoring", desc: "Tracks purchase dates and warranty windows. Get alerted before your protection expires.", icon: Shield },
            ].map((f, i) => (
              <div key={i} className="p-8 rounded-2xl bg-background border border-border hover:border-primary/50 transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">How it works</h2>
            <p className="text-muted-foreground text-lg">Zero manual data entry required.</p>
          </div>
          
          <div className="space-y-12">
            {[
              { step: "01", title: "Connect your inbox", desc: "Sign in with Google. We only request read-only access to specific emails matching receipt patterns. Your personal emails are never read." },
              { step: "02", title: "AI extraction runs", desc: "Our models scan past and future emails, extracting merchants, totals, dates, and line items instantly." },
              { step: "03", title: "Dashboard populated", desc: "Your dashboard comes alive with spending trends, active subscriptions, and an organized receipt vault." },
              { step: "04", title: "Smart alerts configured", desc: "We automatically set up reminders for upcoming renewals and expiring warranties." },
            ].map((step, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="w-12 h-12 rounded-full bg-secondary text-foreground font-mono font-bold flex items-center justify-center shrink-0 border border-border">
                  {step.step}
                </div>
                <div className="pt-2">
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-card/50 border-y border-white/5">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Simple, transparent pricing</h2>
            <p className="text-muted-foreground text-lg">Start for free, upgrade when you need more power.</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free */}
            <div className="p-8 rounded-3xl bg-background border border-border">
              <h3 className="text-2xl font-bold mb-2">Free</h3>
              <p className="text-muted-foreground mb-6">Perfect for getting started</p>
              <div className="text-5xl font-bold mb-8">$0<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8">
                {["Up to 50 receipts/mo", "Track 5 subscriptions", "Basic categorization", "Email support"].map((ft, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>{ft}</span>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full" onClick={() => setLocation("/signup")}>Start Free</Button>
            </div>
            {/* Pro */}
            <div className="p-8 rounded-3xl bg-background border border-primary relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 rounded-bl-xl font-medium text-sm">Popular</div>
              <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 to-transparent blur-2xl -z-10"></div>
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <p className="text-muted-foreground mb-6">For the financially obsessed</p>
              <div className="text-5xl font-bold mb-8">$5.99<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8">
                {["Unlimited receipts", "Unlimited subscriptions", "Warranty tracking", "Custom renewal alerts", "Priority support"].map((ft, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>{ft}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" onClick={() => setLocation("/signup")}>Upgrade to Pro</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-black font-bold text-xs">R</div>
            <span className="font-bold tracking-tight">ReceiptGuard</span>
          </div>
          <div className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} ReceiptGuard Inc. All rights reserved.
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Security</a>
          </div>
        </div>
      </footer>
    </div>
  )
}