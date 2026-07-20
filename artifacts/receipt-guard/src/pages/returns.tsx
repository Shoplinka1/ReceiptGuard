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
import {
  Search, RotateCcw, Plus, MoreHorizontal, Pencil, Trash2,
  AlertCircle, CheckCircle, Clock, PackageX, DollarSign,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customFetch } from '@workspace/api-client-react'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'
import { ReturnDialog } from '@/components/returns/return-dialog'

type ReturnStatus = 'open' | 'in_progress' | 'completed' | 'denied'

const STATUS_CONFIG: Record<ReturnStatus, { label: string; variant: string; icon: React.ElementType; color: string }> = {
  open:        { label: 'Open',        variant: 'outline',     icon: Clock,       color: 'text-blue-500' },
  in_progress: { label: 'In Progress', variant: 'secondary',   icon: RotateCcw,   color: 'text-amber-500' },
  completed:   { label: 'Completed',   variant: 'success',     icon: CheckCircle, color: 'text-emerald-500' },
  denied:      { label: 'Denied',      variant: 'destructive', icon: PackageX,    color: 'text-destructive' },
}

async function fetchReturns(status?: string, search?: string) {
  const params = new URLSearchParams()
  if (status && status !== 'all') params.set('status', status)
  if (search) params.set('search', search)
  const qs = params.toString()
  return customFetch<any[]>(`/api/returns${qs ? `?${qs}` : ''}`)
}

export default function ReturnsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: returns = [], isLoading, error } = useQuery({
    queryKey: ['/api/returns', statusFilter, search],
    queryFn: () => fetchReturns(statusFilter, search),
    staleTime: 30_000,
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return returns
    const q = search.toLowerCase()
    return returns.filter((r: any) =>
      r.merchantName.toLowerCase().includes(q) ||
      (r.reason ?? '').toLowerCase().includes(q)
    )
  }, [returns, search])

  const stats = useMemo(() => ({
    open:        returns.filter((r: any) => r.status === 'open').length,
    in_progress: returns.filter((r: any) => r.status === 'in_progress').length,
    completed:   returns.filter((r: any) => r.status === 'completed').length,
    totalAmount: returns
      .filter((r: any) => r.status === 'completed' && r.amount)
      .reduce((sum: number, r: any) => sum + Number(r.amount), 0),
  }), [returns])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customFetch(`/api/returns/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/returns'] }); toast.success('Return deleted'); setDeleteTarget(null) },
    onError: (e: any) => toast.error(e.message || 'Failed to delete'),
  })

  const markCompletedMutation = useMutation({
    mutationFn: (id: string) => customFetch(`/api/returns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed', resolvedDate: new Date().toISOString().split('T')[0] }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/returns'] }); toast.success('Return marked as completed') },
    onError: (e: any) => toast.error(e.message),
  })

  const openCreate = useCallback(() => { setEditingItem(null); setDialogOpen(true) }, [])
  const openEdit = useCallback((item: any) => { setEditingItem(item); setDialogOpen(true) }, [])

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Returns</h1>
            <p className="text-sm text-muted-foreground">Track return requests and refunds in one place.</p>
          </div>
          <Button onClick={openCreate} size="sm" className="shrink-0">
            <Plus className="w-4 h-4 mr-1.5" /> Log Return
          </Button>
        </div>

        {/* Stats */}
        {!isLoading && returns.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Open',        value: stats.open,        icon: Clock,       color: 'text-blue-600',     bg: 'bg-blue-500/10',     border: 'border-blue-500/20',     filter: 'open' },
              { label: 'In Progress', value: stats.in_progress, icon: RotateCcw,   color: 'text-amber-600',   bg: 'bg-amber-500/10',    border: 'border-amber-500/20',    filter: 'in_progress' },
              { label: 'Completed',   value: stats.completed,   icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', filter: 'completed' },
              { label: 'Refunded',    value: stats.totalAmount > 0 ? formatCurrency(stats.totalAmount, 'USD') : '$0', icon: DollarSign, color: 'text-foreground', bg: 'bg-secondary', border: 'border-border', filter: null },
            ].map(s => (
              <button
                key={s.label}
                onClick={() => s.filter && setStatusFilter(statusFilter === s.filter ? 'all' : s.filter)}
                className={`p-3 rounded-xl border ${s.border} ${s.bg} text-left transition-all ${s.filter ? 'hover:opacity-90' : ''} ${statusFilter === s.filter ? 'ring-2 ring-primary/30' : ''}`}
                disabled={!s.filter}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                  <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>
                </div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by merchant or reason…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Returns list */}
        {error ? (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <AlertCircle className="w-10 h-10 opacity-30 text-destructive" />
            <p className="text-sm font-medium text-destructive">Failed to load returns</p>
            <p className="text-xs">Check your connection and refresh.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-4 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <RotateCcw className="w-8 h-8 opacity-30" />
            </div>
            {search || statusFilter !== 'all' ? (
              <>
                <p className="text-sm font-semibold text-foreground">No returns match</p>
                <Button size="sm" variant="outline" onClick={() => { setSearch(''); setStatusFilter('all') }}>Clear filters</Button>
              </>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">No returns logged yet</p>
                  <p className="text-xs mt-1 max-w-xs">Log return requests to track their status, deadlines, and refunds without losing track.</p>
                </div>
                <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1.5" />Log first return</Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r: any) => {
              const cfg = STATUS_CONFIG[r.status as ReturnStatus] || STATUS_CONFIG.open
              const StatusIcon = cfg.icon

              return (
                <Card key={r.id} className="border-border/60 hover:border-primary/20 transition-colors group">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className={`p-2.5 rounded-xl ${cfg.variant === 'success' ? 'bg-emerald-500/10' : cfg.variant === 'destructive' ? 'bg-destructive/10' : 'bg-secondary'} shrink-0`}>
                          <StatusIcon className={`w-5 h-5 ${cfg.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-foreground">{r.merchantName}</h3>
                            <Badge variant={cfg.variant as any} className="text-[10px] px-2 py-0 capitalize">
                              {cfg.label}
                            </Badge>
                          </div>
                          {r.reason && <p className="text-sm text-muted-foreground mt-0.5 truncate">{r.reason}</p>}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                            <span>Initiated {format(new Date(r.initiatedDate), 'MMM d, yyyy')}</span>
                            {r.trackingNumber && <span>Tracking: <span className="font-mono text-foreground">{r.trackingNumber}</span></span>}
                            {r.resolvedDate && <span>Resolved {format(new Date(r.resolvedDate), 'MMM d, yyyy')}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {r.amount && (
                          <div className="text-right hidden sm:block">
                            <p className="font-bold text-foreground">{formatCurrency(r.amount, r.currency || 'USD')}</p>
                            <p className="text-xs text-muted-foreground">return amount</p>
                          </div>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(r)}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                            {r.status !== 'completed' && (
                              <DropdownMenuItem onClick={() => markCompletedMutation.mutate(r.id)}>
                                <CheckCircle className="w-4 h-4 mr-2" />Mark as Completed
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(r.id)}>
                              <Trash2 className="w-4 h-4 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">{filtered.length} return{filtered.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      <ReturnDialog open={dialogOpen} onOpenChange={setDialogOpen} item={editingItem} />

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this return?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the return record.</AlertDialogDescription>
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
