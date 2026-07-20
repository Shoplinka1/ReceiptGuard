import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ShoppingCart, Smartphone, Globe, CreditCard,
  FileSpreadsheet, Camera, Mail, FolderInput,
} from "lucide-react"

// ─── Central IMPORT_SOURCES registry ─────────────────────────────────────────
// Each source has a stable id, display metadata, and capability flags.
// When an adapter is implemented, set status to 'available' and add the
// connect handler — no other component needs to change.

export type ImportStatus = 'coming_soon' | 'available' | 'beta'

export interface ImportSource {
  id: string
  name: string
  description: string
  icon: React.ElementType
  category: 'retail' | 'app_store' | 'payments' | 'documents' | 'email'
  status: ImportStatus
  supportsManualUpload: boolean
  futureAdapter: boolean
}

export const IMPORT_SOURCES: ImportSource[] = [
  // Retail
  {
    id: 'amazon',
    name: 'Amazon',
    description: 'Import your complete Amazon order history — products, amounts, and dates.',
    icon: ShoppingCart,
    category: 'retail',
    status: 'coming_soon',
    supportsManualUpload: false,
    futureAdapter: true,
  },
  // App Stores
  {
    id: 'apple_app_store',
    name: 'Apple App Store',
    description: 'Sync in-app purchases and subscriptions from your Apple account.',
    icon: Smartphone,
    category: 'app_store',
    status: 'coming_soon',
    supportsManualUpload: false,
    futureAdapter: true,
  },
  {
    id: 'google_play',
    name: 'Google Play',
    description: 'Import purchases and subscriptions from your Google Play account.',
    icon: Globe,
    category: 'app_store',
    status: 'coming_soon',
    supportsManualUpload: false,
    futureAdapter: true,
  },
  // Payments
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Pull your full PayPal transaction history automatically.',
    icon: CreditCard,
    category: 'payments',
    status: 'coming_soon',
    supportsManualUpload: false,
    futureAdapter: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Import receipts and invoices from Stripe-powered merchants.',
    icon: CreditCard,
    category: 'payments',
    status: 'coming_soon',
    supportsManualUpload: false,
    futureAdapter: true,
  },
  // Documents
  {
    id: 'ocr',
    name: 'OCR Receipt Scan',
    description: 'Snap a photo of any paper receipt — AI extracts merchant, amount, and date.',
    icon: Camera,
    category: 'documents',
    status: 'coming_soon',
    supportsManualUpload: true,
    futureAdapter: false,
  },
  {
    id: 'csv',
    name: 'CSV Import',
    description: 'Upload a spreadsheet of transactions in CSV format and map columns.',
    icon: FileSpreadsheet,
    category: 'documents',
    status: 'coming_soon',
    supportsManualUpload: true,
    futureAdapter: false,
  },
  // Email
  {
    id: 'email_forwarding',
    name: 'Email Forwarding',
    description: 'Forward receipts to your personal ReceiptGuard address for automatic parsing.',
    icon: Mail,
    category: 'email',
    status: 'coming_soon',
    supportsManualUpload: false,
    futureAdapter: true,
  },
]

const CATEGORY_LABELS: Record<ImportSource['category'], string> = {
  retail:    'Retail',
  app_store: 'App Stores',
  payments:  'Payments',
  documents: 'Documents',
  email:     'Email',
}

const CATEGORY_ORDER: ImportSource['category'][] = [
  'retail', 'app_store', 'payments', 'documents', 'email',
]

function StatusBadge({ status }: { status: ImportStatus }) {
  if (status === 'available') return <Badge className="text-[10px] shrink-0 bg-emerald-500/15 text-emerald-600 border-0">Available</Badge>
  if (status === 'beta')      return <Badge className="text-[10px] shrink-0 bg-blue-500/15 text-blue-600 border-0">Beta</Badge>
  return <Badge variant="secondary" className="text-[10px] shrink-0">Coming Soon</Badge>
}

export default function ImportCenterPage() {
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    sources: IMPORT_SOURCES.filter(s => s.category === cat),
  }))

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Import Center</h1>
            <p className="text-muted-foreground mt-1">
              Connect your accounts and import purchases from any source.
              More sources are added regularly.
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FolderInput className="w-5 h-5 text-primary" />
          </div>
        </div>

        {/* Grouped source cards */}
        {grouped.map(({ category, label, sources }) => (
          <div key={category}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">{label}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sources.map(source => (
                <Card key={source.id} className="relative overflow-hidden transition-colors hover:border-border/80">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <source.icon className="w-5 h-5 text-primary" />
                      </div>
                      <StatusBadge status={source.status} />
                    </div>
                    <CardTitle className="text-base mt-3">{source.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{source.description}</p>
                    {source.supportsManualUpload && (
                      <p className="text-xs text-primary/70 mt-2 font-medium">Supports manual upload</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        <p className="text-xs text-muted-foreground text-center pt-4 pb-8">
          All import sources currently show as Coming Soon. Adapters are being built and released progressively.
          <br />
          You can add purchases manually from the{" "}
          <a href="/purchases" className="text-primary hover:underline">Purchases</a> page today.
        </p>
      </div>
    </AppShell>
  )
}
