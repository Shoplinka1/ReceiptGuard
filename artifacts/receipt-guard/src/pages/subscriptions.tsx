import React from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Search, Calendar, CreditCard } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useListSubscriptions } from "@workspace/api-client-react"
import { format } from "date-fns"

export default function SubscriptionsPage() {
  const { data: subs, isLoading } = useListSubscriptions()

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
            <p className="text-sm text-muted-foreground">Track recurring expenses and upcoming charges.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-9" />
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Add Manual
            </Button>
          </div>
        </div>

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
          ) : subs?.length ? (
            subs.map((sub) => (
              <Card key={sub.id} className="border-border/50 hover:border-primary/30 transition-colors group">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center font-bold text-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      {sub.companyName.substring(0,1)}
                    </div>
                    <Badge variant={sub.status === 'active' ? 'success' : 'secondary'} className="capitalize">
                      {sub.status}
                    </Badge>
                  </div>
                  <h3 className="font-bold text-lg">{sub.companyName}</h3>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-bold">${sub.monthlyPrice.toFixed(2)}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-border space-y-2 text-sm text-muted-foreground">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Next Bill</span>
                      <span className="font-medium text-foreground">
                        {format(new Date(sub.renewalDate), "MMM dd")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Billing</span>
                      <span className="capitalize">{sub.billingCycle}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-muted-foreground border rounded-xl border-dashed">
              No subscriptions found. Connect your Gmail to scan automatically.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}