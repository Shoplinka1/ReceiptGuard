import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { BarChart2 } from "lucide-react"

export default function InsightsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
          <p className="text-muted-foreground mt-1">Understand your spending patterns and trends.</p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <BarChart2 className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">Insights coming soon</p>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                Advanced spending analytics, category breakdowns, and trend reports across all your purchases and subscriptions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
