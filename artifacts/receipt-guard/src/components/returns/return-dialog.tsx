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

const RETURN_STATUSES = [
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'denied',      label: 'Denied' },
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'CAD', 'AUD', 'JPY', 'INR', 'BRL', 'ZAR']

const WINDOW_DAY_OPTIONS = [
  { value: 14,  label: '14 days' },
  { value: 30,  label: '30 days (standard)' },
  { value: 60,  label: '60 days' },
  { value: 90,  label: '90 days' },
]

interface ReturnItem {
  id: string
  merchantName: string
  amount?: number | null
  currency?: string
  reason?: string | null
  status: string
  initiatedDate: string
  resolvedDate?: string | null
  trackingNumber?: string | null
  notes?: string | null
  windowDays?: number | null
  returnDeadline?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: ReturnItem | null
  onSuccess?: () => void
}

export function ReturnDialog({ open, onOpenChange, item, onSuccess }: Props) {
  const qc = useQueryClient()
  const isEdit = !!item

  const [merchantName, setMerchantName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState('open')
  const [initiatedDate, setInitiatedDate] = useState(new Date().toISOString().split('T')[0])
  const [resolvedDate, setResolvedDate] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [windowDays, setWindowDays] = useState(30)

  useEffect(() => {
    if (open) {
      if (item) {
        setMerchantName(item.merchantName)
        setAmount(item.amount ? String(item.amount) : '')
        setCurrency(item.currency || 'USD')
        setReason(item.reason || '')
        setStatus(item.status)
        setInitiatedDate(item.initiatedDate)
        setResolvedDate(item.resolvedDate || '')
        setTrackingNumber(item.trackingNumber || '')
        setNotes(item.notes || '')
        setWindowDays(item.windowDays ?? 30)
      } else {
        setMerchantName(''); setAmount(''); setCurrency('USD'); setReason('')
        setStatus('open'); setInitiatedDate(new Date().toISOString().split('T')[0])
        setResolvedDate(''); setTrackingNumber(''); setNotes(''); setWindowDays(30)
      }
    }
  }, [open, item])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['/api/returns'] })
    qc.invalidateQueries({ queryKey: ['/api/dashboard/summary'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: object) => customFetch<any>('/api/returns', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Return logged!'); onOpenChange(false); onSuccess?.() },
    onError: (e: any) => toast.error(e.message || 'Failed to log return'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: object) => customFetch<any>(`/api/returns/${item?.id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Return updated!'); onOpenChange(false); onSuccess?.() },
    onError: (e: any) => toast.error(e.message || 'Failed to update return'),
  })

  const pending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!merchantName.trim() || !initiatedDate) {
      toast.error('Merchant name and initiated date are required')
      return
    }
    const data = {
      merchantName: merchantName.trim(),
      amount: amount ? parseFloat(amount) : null,
      currency,
      reason: reason.trim() || null,
      status,
      initiatedDate,
      resolvedDate: resolvedDate || null,
      trackingNumber: trackingNumber.trim() || null,
      notes: notes.trim() || null,
      windowDays,
    }
    if (isEdit) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Return' : 'Log Return'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update return request details.' : 'Track a new return request to stay on top of deadlines.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Merchant <span className="text-destructive">*</span></Label>
            <Input placeholder="e.g. Amazon, Nike, Apple" value={merchantName} onChange={e => setMerchantName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Return Amount <span className="text-muted-foreground text-xs">(opt)</span></Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
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

          <div className="grid gap-1.5">
            <Label>Reason for Return <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea placeholder="e.g. Wrong size, defective, changed mind" value={reason} onChange={e => setReason(e.target.value)} rows={2} className="resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Date Initiated <span className="text-destructive">*</span></Label>
              <Input type="date" value={initiatedDate} onChange={e => setInitiatedDate(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RETURN_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(status === 'completed' || status === 'denied') && (
            <div className="grid gap-1.5">
              <Label>Resolution Date</Label>
              <Input type="date" value={resolvedDate} onChange={e => setResolvedDate(e.target.value)} />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Tracking Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input placeholder="e.g. 1Z999AA10123456784" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label>Return Window</Label>
            <Select value={String(windowDays)} onValueChange={v => setWindowDays(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WINDOW_DAY_OPTIONS.map(o => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Deadline: {(() => { const d = new Date(initiatedDate || new Date()); d.setDate(d.getDate() + windowDays); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })()}</p>
          </div>

          <div className="grid gap-1.5">
            <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea placeholder="Return instructions, reference numbers, etc." value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="resize-none" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Log Return'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
