import React from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react"
import { useListWarranties } from "@workspace/api-client-react"
import { format } from "date-fns"

export default function WarrantiesPage() {
  const { data: warranties, isLoading } = useListWarranties()

  const getStatusColor = (status: string, days: number) => {
    if (status === 'expired') return 'destructive'
    if (days < 30) return 'warning'
    return 'success'
  }

  const getStatusIcon = (status: string, days: number) => {
    if (status === 'expired') return <ShieldAlert className="w-5 h-5 text-destructive" />
    if (days < 30) return <Shield className="w-5 h-5 text-amber-500" />
    return <ShieldCheck className="w-5 h-5 text-emerald-500" />
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warranty Tracker</h1>
          <p className="text-sm text-muted-foreground">Keep an eye on active product protections.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          ) : warranties?.length ? (
            warranties.map((warranty) => (
              <Card key={warranty.id} className="border-border/50">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-3 items-center">
                      <div className="p-2 bg-secondary rounded-lg">
                        {getStatusIcon(warranty.status, warranty.daysRemaining)}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg leading-tight">{warranty.productName}</h3>
                        <p className="text-sm text-muted-foreground">{warranty.merchantName || 'Unknown Vendor'}</p>
                      </div>
                    </div>
                    <Badge variant={getStatusColor(warranty.status, warranty.daysRemaining) as any} className="uppercase text-[10px]">
                      {warranty.status === 'expired' ? 'Expired' : `${warranty.daysRemaining} days left`}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Purchased</p>
                      <p className="text-sm font-medium">{format(new Date(warranty.purchaseDate), "MMM dd, yyyy")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Expires</p>
                      <p className="text-sm font-medium">{format(new Date(warranty.warrantyEndDate), "MMM dd, yyyy")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-muted-foreground border rounded-xl border-dashed">
              No active warranties found.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}