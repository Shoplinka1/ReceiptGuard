import React, { useState, useEffect, useCallback } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  Search, ShoppingBag, Plus, MoreHorizontal, Pencil, Trash2,
  AlertCircle, ChevronLeft, ChevronRight, RotateCcw,
} from 'lucide-react'
import { useListReceipts } from '@workspace/api-client-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { customFetch } from '@workspace/api-client-react'
import { format, differenceInDays } from 'date-fns'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'
import { PurchaseDialog, CATEGORIES, type PurchaseItem } from '@/components/purchases/purchase-dialog'
import { PurchaseDetailDrawer } from '@/components/purchases/purchase-detail-drawer'

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))

const STATUS_STYLES: Record<string, string> = {
  verified: 'bg-emerald-500/15 text-emerald-600 border-0',
  manual:   'bg-secondary text-secondary-foreground border-0',
  pending:  'bg-amber-500/15 text-amber-600 border-0',
  flagged:  'bg-destructive/15 text-destructive border-0',
}

function ReturnCountdown({ deadline }: { deadline: string | null | undefined }) {
  if (!deadline) return null
  const days = differenceInDays(new Date(deadline), new Date())
  if (days < 0) return <span className="text-[10px] text-destructive/70">Return missed</span>
  if (days <= 3) return <span className="text-[10px] text-amber-600 font-medium">{days}d to return</span>
  if (days <= 7) return <span className="text-[10px] text-amber-500">{days}d to return</span>
  return null
}

const PAGE_SIZE = 25

export default function ReceiptsPage() {
  const qc = useQueryClient()
  const [search,         setSearch]         = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category,       setCategory]       = useState('all')
  const [page,           setPage]           = useState(1)
  const [dialogOpen,     setDialogOpen]     = useState(false)
  const [editingItem,    setEditingItem]    = useState<PurchaseItem | null>(null)
  const [deleteTarget,   setDeleteTarget]   = useState<string | null>(null)
  const [drawerOpen,     setDrawerOpen]     = useState(false)
  const [drawerItem,     setDrawerItem]     = useState<PurchaseItem | null>(null)

  // Debounce search and reset page
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [category])

  const params: Record<string, string> = { page: String(page), pageSize: String(PAGE_SIZE) }
  if (debouncedSearch) params.search = debouncedSearch
  if (category !== 'all') params.category = category

  const { data, isLoading, error } = useListReceipts(params as any)
  const items: PurchaseItem[] = (data?.items ?? []) as any
  const total: number = (data as any)?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customFetch(`/api/receipts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/receipts'] })
      qc.invalidateQueries({ queryKey: ['/api/dashboard/summary'] })
      toast.success('Purchase deleted')
      setDeleteTarget(null)
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete'),
  })

  const openCreate = useCallback(() => { setEditingItem(null); setDialogOpen(true) }, [])
  const openEdit   = useCallback((item: PurchaseItem) => { setEditingItem(item); setDialogOpen(true) }, [])
  const openDrawer = useCallback((item: PurchaseItem) => { setDrawerItem(item); setDrawerOpen(true) }, [])

  const hasFilters = debouncedSearch || category !== 'all'

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Purchases</h1>
            <p className="text-sm text-muted-foreground">Your digital purchase vault — everything in one place.</p>
          </div>
          <Button onClick={openCreate} size="sm" className="shrink-0">
            <Plus className="w-4 h-4 mr-1.5" /> Add Purchase
          </Button>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by merchant, product, invoice, notes…"
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* ── Table ── */}
        <Card className="overflow-hidden border-border/60">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[260px]">Merchant & Product</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1,2,3,4,5,6,7].map(i => (
                  <TableRow key={i}>
                    <TableCell><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-lg" /><div><Skeleton className="h-4 w-28 mb-1" /><Skeleton className="h-3 w-20" /></div></div></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <AlertCircle className="w-8 h-8 opacity-30 text-destructive" />
                      <p className="text-sm font-medium text-destructive">Failed to load purchases</p>
                      <p className="text-xs">Check your connection and refresh.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground py-8">
                      <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-primary/40" />
                      </div>
                      {hasFilters ? (
                        <>
                          <div>
                            <p className="text-sm font-semibold text-foreground">No results found</p>
                            <p className="text-xs mt-1">Try a different search term or clear the filters.</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => { setSearch(''); setCategory('all') }}>Clear filters</Button>
                        </>
                      ) : (
                        <>
                          <div>
                            <p className="text-sm font-semibold text-foreground">No purchases yet</p>
                            <p className="text-xs mt-1 max-w-xs">Start building your digital purchase vault.<br />Add receipts, invoices, or any spend.</p>
                          </div>
                          <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1.5" />Add first purchase</Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((r) => (
                  <TableRow
                    key={r.id}
                    className="group hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => openDrawer(r)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold shrink-0 text-foreground/70 group-hover:bg-primary/10 transition-colors">
                          {(r.merchantName ?? '?').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate max-w-[180px]">{r.merchantName}</p>
                          {r.productName ? (
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{r.productName}</p>
                          ) : (
                            <ReturnCountdown deadline={r.returnDeadline} />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.purchaseDate ? format(new Date(r.purchaseDate), 'MMM d, yyyy') : '—'}
                      {r.productName && <ReturnCountdown deadline={r.returnDeadline} />}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {CATEGORY_MAP[r.category] ?? r.category ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] capitalize px-2 py-0 ${STATUS_STYLES[(r as any).status] ?? STATUS_STYLES.manual}`}>
                        {(r as any).status ?? 'manual'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {formatCurrency(r.amount ?? 0, r.currency || 'USD')}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDrawer(r)}>
                            <ShoppingBag className="w-4 h-4 mr-2" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(r)}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(r.id)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* ── Footer: count + pagination ── */}
        {!isLoading && total > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {total} purchase{total !== 1 ? 's' : ''}
              {debouncedSearch ? ` matching "${debouncedSearch}"` : ''}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span>Page {page} of {totalPages}</span>
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      <PurchaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['/api/receipts'] })
          // Refresh drawer if editing the open purchase
          if (editingItem && drawerItem?.id === editingItem.id) {
            setDrawerItem(null)
            setDrawerOpen(false)
          }
        }}
      />

      <PurchaseDetailDrawer
        purchase={drawerItem}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onEdit={(item) => { openEdit(item) }}
        onDelete={(id) => setDeleteTarget(id)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this purchase?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The purchase record and all linked data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
