import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { RotateCcw } from "lucide-react"

export default function ReturnsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Returns</h1>
          <p className="text-muted-foreground mt-1">Track and manage your return requests.</p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <RotateCcw className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">Returns tracking coming soon</p>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                Log and track return requests, monitor refund status, and link returns back to your purchases.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
