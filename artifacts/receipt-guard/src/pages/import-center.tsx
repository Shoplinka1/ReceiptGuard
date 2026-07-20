import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FolderInput, ShoppingCart, Smartphone, Globe, CreditCard, FileSpreadsheet, Camera, Mail } from "lucide-react"

const importSources = [
  {
    icon: ShoppingCart,
    name: "Amazon",
    description: "Import order history from your Amazon account.",
  },
  {
    icon: Smartphone,
    name: "Apple App Store",
    description: "Sync in-app purchases and subscriptions from Apple.",
  },
  {
    icon: Globe,
    name: "Google Play",
    description: "Import purchases and subscriptions from Google Play.",
  },
  {
    icon: CreditCard,
    name: "PayPal",
    description: "Pull transaction history from your PayPal account.",
  },
  {
    icon: CreditCard,
    name: "Stripe",
    description: "Import receipts from Stripe-powered merchants.",
  },
  {
    icon: Camera,
    name: "OCR (Photo)",
    description: "Snap a photo of a paper receipt to extract the data.",
  },
  {
    icon: FileSpreadsheet,
    name: "CSV Upload",
    description: "Import a spreadsheet of transactions in CSV format.",
  },
  {
    icon: Mail,
    name: "Email Forwarding",
    description: "Forward receipts to your personal ReceiptGuard address.",
  },
]

export default function ImportCenterPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import Center</h1>
          <p className="text-muted-foreground mt-1">Connect your accounts and import purchases from any source.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {importSources.map((source) => (
            <Card key={source.name} className="relative opacity-75">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <source.icon className="w-5 h-5 text-primary" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">Coming Soon</Badge>
                </div>
                <CardTitle className="text-base mt-2">{source.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{source.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2">
          More import sources are on the roadmap. Gmail scanning is already available — check your Dashboard.
        </p>
      </div>
    </AppShell>
  )
}
