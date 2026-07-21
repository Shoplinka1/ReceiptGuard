import React, { useRef } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import {
  Pencil, Trash2, ShieldCheck, RotateCcw, Paperclip,
  FileText, Upload, X, ExternalLink, Calendar,
  Tag, CreditCard, Hash, Cpu, FileDigit, Loader2,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customFetch } from '@workspace/api-client-react'
import { format, differenceInDays, addMonths } from 'date-fns'
import { formatCurrency } from '@/lib/currency'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { PurchaseItem } from './purchase-dialog'
import { CATEGORIES } from './purchase-dialog'

// ─── types ────────────────────────────────────────────────────────────────────

interface Document {
  id: string
  name: string
  fileUrl: string
  fileType: string | null
  fileSizeBytes: number | null
  category: string
  createdAt: string
}

interface ReturnRecord {
  id: string
  status: string
  initiatedDate: string
  resolvedDate: string | null
  reason: string | null
  trackingNumber: string | null
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const DOC_CATEGORIES = [
  { value: 'receipt',  label: 'Receipt' },
  { value: 'invoice',  label: 'Invoice' },
  { value: 'manual',   label: 'Manual' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'other',    label: 'Other' },
]

const DOC_CATEGORY_ICONS: Record<string, React.ElementType> = {
  receipt: FileText, invoice: FileDigit, manual: FileText,
  warranty: ShieldCheck, other: Paperclip,
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function categoryLabel(value: string) {
  return CATEGORIES.find(c => c.value === value)?.label ?? value
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between items-start gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground text-right break-all">{value}</span>
    </div>
  )
}

function SectionHeading({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  )
}

// ─── Return window ────────────────────────────────────────────────────────────

type ReturnWindowStatus = 'none' | 'eligible' | 'expiring' | 'initiated' | 'completed' | 'missed' | 'denied'

function computeReturnStatus(
  returnDeadline: string | null | undefined,
  record: ReturnRecord | null | undefined
): { status: ReturnWindowStatus; daysLeft: number | null } {
  if (!returnDeadline) return { status: 'none', daysLeft: null }
  const deadline = new Date(returnDeadline)
  const daysLeft = differenceInDays(deadline, new Date())
  if (record) {
    if (record.status === 'completed') return { status: 'completed', daysLeft }
    if (record.status === 'denied') return { status: 'denied', daysLeft }
    return { status: 'initiated', daysLeft }
  }
  if (daysLeft < 0) return { status: 'missed', daysLeft }
  if (daysLeft <= 7) return { status: 'expiring', daysLeft }
  return { status: 'eligible', daysLeft }
}

const RETURN_STATUS_CONFIG: Record<ReturnWindowStatus, { label: string; color: string; bg: string }> = {
  none:      { label: 'No window set',  color: 'text-muted-foreground', bg: 'bg-muted/50' },
  eligible:  { label: 'Eligible',       color: 'text-emerald-600',      bg: 'bg-emerald-500/10' },
  expiring:  { label: 'Expiring soon',  color: 'text-amber-600',        bg: 'bg-amber-500/10' },
  initiated: { label: 'Initiated',      color: 'text-blue-600',         bg: 'bg-blue-500/10' },
  completed: { label: 'Completed',      color: 'text-emerald-600',      bg: 'bg-emerald-500/10' },
  missed:    { label: 'Missed',         color: 'text-destructive',      bg: 'bg-destructive/10' },
  denied:    { label: 'Denied',         color: 'text-destructive',      bg: 'bg-destructive/10' },
}

// ─── Warranty ─────────────────────────────────────────────────────────────────

function warrantyEndDate(p: PurchaseItem): Date | null {
  if (p.warrantyEndDate) return new Date((p as any).warrantyEndDate)
  if (p.warrantyMonths && p.purchaseDate) return addMonths(new Date(p.purchaseDate), p.warrantyMonths)
  return null
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  purchase: PurchaseItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (item: PurchaseItem) => void
  onDelete: (id: string) => void
}

export function PurchaseDetailDrawer({ purchase, open, onOpenChange, onEdit, onDelete }: Props) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadCategory, setUploadCategory] = React.useState('receipt')
  const [uploading, setUploading] = React.useState(false)

  const id = purchase?.id ?? ''

  // Fetch documents linked to this purchase
  const { data: docs = [], refetch: refetchDocs } = useQuery<Document[]>({
    queryKey: ['/api/documents', id],
    queryFn: () => customFetch<Document[]>(`/api/documents?receiptId=${id}`),
    enabled: open && !!id,
  })

  // Fetch linked return record
  const { data: returns = [] } = useQuery<ReturnRecord[]>({
    queryKey: ['/api/returns', 'receipt', id],
    queryFn: () => customFetch<ReturnRecord[]>(`/api/returns?receiptId=${id}`),
    enabled: open && !!id,
  })
  const linkedReturn = returns[0] ?? null

  // Delete document
  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => customFetch(`/api/documents/${docId}`, { method: 'DELETE' }),
    onSuccess: () => { refetchDocs(); toast.success('Attachment removed') },
    onError: () => toast.error('Failed to remove attachment'),
  })

  // Upload a file to Supabase Storage then save metadata
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    e.target.value = ''
    setUploading(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const uid = session?.session?.user?.id
      if (!uid) { toast.error('Not signed in'); return }

      const ext  = file.name.split('.').pop() ?? 'bin'
      const path = `documents/${uid}/${id}/${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('attachments')
        .upload(path, file, { cacheControl: '3600', upsert: false })

      if (upErr) {
        // Bucket may not exist — give a clear message
        if ((upErr as any).message?.includes('bucket')) {
          toast.error('Storage bucket "attachments" not found. Create it in Supabase Dashboard → Storage.')
        } else {
          toast.error(`Upload failed: ${(upErr as any).message}`)
        }
        return
      }

      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)
      const fileUrl = urlData?.publicUrl ?? ''

      await customFetch('/api/documents', {
        method: 'POST',
        body: JSON.stringify({
          name: file.name,
          fileUrl,
          fileType: file.type.startsWith('image/') ? 'image' : file.name.endsWith('.pdf') ? 'pdf' : 'other',
          fileSizeBytes: file.size,
          category: uploadCategory,
          receiptId: id,
        }),
      })
      refetchDocs()
      qc.invalidateQueries({ queryKey: ['/api/documents', id] })
      toast.success('Attachment uploaded')
    } catch (err: any) {
      toast.error(err?.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (!purchase) return null

  const today      = new Date()
  const wEnd       = warrantyEndDate(purchase)
  const wDaysLeft  = wEnd ? differenceInDays(wEnd, today) : null
  const { status: returnStatus, daysLeft: returnDaysLeft } = computeReturnStatus(purchase.returnDeadline, linkedReturn)
  const returnCfg  = RETURN_STATUS_CONFIG[returnStatus]

  const initials = (purchase.merchantName ?? '?').substring(0, 2).toUpperCase()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-lg font-semibold leading-tight truncate">
                  {purchase.merchantName}
                </SheetTitle>
                {purchase.productName && (
                  <p className="text-sm text-muted-foreground truncate">{purchase.productName}</p>
                )}
                <p className="text-xl font-bold mt-0.5 text-foreground">
                  {formatCurrency(purchase.amount ?? 0, purchase.currency || 'USD')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-1">
              <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => { onEdit(purchase); onOpenChange(false) }}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
              </Button>
              <Button size="sm" variant="outline" className="h-8 px-3 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
                onClick={() => { onDelete(purchase.id); onOpenChange(false) }}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">

            {/* ── Purchase Details ── */}
            <div className="space-y-3">
              <SectionHeading icon={Tag} label="Details" />
              <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                <DetailRow label="Date" value={purchase.purchaseDate ? format(new Date(purchase.purchaseDate), 'MMMM d, yyyy') : undefined} />
                <DetailRow label="Category" value={categoryLabel(purchase.category)} />
                <DetailRow label="Payment Method" value={purchase.paymentMethod?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} />
                <DetailRow label="Currency" value={purchase.currency} />
              </div>
            </div>

            {/* ── Reference Numbers ── */}
            {(purchase.orderId || purchase.invoiceNumber || purchase.serialNumber || purchase.modelNumber) && (
              <div className="space-y-3">
                <SectionHeading icon={Hash} label="Reference Numbers" />
                <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                  <DetailRow label="Order ID"       value={purchase.orderId} />
                  <DetailRow label="Invoice Number" value={purchase.invoiceNumber} />
                  <DetailRow label="Serial Number"  value={purchase.serialNumber} />
                  <DetailRow label="Model Number"   value={purchase.modelNumber} />
                </div>
              </div>
            )}

            {/* ── Notes ── */}
            {purchase.notes && (
              <div className="space-y-2">
                <SectionHeading icon={FileText} label="Notes" />
                <p className="text-sm text-foreground/80 bg-muted/30 rounded-lg p-3 leading-relaxed">{purchase.notes}</p>
              </div>
            )}

            <Separator />

            {/* ── Return Window ── */}
            <div className="space-y-3">
              <SectionHeading icon={RotateCcw} label="Return Window" />
              {returnStatus === 'none' ? (
                <div className={`rounded-lg p-4 ${returnCfg.bg}`}>
                  <p className="text-sm text-muted-foreground">No return deadline set for this purchase.</p>
                </div>
              ) : (
                <div className={`rounded-lg p-4 space-y-3 ${returnCfg.bg}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {purchase.returnDeadline ? format(new Date(purchase.returnDeadline), 'MMMM d, yyyy') : '—'}
                      </p>
                      {returnDaysLeft !== null && returnDaysLeft >= 0 && (
                        <p className="text-xs text-muted-foreground">
                          {returnDaysLeft === 0 ? 'Last day to return' : `${returnDaysLeft} day${returnDaysLeft === 1 ? '' : 's'} remaining`}
                        </p>
                      )}
                      {returnDaysLeft !== null && returnDaysLeft < 0 && (
                        <p className="text-xs text-muted-foreground">Deadline passed {Math.abs(returnDaysLeft)} day{Math.abs(returnDaysLeft) === 1 ? '' : 's'} ago</p>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-xs font-medium ${returnCfg.color} border-current/30 shrink-0`}>
                      {returnCfg.label}
                    </Badge>
                  </div>
                  {returnDaysLeft !== null && returnDaysLeft >= 0 && (returnStatus === 'eligible' || returnStatus === 'expiring') && (
                    <Progress value={Math.max(0, Math.min(100, ((returnDaysLeft) / 30) * 100))} className="h-1.5" />
                  )}
                  {linkedReturn && (
                    <div className="text-xs text-muted-foreground space-y-0.5 border-t border-border/40 pt-2">
                      <p>Return initiated: {format(new Date(linkedReturn.initiatedDate), 'MMM d, yyyy')}</p>
                      {linkedReturn.trackingNumber && <p>Tracking: {linkedReturn.trackingNumber}</p>}
                      {linkedReturn.reason && <p>Reason: {linkedReturn.reason}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Warranty ── */}
            <div className="space-y-3">
              <SectionHeading icon={ShieldCheck} label="Warranty" />
              {!purchase.warrantyMonths && !wEnd ? (
                <div className="rounded-lg p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">No warranty information recorded.</p>
                </div>
              ) : (
                <div className={`rounded-lg p-4 space-y-2 ${
                  wDaysLeft === null ? 'bg-muted/30'
                    : wDaysLeft > 30 ? 'bg-emerald-500/10'
                    : wDaysLeft >= 0 ? 'bg-amber-500/10'
                    : 'bg-destructive/10'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      {purchase.warrantyMonths && (
                        <p className="text-sm font-medium text-foreground">
                          {purchase.warrantyMonths >= 12
                            ? `${Math.round(purchase.warrantyMonths / 12)} year${purchase.warrantyMonths >= 24 ? 's' : ''}`
                            : `${purchase.warrantyMonths} month${purchase.warrantyMonths !== 1 ? 's' : ''}`} warranty
                        </p>
                      )}
                      {wEnd && (
                        <p className="text-xs text-muted-foreground">
                          Expires {format(wEnd, 'MMMM d, yyyy')}
                          {wDaysLeft !== null && wDaysLeft >= 0 && ` · ${wDaysLeft}d left`}
                          {wDaysLeft !== null && wDaysLeft < 0 && ` · expired`}
                        </p>
                      )}
                    </div>
                    {wDaysLeft !== null && (
                      <Badge variant="outline" className={`text-xs shrink-0 ${
                        wDaysLeft > 30 ? 'text-emerald-600 border-emerald-500/30'
                          : wDaysLeft >= 0 ? 'text-amber-600 border-amber-500/30'
                          : 'text-destructive border-destructive/30'
                      }`}>
                        {wDaysLeft > 30 ? 'Active' : wDaysLeft >= 0 ? 'Expiring soon' : 'Expired'}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* ── Attachments ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionHeading icon={Paperclip} label={`Attachments${docs.length > 0 ? ` (${docs.length})` : ''}`} />
              </div>

              {/* Upload row */}
              <div className="flex items-center gap-2">
                <select
                  value={uploadCategory}
                  onChange={e => setUploadCategory(e.target.value)}
                  className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {DOC_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs flex-1"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading…</>
                    : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload file</>
                  }
                </Button>
                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" onChange={handleFileUpload} />
              </div>

              {/* Document list */}
              {docs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
                  <Paperclip className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No attachments yet.</p>
                  <p className="text-xs text-muted-foreground">Upload receipts, invoices, manuals, or warranties.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map(doc => {
                    const DocIcon = DOC_CATEGORY_ICONS[doc.category] ?? Paperclip
                    return (
                      <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors group">
                        <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
                          <DocIcon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {DOC_CATEGORIES.find(c => c.value === doc.category)?.label ?? doc.category}
                            {doc.fileSizeBytes ? ` · ${formatBytes(doc.fileSizeBytes)}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deleteDocMutation.mutate(doc.id)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
