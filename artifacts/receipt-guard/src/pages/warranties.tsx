import React from "react"
import { Link } from "wouter"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Shield, ShieldAlert, ShieldCheck, AlertCircle, Mail } from "lucide-react"
import { useListWarranties } from "@workspace/api-client-react"
import { format } from "date-fns"

function safeFormatDate(dateStr: string | null | undefined, fmt: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'
    return format(d, fmt)
  } catch {
    return '—'
  }
}

export default function WarrantiesPage() {
  const { data: warranties, isLoading, error } = useListWarranties()

  const getStatusVariant = (status: string, days: number) => {
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

        {error ? (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <AlertCircle className="w-10 h-10 opacity-30 text-destructive" />
            <p className="text-sm font-medium text-destructive">Failed to load warranties</p>
            <p className="text-xs">Check your connection and refresh the page.</p>
          </div>
        ) : (
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
            ) : !warranties?.length ? (
              <div className="col-span-full py-16 flex flex-col items-center gap-4 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 opacity-30" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">No warranties tracked yet</p>
                  <p className="text-xs mt-1 max-w-xs mx-auto">
                    ReceiptGuard automatically extracts warranty information from your purchase receipts.
                    Connect Gmail to get started.
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
              warranties.map((warranty) => (
                <Card key={warranty.id} className="border-border/50 hover:border-primary/20 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex gap-3 items-center">
                        <div className="p-2 bg-secondary rounded-lg shrink-0">
                          {getStatusIcon(warranty.status, warranty.daysRemaining)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-lg leading-tight truncate">{warranty.productName}</h3>
                          <p className="text-sm text-muted-foreground truncate">{warranty.merchantName || 'Unknown Vendor'}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end shrink-0 ml-2">
                        <Badge variant={getStatusVariant(warranty.status, warranty.daysRemaining) as any} className="uppercase text-[10px] whitespace-nowrap">
                          {warranty.status === 'expired' ? 'Expired' : `${warranty.daysRemaining}d left`}
                        </Badge>
                        {(warranty as any).isEstimated && (
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            title="Warranty length was estimated from the product category — the source email did not state a warranty term."
                          >
                            Estimated
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Purchased</p>
                        <p className="text-sm font-medium">{safeFormatDate(warranty.purchaseDate, "MMM dd, yyyy")}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Expires</p>
                        <p className="text-sm font-medium">{safeFormatDate(warranty.warrantyEndDate, "MMM dd, yyyy")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {!isLoading && !error && (warranties?.length ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {warranties!.length} warrant{warranties!.length !== 1 ? 'ies' : 'y'} tracked
          </p>
        )}
      </div>
    </AppShell>
  )
}
