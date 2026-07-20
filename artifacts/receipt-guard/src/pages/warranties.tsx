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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search, Shield, ShieldAlert, ShieldCheck, AlertCircle,
  Plus, MoreHorizontal, Pencil, Trash2, Calendar,
} from 'lucide-react'
import { useListWarranties } from '@workspace/api-client-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { customFetch } from '@workspace/api-client-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { WarrantyDialog } from '@/components/warranties/warranty-dialog'

function safeDate(s: string | null | undefined, fmt: string): string {
  if (!s) return '—'
  try { const d = new Date(s); if (isNaN(d.getTime())) return '—'; return format(d, fmt) } catch { return '—' }
}

function StatusIcon({ status, days }: { status: string; days: number }) {
  if (status === 'expired') return <ShieldAlert className="w-5 h-5 text-destructive" />
  if (days < 30)           return <Shield className="w-5 h-5 text-amber-500" />
  return <ShieldCheck className="w-5 h-5 text-emerald-500" />
}

function statusBadgeVariant(status: string, days: number) {
  if (status === 'expired') return 'destructive'
  if (days < 30) return 'warning'
  return 'success'
}

function statusLabel(status: string, days: number) {
  if (status === 'expired') return 'Expired'
  if (days === 0) return 'Expires today'
  if (days < 0) return 'Expired'
  return `${days}d left`
}

export default function WarrantiesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: warranties, isLoading, error } = useListWarranties()

  const filtered = useMemo(() => {
    let items = warranties ?? []
    if (statusFilter !== 'all') items = items.filter((w: any) => w.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter((w: any) =>
        w.productName.toLowerCase().includes(q) ||
        (w.merchantName ?? '').toLowerCase().includes(q)
      )
    }
    return items
  }, [warranties, statusFilter, search])

  // Stats
  const stats = useMemo(() => {
    const all = warranties ?? []
    return {
      active: all.filter((w: any) => w.status === 'active').length,
      expiring_soon: all.filter((w: any) => w.status === 'expiring_soon').length,
      expired: all.filter((w: any) => w.status === 'expired').length,
    }
  }, [warranties])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customFetch(`/api/warranties/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/warranties'] })
      qc.invalidateQueries({ queryKey: ['/api/dashboard/summary'] })
      toast.success('Warranty deleted')
      setDeleteTarget(null)
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete'),
  })

  const openCreate = useCallback(() => { setEditingItem(null); setDialogOpen(true) }, [])
  const openEdit = useCallback((item: any) => { setEditingItem(item); setDialogOpen(true) }, [])

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Warranties</h1>
            <p className="text-sm text-muted-foreground">Track product coverage and get expiry alerts.</p>
          </div>
          <Button onClick={openCreate} size="sm" className="shrink-0">
            <Plus className="w-4 h-4 mr-1.5" /> Add Warranty
          </Button>
        </div>

        {/* Stats strip */}
        {!isLoading && (warranties?.length ?? 0) > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Active',        count: stats.active,        color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', filter: 'active' },
              { label: 'Expiring soon', count: stats.expiring_soon, color: 'text-amber-600',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   filter: 'expiring_soon' },
              { label: 'Expired',       count: stats.expired,       color: 'text-destructive',  bg: 'bg-destructive/5',  border: 'border-destructive/20', filter: 'expired' },
            ].map(s => (
              <button
                key={s.filter}
                onClick={() => setStatusFilter(statusFilter === s.filter ? 'all' : s.filter)}
                className={`p-3 rounded-xl border ${s.border} ${s.bg} text-left transition-all hover:opacity-90 ${statusFilter === s.filter ? 'ring-2 ring-primary/30' : ''}`}
              >
                <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                <p className={`text-xs font-medium ${s.color} opacity-80 mt-0.5`}>{s.label}</p>
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search warranties…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expiring_soon">Expiring soon</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Cards */}
        {error ? (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <AlertCircle className="w-10 h-10 opacity-30 text-destructive" />
            <p className="text-sm font-medium text-destructive">Failed to load warranties</p>
            <p className="text-xs">Check your connection and refresh.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isLoading ? (
              [1,2,3,4].map(i => (
                <Card key={i} className="border-border/60">
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-1/2 mb-4" />
                    <Skeleton className="h-4 w-1/3 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : filtered.length === 0 ? (
              <div className="col-span-full py-20 flex flex-col items-center gap-4 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 opacity-30" />
                </div>
                {search || statusFilter !== 'all' ? (
                  <>
                    <p className="text-sm font-semibold text-foreground">No warranties match</p>
                    <Button size="sm" variant="outline" onClick={() => { setSearch(''); setStatusFilter('all') }}>Clear filters</Button>
                  </>
                ) : (
                  <>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">No warranties tracked yet</p>
                      <p className="text-xs mt-1 max-w-xs mx-auto">Add warranties for your electronics, appliances, and valuable items to get alerts before coverage expires.</p>
                    </div>
                    <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1.5" />Add first warranty</Button>
                  </>
                )}
              </div>
            ) : (
              filtered.map((w: any) => (
                <Card key={w.id} className={`border-border/60 hover:border-primary/20 transition-colors group ${w.status === 'expired' ? 'opacity-70' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex gap-3 items-start">
                        <div className="p-2 bg-secondary rounded-lg shrink-0 mt-0.5">
                          <StatusIcon status={w.status} days={w.daysRemaining} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-base leading-tight truncate">{w.productName}</h3>
                          <p className="text-sm text-muted-foreground truncate">{w.merchantName || 'Unknown vendor'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-1.5 shrink-0 ml-2">
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={statusBadgeVariant(w.status, w.daysRemaining) as any} className="text-[10px] uppercase whitespace-nowrap">
                            {statusLabel(w.status, w.daysRemaining)}
                          </Badge>
                          {w.isEstimated && <Badge variant="outline" className="text-[10px]">Estimated</Badge>}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(w)}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(w.id)}><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" />Purchased</p>
                        <p className="font-medium">{safeDate(w.purchaseDate, 'MMM d, yyyy')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Shield className="w-3 h-3" />Expires</p>
                        <p className={`font-medium ${w.status === 'expired' ? 'text-destructive' : w.status === 'expiring_soon' ? 'text-amber-600' : ''}`}>
                          {safeDate(w.warrantyEndDate, 'MMM d, yyyy')}
                        </p>
                      </div>
                      {w.notes && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground truncate">{w.notes}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {filtered.length} warrant{filtered.length !== 1 ? 'ies' : 'y'}
            {(search || statusFilter !== 'all') ? ' (filtered)' : ''}
          </p>
        )}
      </div>

      <WarrantyDialog open={dialogOpen} onOpenChange={setDialogOpen} item={editingItem} />

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this warranty?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the warranty record.</AlertDialogDescription>
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
