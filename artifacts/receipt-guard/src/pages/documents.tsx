import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { FileText } from "lucide-react"

export default function DocumentsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground mt-1">Store receipts, warranties, and invoices in one place.</p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">Document storage coming soon</p>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                Upload and organise PDFs, images, and invoices linked to your purchases, warranties, and returns.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
