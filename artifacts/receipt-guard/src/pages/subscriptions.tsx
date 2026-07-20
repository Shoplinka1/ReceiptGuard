import React, { useState, useMemo, useCallback } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, Repeat, Plus, MoreHorizontal, Pencil, Trash2, AlertCircle, Calendar, CreditCard, Globe, Tag, TrendingUp, CheckCircle, PauseCircle, XCircle } from 'lucide-react'
import { useListSubscriptions, useGetUserSettings } from '@workspace/api-client-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { customFetch } from '@workspace/api-client-react'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/currency'
import { useTranslation } from '@/lib/i18n'
import { MerchantLogo } from '@/components/ui/merchant-logo'
import { toast } from 'sonner'
import { SubscriptionDialog } from '@/components/subscriptions/subscription-dialog'

const MERCHANT_WEBSITES: Record<string, string> = {
  'Amazon': 'amazon.com', 'Apple': 'apple.com', 'Google': 'google.com',
  'Microsoft': 'microsoft.com', 'Netflix': 'netflix.com', 'Spotify': 'spotify.com',
  'Hulu': 'hulu.com', 'Disney+': 'disneyplus.com', 'Max': 'max.com',
  'Adobe': 'adobe.com', 'Dropbox': 'dropbox.com', 'GitHub': 'github.com',
  'Notion': 'notion.so', 'Slack': 'slack.com', 'Zoom': 'zoom.us',
  'Discord': 'discord.com', 'Figma': 'figma.com', 'OpenAI': 'openai.com',
  'Paramount+': 'paramountplus.com', 'Peacock': 'peacocktv.com', 'YouTube': 'youtube.com',
}

function resolveWebsite(sub: any): string | null {
  if (sub.website) return sub.website
  if (sub.companyName && MERCHANT_WEBSITES[sub.companyName]) return MERCHANT_WEBSITES[sub.companyName]
  return null
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; label: string; variant: string; color: string }> = {
  active:    { icon: CheckCircle,  label: 'Active',    variant: 'success',     color: 'text-emerald-500' },
  paused:    { icon: PauseCircle,  label: 'Paused',    variant: 'secondary',   color: 'text-muted-foreground' },
  cancelled: { icon: XCircle,      label: 'Cancelled', variant: 'destructive', color: 'text-destructive' },
}

export default function SubscriptionsPage() {
  const qc = useQueryClient()
  const { t, locale } = useTranslation()
  const { data: userSettings } = useGetUserSettings()
  const currency = userSettings?.currency || 'USD'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: subs, isLoading, error } = useListSubscriptions(
    statusFilter !== 'all' ? { status: statusFilter } as any : undefined
  )

  const filtered = useMemo(() => {
    if (!subs) return []
    if (!search.trim()) return subs
    const q = search.toLowerCase()
    return subs.filter((s: any) => (s.companyName ?? '').toLowerCase().includes(q))
  }, [subs, search])

  // Monthly total summary
  const monthlyTotal = useMemo(() => {
    return (subs ?? [])
      .filter((s: any) => s.status === 'active')
      .reduce((sum: number, s: any) => {
        if (s.billingCycle === 'yearly') return sum + (s.yearlyPrice ?? s.monthlyPrice * 12) / 12
        return sum + (s.monthlyPrice ?? 0)
      }, 0)
  }, [subs])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customFetch(`/api/subscriptions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/subscriptions'] })
      qc.invalidateQueries({ queryKey: ['/api/dashboard/summary'] })
      toast.success('Subscription deleted')
      setDeleteTarget(null)
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete'),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => customFetch(`/api/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/subscriptions'] })
      toast.success('Subscription marked as cancelled')
    },
    onError: (e: any) => toast.error(e.message || 'Failed to cancel'),
  })

  const openCreate = useCallback(() => { setEditingItem(null); setDialogOpen(true) }, [])
  const openEdit = useCallback((item: any) => { setEditingItem(item); setDialogOpen(true) }, [])

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('subs_title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subs_subtitle')}</p>
          </div>
          <Button onClick={openCreate} size="sm" className="shrink-0">
            <Plus className="w-4 h-4 mr-1.5" /> Add Subscription
          </Button>
        </div>

        {/* Monthly cost summary card */}
        {!isLoading && monthlyTotal > 0 && (
          <Card className="bg-gradient-to-br from-primary/8 to-transparent border-primary/20">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Active subscription spend</p>
                  <p className="text-2xl font-bold">{formatCurrency(monthlyTotal, currency, locale)}<span className="text-sm text-muted-foreground font-normal">/mo</span></p>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-xs text-muted-foreground">{formatCurrency(monthlyTotal * 12, currency, locale)}/year</p>
                <p className="text-xs text-muted-foreground">{(subs ?? []).filter((s: any) => s.status === 'active').length} active</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search subscriptions…"
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        {error ? (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <AlertCircle className="w-10 h-10 opacity-30 text-destructive" />
            <p className="text-sm font-medium text-destructive">Failed to load subscriptions</p>
            <p className="text-xs">Check your connection and refresh.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              [1,2,3,4,5,6].map(i => (
                <Card key={i} className="border-border/60">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex justify-between"><Skeleton className="w-12 h-12 rounded-xl" /><Skeleton className="w-16 h-6 rounded-full" /></div>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : filtered.length === 0 ? (
              <div className="col-span-full py-20 flex flex-col items-center gap-4 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                  <Repeat className="w-8 h-8 opacity-30" />
                </div>
                {search ? (
                  <>
                    <p className="text-sm font-semibold text-foreground">No results for "{search}"</p>
                    <Button size="sm" variant="outline" onClick={() => setSearch('')}>Clear search</Button>
                  </>
                ) : (
                  <>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">No subscriptions yet</p>
                      <p className="text-xs mt-1 max-w-xs mx-auto">Track your recurring payments to see renewal dates, monthly cost, and get reminded before anything renews.</p>
                    </div>
                    <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1.5" />Add first subscription</Button>
                  </>
                )}
              </div>
            ) : (
              filtered.map((sub: any) => {
                const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.active
                const StatusIcon = cfg.icon
                const isYearly = sub.billingCycle === 'yearly'
                const price = isYearly ? (sub.yearlyPrice ?? sub.monthlyPrice * 12) : sub.monthlyPrice
                const website = resolveWebsite(sub)

                return (
                  <Card key={sub.id} className="border-border/60 hover:border-primary/30 transition-colors group relative overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <MerchantLogo name={sub.companyName} size="md" />
                        <div className="flex items-center gap-1.5">
                          <Badge variant={cfg.variant as any} className="capitalize text-[10px] px-2 py-0 flex items-center gap-1">
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(sub)}>
                                <Pencil className="w-4 h-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              {sub.status === 'active' && (
                                <DropdownMenuItem onClick={() => cancelMutation.mutate(sub.id)}>
                                  <XCircle className="w-4 h-4 mr-2" /> Mark Cancelled
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(sub.id)}>
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <h3 className="font-bold text-lg leading-tight truncate">{sub.companyName || 'Unknown'}</h3>

                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-bold">{formatCurrency(price, currency, locale)}</span>
                        <span className="text-sm text-muted-foreground">{isYearly ? '/yr' : '/mo'}</span>
                        {isYearly && <span className="text-xs text-muted-foreground">· {formatCurrency((sub.yearlyPrice ?? sub.monthlyPrice * 12) / 12, currency, locale)}/mo</span>}
                      </div>

                      <div className="mt-5 pt-4 border-t border-border space-y-2 text-sm text-muted-foreground">
                        {sub.renewalDate && (
                          <div className="flex justify-between items-center">
                            <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" />Next renewal</span>
                            <span className="font-medium text-foreground">{format(new Date(sub.renewalDate), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-2"><CreditCard className="w-3.5 h-3.5" />Billing</span>
                          <span className="capitalize">{sub.billingCycle}</span>
                        </div>
                        {sub.category && (
                          <div className="flex justify-between items-center">
                            <span className="flex items-center gap-2"><Tag className="w-3.5 h-3.5" />Category</span>
                            <span className="capitalize">{sub.category.replace(/_/g, ' ')}</span>
                          </div>
                        )}
                        {website && (
                          <div className="flex justify-between items-center">
                            <span className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" />Website</span>
                            <a href={`https://${website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[120px]">{website}</a>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {filtered.length} subscription{filtered.length !== 1 ? 's' : ''}
            {search ? ` matching "${search}"` : ''}
          </p>
        )}
      </div>

      <SubscriptionDialog open={dialogOpen} onOpenChange={setDialogOpen} item={editingItem} />

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this subscription?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the subscription record. Consider marking it as cancelled instead if you want to keep the history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
