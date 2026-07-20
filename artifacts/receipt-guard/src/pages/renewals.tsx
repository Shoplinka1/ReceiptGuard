import React, { useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Bell, BellOff, Calendar } from "lucide-react"
import { useListRenewals, useUpdateRenewal, useGetUserSettings } from "@workspace/api-client-react"
import { format, isToday, isThisWeek, isThisMonth } from "date-fns"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/currency"

export default function RenewalsPage() {
  const [period, setPeriod] = useState<'this_month' | 'today' | 'this_week'>('this_month')
  const { data: renewals, isLoading } = useListRenewals({ period })
  const { data: userSettings } = useGetUserSettings()
  const defaultCurrency = userSettings?.currency || 'USD'
  const updateRenewal = useUpdateRenewal()

  const toggleReminder = async (id: number, currentEnabled: boolean) => {
    try {
      await updateRenewal.mutateAsync({ id, data: { reminderEnabled: !currentEnabled } })
      toast.success(currentEnabled ? "Reminder disabled" : "Reminder enabled")
    } catch (e) {
      toast.error("Failed to update reminder")
    }
  }

  const getStatusColor = (days: number) => {
    if (days < 3) return 'destructive'
    if (days < 7) return 'warning'
    return 'success'
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Upcoming Renewals</h1>
          <p className="text-sm text-muted-foreground">Don't let subscriptions catch you off guard.</p>
        </div>

        <div className="flex gap-2 pb-4 overflow-x-auto">
          <Button 
            variant={period === 'today' ? 'default' : 'outline'} 
            onClick={() => setPeriod('today')}
            className="rounded-full px-6"
          >
            Today
          </Button>
          <Button 
            variant={period === 'this_week' ? 'default' : 'outline'} 
            onClick={() => setPeriod('this_week')}
            className="rounded-full px-6"
          >
            This Week
          </Button>
          <Button 
            variant={period === 'this_month' ? 'default' : 'outline'} 
            onClick={() => setPeriod('this_month')}
            className="rounded-full px-6"
          >
            This Month
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
             [1,2,3,4].map(i => (
               <Card key={i} className="border-border/50">
                 <CardContent className="p-6">
                   <Skeleton className="h-6 w-1/2 mb-4" />
                   <Skeleton className="h-4 w-1/4 mb-2" />
                   <Skeleton className="h-4 w-1/3" />
                 </CardContent>
               </Card>
             ))
          ) : renewals?.length ? (
            renewals.map((renewal) => (
              <Card key={renewal.id} className="border-border/50 hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-3 items-center">
                      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-bold text-lg text-primary">
                        {renewal.companyName.substring(0,1)}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg leading-tight">{renewal.companyName}</h3>
                        <p className="text-sm text-muted-foreground">{formatCurrency(renewal.amount, (renewal as any).currency || defaultCurrency)}</p>
                      </div>
                    </div>
                    <Badge variant={getStatusColor(renewal.daysUntilRenewal) as any} className="uppercase text-[10px]">
                      {renewal.daysUntilRenewal === 0 ? 'Today' : `In ${renewal.daysUntilRenewal} days`}
                    </Badge>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-border flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(renewal.renewalDate), "MMM dd, yyyy")}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={renewal.reminderEnabled ? "text-primary" : "text-muted-foreground"}
                      onClick={() => toggleReminder(renewal.id, renewal.reminderEnabled)}
                    >
                      {renewal.reminderEnabled ? <Bell className="w-4 h-4 mr-2" /> : <BellOff className="w-4 h-4 mr-2" />}
                      {renewal.reminderEnabled ? 'Reminder On' : 'Reminder Off'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-muted-foreground border rounded-xl border-dashed">
              No renewals found for {period.replace('_', ' ')}.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}