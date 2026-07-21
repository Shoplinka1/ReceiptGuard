import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { customFetch } from '@workspace/api-client-react'
import { toast } from 'sonner'

export const CATEGORIES = [
  { value: 'electronics',          label: 'Electronics' },
  { value: 'clothing',             label: 'Clothing' },
  { value: 'food_dining',          label: 'Food & Dining' },
  { value: 'health_medical',       label: 'Health & Medical' },
  { value: 'entertainment',        label: 'Entertainment' },
  { value: 'travel',               label: 'Travel' },
  { value: 'home_garden',          label: 'Home & Garden' },
  { value: 'automotive',           label: 'Automotive' },
  { value: 'office_supplies',      label: 'Office Supplies' },
  { value: 'software_subscriptions', label: 'Software & Subscriptions' },
  { value: 'sports_fitness',       label: 'Sports & Fitness' },
  { value: 'education',            label: 'Education' },
  { value: 'beauty_personal',      label: 'Beauty & Personal Care' },
  { value: 'pets',                 label: 'Pets' },
  { value: 'other',                label: 'Other' },
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'CAD', 'AUD', 'JPY', 'INR', 'BRL', 'ZAR']

const PAYMENT_METHODS = [
  { value: 'card',         label: 'Credit / Debit Card' },
  { value: 'paypal',       label: 'PayPal' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash',         label: 'Cash' },
  { value: 'crypto',       label: 'Crypto' },
  { value: 'other',        label: 'Other' },
]

export interface PurchaseItem {
  id: string
  merchantName: string
  productName?: string | null
  amount: number
  currency?: string
  purchaseDate: string
  category: string
  invoiceNumber?: string | null
  orderId?: string | null
  paymentMethod?: string | null
  serialNumber?: string | null
  modelNumber?: string | null
  warrantyMonths?: number | null
  returnDeadline?: string | null
  notes?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: PurchaseItem | null
  onSuccess?: () => void
}

export function PurchaseDialog({ open, onOpenChange, item, onSuccess }: Props) {
  const qc = useQueryClient()
  const isEdit = !!item

  const [merchantName, setMerchantName]     = useState('')
  const [productName,  setProductName]      = useState('')
  const [amount,       setAmount]           = useState('')
  const [currency,     setCurrency]         = useState('USD')
  const [purchaseDate, setPurchaseDate]     = useState(new Date().toISOString().split('T')[0])
  const [category,     setCategory]         = useState('other')
  const [paymentMethod, setPaymentMethod]   = useState('')
  const [orderId,       setOrderId]         = useState('')
  const [invoiceNumber, setInvoiceNumber]   = useState('')
  const [serialNumber,  setSerialNumber]    = useState('')
  const [modelNumber,   setModelNumber]     = useState('')
  const [warrantyMonths, setWarrantyMonths] = useState('')
  const [returnDeadline, setReturnDeadline] = useState('')
  const [notes,          setNotes]          = useState('')

  useEffect(() => {
    if (!open) return
    if (item) {
      setMerchantName(item.merchantName ?? '')
      setProductName(item.productName ?? '')
      setAmount(String(item.amount))
      setCurrency(item.currency ?? 'USD')
      setPurchaseDate(item.purchaseDate ?? new Date().toISOString().split('T')[0])
      setCategory(item.category ?? 'other')
      setPaymentMethod(item.paymentMethod ?? '')
      setOrderId(item.orderId ?? '')
      setInvoiceNumber(item.invoiceNumber ?? '')
      setSerialNumber(item.serialNumber ?? '')
      setModelNumber(item.modelNumber ?? '')
      setWarrantyMonths(item.warrantyMonths != null ? String(item.warrantyMonths) : '')
      setReturnDeadline(item.returnDeadline ?? '')
      setNotes(item.notes ?? '')
    } else {
      setMerchantName(''); setProductName(''); setAmount(''); setCurrency('USD')
      setPurchaseDate(new Date().toISOString().split('T')[0])
      setCategory('other'); setPaymentMethod(''); setOrderId('')
      setInvoiceNumber(''); setSerialNumber(''); setModelNumber('')
      setWarrantyMonths(''); setReturnDeadline(''); setNotes('')
    }
  }, [open, item])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['/api/receipts'] })
    qc.invalidateQueries({ queryKey: ['/api/dashboard/summary'] })
    qc.invalidateQueries({ queryKey: ['/api/spending-trend'] })
    qc.invalidateQueries({ queryKey: ['/api/merchants'] })
  }

  const buildPayload = () => ({
    merchantName:  merchantName.trim(),
    productName:   productName.trim() || null,
    amount:        parseFloat(amount),
    currency,
    purchaseDate,
    category,
    paymentMethod: paymentMethod || null,
    orderId:       orderId.trim() || null,
    invoiceNumber: invoiceNumber.trim() || null,
    serialNumber:  serialNumber.trim() || null,
    modelNumber:   modelNumber.trim() || null,
    warrantyMonths: warrantyMonths ? parseInt(warrantyMonths) : null,
    returnDeadline: returnDeadline || null,
    notes:         notes.trim() || null,
  })

  const createMutation = useMutation({
    mutationFn: (data: object) => customFetch<any>('/api/receipts', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Purchase added'); onOpenChange(false); onSuccess?.() },
    onError: (e: any) => toast.error(e.message || 'Failed to add purchase'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: object) => customFetch<any>(`/api/receipts/${item?.id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Purchase updated'); onOpenChange(false); onSuccess?.() },
    onError: (e: any) => toast.error(e.message || 'Failed to update purchase'),
  })

  const pending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!merchantName.trim()) { toast.error('Merchant is required'); return }
    if (!amount || isNaN(parseFloat(amount))) { toast.error('Valid amount is required'); return }
    if (!purchaseDate) { toast.error('Purchase date is required'); return }
    if (!category) { toast.error('Category is required'); return }
    const data = buildPayload()
    if (isEdit) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  const opt = (label: string) => (
    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-1">{label}</p>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle>{isEdit ? 'Edit Purchase' : 'Add Purchase'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the details for this purchase.' : 'Record a purchase in your vault.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto px-6 pb-2">
          <form id="purchase-form" onSubmit={handleSubmit} className="space-y-5 py-4">

            {/* ── Basic info ── */}
            {opt('Purchase Info')}
            <div className="grid gap-1.5">
              <Label htmlFor="merchant">Merchant <span className="text-destructive">*</span></Label>
              <Input id="merchant" placeholder="e.g. Apple, Amazon, Nike" value={merchantName} onChange={e => setMerchantName(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="product">Product name <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input id="product" placeholder="e.g. MacBook Pro 14-inch, Air Max 90" value={productName} onChange={e => setProductName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="amount">Amount <span className="text-destructive">*</span></Label>
                <Input id="amount" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
              </div>
              <div className="grid gap-1.5">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="date">Purchase Date <span className="text-destructive">*</span></Label>
                <Input id="date" type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required />
              </div>
              <div className="grid gap-1.5">
                <Label>Category <span className="text-destructive">*</span></Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Payment Method <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={paymentMethod || '__none'} onValueChange={v => setPaymentMethod(v === '__none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— None —</SelectItem>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Separator />
            {/* ── Reference numbers ── */}
            {opt('Reference Numbers')}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="orderid">Order ID <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input id="orderid" placeholder="e.g. 123-456-789" value={orderId} onChange={e => setOrderId(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="invoice">Invoice Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input id="invoice" placeholder="e.g. INV-0042" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="serial">Serial Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input id="serial" placeholder="e.g. SN-XXXX" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="model">Model Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input id="model" placeholder="e.g. A2442" value={modelNumber} onChange={e => setModelNumber(e.target.value)} />
              </div>
            </div>

            <Separator />
            {/* ── Protection ── */}
            {opt('Protection')}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="warranty">Warranty <span className="text-muted-foreground text-xs">(months)</span></Label>
                <Input id="warranty" type="number" min="0" max="360" placeholder="e.g. 12" value={warrantyMonths} onChange={e => setWarrantyMonths(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="returndeadline">Return Deadline <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input id="returndeadline" type="date" value={returnDeadline} onChange={e => setReturnDeadline(e.target.value)} />
              </div>
            </div>

            <Separator />
            {/* ── Notes ── */}
            {opt('Notes')}
            <div className="grid gap-1.5">
              <Label htmlFor="notes">Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea id="notes" placeholder="Any additional details…" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="resize-none" />
            </div>

          </form>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button type="submit" form="purchase-form" disabled={pending}>
            {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Add Purchase'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
