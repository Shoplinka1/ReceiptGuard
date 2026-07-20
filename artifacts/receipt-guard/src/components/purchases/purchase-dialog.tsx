import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { customFetch } from '@workspace/api-client-react'
import { toast } from 'sonner'

const CATEGORIES = [
  'electronics', 'clothing', 'food_dining', 'health_medical', 'entertainment',
  'travel', 'home_garden', 'automotive', 'office_supplies', 'software_subscriptions',
  'sports_fitness', 'education', 'beauty_personal', 'pets', 'other',
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'CAD', 'AUD', 'JPY', 'INR', 'BRL', 'ZAR']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: {
    id: string
    merchantName: string
    amount: number
    currency?: string
    purchaseDate: string
    category: string
    invoiceNumber?: string | null
    notes?: string | null
  } | null
  onSuccess?: () => void
}

export function PurchaseDialog({ open, onOpenChange, item, onSuccess }: Props) {
  const qc = useQueryClient()
  const isEdit = !!item

  const [merchantName, setMerchantName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState('other')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      if (item) {
        setMerchantName(item.merchantName)
        setAmount(String(item.amount))
        setCurrency(item.currency || 'USD')
        setPurchaseDate(item.purchaseDate)
        setCategory(item.category)
        setInvoiceNumber(item.invoiceNumber || '')
        setNotes(item.notes || '')
      } else {
        setMerchantName('')
        setAmount('')
        setCurrency('USD')
        setPurchaseDate(new Date().toISOString().split('T')[0])
        setCategory('other')
        setInvoiceNumber('')
        setNotes('')
      }
    }
  }, [open, item])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['/api/receipts'] })
    qc.invalidateQueries({ queryKey: ['/api/dashboard/summary'] })
    qc.invalidateQueries({ queryKey: ['/api/spending-trend'] })
    qc.invalidateQueries({ queryKey: ['/api/merchants'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: object) => customFetch<any>('/api/receipts', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Purchase added!'); onOpenChange(false); onSuccess?.() },
    onError: (e: any) => toast.error(e.message || 'Failed to add purchase'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: object) => customFetch<any>(`/api/receipts/${item?.id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Purchase updated!'); onOpenChange(false); onSuccess?.() },
    onError: (e: any) => toast.error(e.message || 'Failed to update purchase'),
  })

  const pending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!merchantName.trim() || !amount || !purchaseDate || !category) {
      toast.error('Please fill in all required fields')
      return
    }
    const data = {
      merchantName: merchantName.trim(),
      amount: parseFloat(amount),
      currency,
      purchaseDate,
      category,
      invoiceNumber: invoiceNumber.trim() || null,
      notes: notes.trim() || null,
    }
    if (isEdit) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Purchase' : 'Add Purchase'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the details for this purchase.' : 'Record a new purchase in your vault.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="merchant">Merchant <span className="text-destructive">*</span></Label>
            <Input id="merchant" placeholder="e.g. Apple, Amazon, Nike" value={merchantName} onChange={e => setMerchantName(e.target.value)} required />
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
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
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
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="invoice">Invoice / Order Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input id="invoice" placeholder="e.g. INV-12345" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea id="notes" placeholder="Any additional details…" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="resize-none" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Purchase'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
