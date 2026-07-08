import React, { useState, useMemo } from "react"
import { Link } from "wouter"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Calendar, CreditCard, Repeat, Mail, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useListSubscriptions, useGetUserSettings } from "@workspace/api-client-react"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/currency"

export default function SubscriptionsPage() {
  const [search, setSearch] = useState("")
  const { data: subs, isLoading, error } = useListSubscriptions()

  const filtered = useMemo(() => {
    if (!subs) return []
    if (!search.trim()) return subs
    const q = search.toLowerCase()
    return subs.filter(s => (s.companyName ?? '').toLowerCase().includes(q))
  }, [subs, search])

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
            <p className="text-sm text-muted-foreground">Track recurring expenses and upcoming charges.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search…"
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {error ? (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <AlertCircle className="w-10 h-10 opacity-30 text-destructive" />
            <p className="text-sm font-medium text-destructive">Failed to load subscriptions</p>
            <p className="text-xs">Check your connection and refresh the page.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
               [1,2,3,4,5,6].map(i => (
                 <Card key={i} className="border-border/50">
                   <CardContent className="p-6 space-y-4">
                     <div className="flex justify-between">
                       <Skeleton className="w-12 h-12 rounded-xl" />
                       <Skeleton className="w-16 h-6 rounded-full" />
                     </div>
                     <Skeleton className="h-6 w-3/4" />
                     <Skeleton className="h-4 w-1/2" />
                   </CardContent>
                 </Card>
               ))
            ) : filtered.length === 0 && search.trim() ? (
              <div className="col-span-full py-16 flex flex-col items-center gap-3 text-muted-foreground">
                <Search className="w-10 h-10 opacity-20" />
                <p className="text-sm font-semibold text-foreground">No results for "{search}"</p>
                <p className="text-xs">Try a different name or clear the search.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="col-span-full py-16 flex flex-col items-center gap-4 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                  <Repeat className="w-8 h-8 opacity-30" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">No subscriptions found</p>
                  <p className="text-xs mt-1 max-w-xs mx-auto">
                    ReceiptGuard automatically detects recurring charges in your Gmail inbox — Netflix, Spotify, SaaS tools, and more.
                  </p>
                </div>
                <Link href="/connect-gmail">
                  <Button size="sm">
                    <Mail className="w-4 h-4 mr-2" />
                    Connect Gmail to scan
                  </Button>
                </Link>
              </div>
            ) : (
              filtered.map((sub) => (
                <Card key={sub.id} className="border-border/50 hover:border-primary/30 transition-colors group">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center font-bold text-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                        {(sub.companyName ?? '?').substring(0,1).toUpperCase()}
                      </div>
                      <Badge variant={sub.status === 'active' ? 'success' : 'secondary'} className="capitalize">
                        {sub.status}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-lg leading-tight">{sub.companyName}</h3>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-bold">${(sub.monthlyPrice ?? 0).toFixed(2)}</span>
                      <span className="text-sm text-muted-foreground">/mo</span>
                    </div>

                    <div className="mt-6 pt-4 border-t border-border space-y-2 text-sm text-muted-foreground">
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2"><Calendar className="w-4 h-4 shrink-0" /> Next Bill</span>
                        <span className="font-medium text-foreground">
                          {sub.renewalDate ? format(new Date(sub.renewalDate), "MMM dd, yyyy") : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2"><CreditCard className="w-4 h-4 shrink-0" /> Billing</span>
                        <span className="capitalize">{sub.billingCycle ?? 'monthly'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {filtered.length} subscription{filtered.length !== 1 ? 's' : ''}
            {search.trim() ? ` matching "${search}"` : ''}
          </p>
        )}
      </div>
    </AppShell>
  )
}
