import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { customFetch } from '@workspace/api-client-react'
import { toast } from 'sonner'

const CATEGORIES = [
  'entertainment', 'music_audio', 'cloud_storage', 'software_tools',
  'news_media', 'gaming', 'fitness_health', 'food_delivery',
  'finance', 'education', 'productivity', 'security', 'other',
]

const BILLING_CYCLES = ['monthly', 'yearly', 'weekly', 'quarterly']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'CAD', 'AUD', 'JPY', 'INR', 'BRL', 'ZAR']

interface SubItem {
  id: string
  companyName: string | null
  monthlyPrice: number
  yearlyPrice?: number | null
  billingCycle: string
  renewalDate: string
  category: string | null
  website?: string | null
  currency?: string | null
  notes?: string | null
  reminderEnabled?: boolean
  status?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: SubItem | null
  onSuccess?: () => void
}

export function SubscriptionDialog({ open, onOpenChange, item, onSuccess }: Props) {
  const qc = useQueryClient()
  const isEdit = !!item

  const [companyName, setCompanyName] = useState('')
  const [monthlyPrice, setMonthlyPrice] = useState('')
  const [yearlyPrice, setYearlyPrice] = useState('')
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [renewalDate, setRenewalDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState('other')
  const [website, setWebsite] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [notes, setNotes] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [status, setStatus] = useState('active')

  useEffect(() => {
    if (open) {
      if (item) {
        setCompanyName(item.companyName || '')
        setMonthlyPrice(String(item.monthlyPrice))
        setYearlyPrice(item.yearlyPrice ? String(item.yearlyPrice) : '')
        setBillingCycle(item.billingCycle || 'monthly')
        setRenewalDate(item.renewalDate || new Date().toISOString().split('T')[0])
        setCategory(item.category || 'other')
        setWebsite(item.website || '')
        setCurrency(item.currency || 'USD')
        setNotes(item.notes || '')
        setReminderEnabled(item.reminderEnabled ?? true)
        setStatus(item.status || 'active')
      } else {
        setCompanyName(''); setMonthlyPrice(''); setYearlyPrice('')
        setBillingCycle('monthly')
        setRenewalDate(new Date().toISOString().split('T')[0])
        setCategory('other'); setWebsite(''); setCurrency('USD')
        setNotes(''); setReminderEnabled(true); setStatus('active')
      }
    }
  }, [open, item])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['/api/subscriptions'] })
    qc.invalidateQueries({ queryKey: ['/api/dashboard/summary'] })
    qc.invalidateQueries({ queryKey: ['/api/upcoming-renewals'] })
    qc.invalidateQueries({ queryKey: ['/api/subscriptions/breakdown'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: object) => customFetch<any>('/api/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Subscription added!'); onOpenChange(false); onSuccess?.() },
    onError: (e: any) => toast.error(e.message || 'Failed to add subscription'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: object) => customFetch<any>(`/api/subscriptions/${item?.id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); toast.success('Subscription updated!'); onOpenChange(false); onSuccess?.() },
    onError: (e: any) => toast.error(e.message || 'Failed to update subscription'),
  })

  const pending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim() || !monthlyPrice || !renewalDate || !category) {
      toast.error('Please fill in all required fields')
      return
    }
    const data = {
      companyName: companyName.trim(),
      monthlyPrice: parseFloat(monthlyPrice),
      yearlyPrice: yearlyPrice ? parseFloat(yearlyPrice) : null,
      billingCycle,
      renewalDate,
      category,
      website: website.trim() || null,
      currency,
      notes: notes.trim() || null,
      reminderEnabled,
      status,
    }
    if (isEdit) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Subscription' : 'Add Subscription'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update subscription details.' : 'Track a new recurring subscription.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Service Name <span className="text-destructive">*</span></Label>
            <Input placeholder="e.g. Netflix, Spotify, AWS" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Monthly Price <span className="text-destructive">*</span></Label>
              <Input type="number" step="0.01" min="0" placeholder="9.99" value={monthlyPrice} onChange={e => setMonthlyPrice(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label>Yearly Price <span className="text-muted-foreground text-xs">(opt)</span></Label>
              <Input type="number" step="0.01" min="0" placeholder="99.99" value={yearlyPrice} onChange={e => setYearlyPrice(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Billing Cycle</Label>
              <Select value={billingCycle} onValueChange={setBillingCycle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BILLING_CYCLES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
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
              <Label>Next Renewal <span className="text-destructive">*</span></Label>
              <Input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} required />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Website <span className="text-muted-foreground text-xs">(opt)</span></Label>
              <Input placeholder="netflix.com" value={website} onChange={e => setWebsite(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea placeholder="Any additional details…" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="resize-none" />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="reminder" checked={reminderEnabled} onCheckedChange={v => setReminderEnabled(Boolean(v))} />
            <Label htmlFor="reminder" className="cursor-pointer text-sm">Enable renewal reminders</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Subscription'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
