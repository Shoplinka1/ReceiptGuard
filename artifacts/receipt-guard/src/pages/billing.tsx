import React from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useGetUserProfile } from "@workspace/api-client-react"
import { CheckCircle2, CreditCard, Sparkles } from "lucide-react"

export default function BillingPage() {
  const { data: profile } = useGetUserProfile()
  const isPro = profile?.plan === 'pro'

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Plans</h1>
          <p className="text-sm text-muted-foreground">Manage your subscription and payment methods.</p>
        </div>

        <Card className="border-primary/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Sparkles className="w-24 h-24" />
          </div>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>You are currently on the <strong className="text-foreground capitalize">{profile?.plan || 'Free'}</strong> plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold">
                {isPro ? '$5.99' : '$0'}
              </div>
              <div className="text-muted-foreground">/ month</div>
              {isPro && <Badge variant="success" className="ml-auto">Active</Badge>}
            </div>

            {!isPro ? (
              <div className="bg-secondary/50 rounded-xl p-6 border border-border">
                <h3 className="font-semibold text-lg mb-4">Upgrade to Pro to unlock:</h3>
                <ul className="space-y-3 mb-6">
                  {["Unlimited receipts", "Unlimited subscriptions", "Warranty tracking", "Custom renewal alerts"].map((ft, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span>{ft}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full sm:w-auto">Upgrade to Pro - $5.99/mo</Button>
              </div>
            ) : (
              <div className="flex gap-4">
                <Button variant="outline">Manage Subscription</Button>
                <Button variant="destructive" className="bg-destructive/10 text-destructive border-transparent hover:bg-destructive hover:text-white">Cancel Plan</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {isPro && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-secondary rounded-lg">
                  <CreditCard className="w-6 h-6 text-foreground" />
                </div>
                <div>
                  <p className="font-medium">Visa ending in 4242</p>
                  <p className="text-sm text-muted-foreground">Expires 12/2026</p>
                </div>
              </div>
              <Button variant="outline">Update</Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
          </CardHeader>
          <CardContent>
            {isPro ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between items-center py-3 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium">ReceiptGuard Pro - Monthly</p>
                      <p className="text-sm text-muted-foreground">Oct {i}, 2023</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-medium">$5.99</span>
                      <Button variant="ghost" size="sm" className="h-8">Receipt</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-6 text-muted-foreground">No past invoices available on the Free plan.</p>
            )}
          </CardContent>
        </Card>

      </div>
    </AppShell>
  )
}