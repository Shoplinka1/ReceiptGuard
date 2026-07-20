import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { customFetch } from '@workspace/api-client-react'
import { toast } from 'sonner'
import { addMonths, format } from 'date-fns'

// Suggested warranty periods by type
const WARRANTY_PRESETS = [
  { label: '30 days', months: 1 },
  { label: '90 days', months: 3 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
  { label: '2 years', months: 24 },
  { label: '3 years', months: 36 },
  { label: '5 years', months: 60 },
]

interface WarrantyItem {
  id: string
  productName: string
  merchantName?: string | null
  purchaseDate: string
  warrantyEndDate: string
  reminderEnabled?: boolean
  notes?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: WarrantyItem | null
  onSuccess?: () => void
}

export function WarrantyDialog({ open, onOpenChange, item, onSuccess }: Props) {
  const qc = useQueryClient()
  const isEdit = !!item

  const [productName, setProductName] = useState('')
  const [merchantName, setMerchantName] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [warrantyEndDate, setWarrantyEndDate] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      if (item) {
        setProductName(item.productName)
        setMerchantName(item.merchantName || '')
        setPurchaseDate(item.purchaseDate)
        setWarrantyEndDate(item.warrantyEndDate)
        setReminderEnabled(item.reminderEnabled ?? true)
        setNotes(item.notes || '')
      } else {
        setProductName(''); setMerchantName('')
        const today = new Date().toISOString().split('T')[0]
        setPurchaseDate(today)
        // Default to 1 year from today
        setWarrantyEndDate(format(addMonths(new Date(), 12), 'yyyy-MM-dd'))
        setReminderEnabled(true); setNotes('')
      }
    }
  }, [open, item])

  // When purchase date changes and not editing, recalculate end date to 1yr
  const handlePurchaseDateChange = (val: string) => {
    setPurchaseDate(val)
    if (!isEdit && val) {
      try {
        setWarrantyEndDate(format(addMonths(new Date(val), 12), 'yyyy-MM-dd'))
      } catch {}
    }
  }

  const applyPreset = (months: number) => {
    if (purchaseDate) {
      try {
        setWarrantyEndDate(format(addMonths(new Date(purchaseDate), months), 'yyyy-MM-dd'))
      } catch {}
    }
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['/api/warranties'] })
    qc.invalidateQueries({ queryKey: ['/api/dashboard/summary'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: object) => customFetch<any>('/api/warranties', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Warranty added!'); onOpenChange(false); onSuccess?.() },
    onError: (e: any) => toast.error(e.message || 'Failed to add warranty'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: object) => customFetch<any>(`/api/warranties/${item?.id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Warranty updated!'); onOpenChange(false); onSuccess?.() },
    onError: (e: any) => toast.error(e.message || 'Failed to update warranty'),
  })

  const pending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!productName.trim() || !purchaseDate || !warrantyEndDate) {
      toast.error('Please fill in all required fields')
      return
    }
    if (new Date(warrantyEndDate) < new Date(purchaseDate)) {
      toast.error('Warranty end date must be after purchase date')
      return
    }
    const data = {
      productName: productName.trim(),
      merchantName: merchantName.trim() || null,
      purchaseDate,
      warrantyEndDate,
      reminderEnabled,
      notes: notes.trim() || null,
    }
    if (isEdit) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Warranty' : 'Add Warranty'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update warranty details.' : 'Track a product warranty to get expiry alerts.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Product Name <span className="text-destructive">*</span></Label>
            <Input placeholder="e.g. MacBook Pro 14-inch, Samsung TV 65&quot;" value={productName} onChange={e => setProductName(e.target.value)} required />
          </div>

          <div className="grid gap-1.5">
            <Label>Merchant / Store <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input placeholder="e.g. Apple Store, Best Buy, Amazon" value={merchantName} onChange={e => setMerchantName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Purchase Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={purchaseDate} onChange={e => handlePurchaseDateChange(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label>Warranty Expires <span className="text-destructive">*</span></Label>
              <Input type="date" value={warrantyEndDate} onChange={e => setWarrantyEndDate(e.target.value)} required />
            </div>
          </div>

          {/* Quick presets */}
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Quick set warranty period</Label>
            <div className="flex flex-wrap gap-1.5">
              {WARRANTY_PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.months)}
                  className="text-xs px-2.5 py-1 rounded-md border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea placeholder="Serial number, claim instructions, etc." value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="resize-none" />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="reminder" checked={reminderEnabled} onCheckedChange={v => setReminderEnabled(Boolean(v))} />
            <Label htmlFor="reminder" className="cursor-pointer text-sm">Send reminder before expiry</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Warranty'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
