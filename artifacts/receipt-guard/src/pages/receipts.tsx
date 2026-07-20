import React, { useState, useEffect, useCallback } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent } from '@/components/ui/card'
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
import { Search, ShoppingBag, Plus, MoreHorizontal, Pencil, Trash2, AlertCircle } from 'lucide-react'
import { useListReceipts } from '@workspace/api-client-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { customFetch } from '@workspace/api-client-react'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'
import { PurchaseDialog } from '@/components/purchases/purchase-dialog'

const CATEGORY_LABELS: Record<string, string> = {
  electronics: 'Electronics', clothing: 'Clothing', food_dining: 'Food & Dining',
  health_medical: 'Health', entertainment: 'Entertainment', travel: 'Travel',
  home_garden: 'Home & Garden', automotive: 'Automotive', office_supplies: 'Office',
  software_subscriptions: 'Software', sports_fitness: 'Sports', education: 'Education',
  beauty_personal: 'Beauty', pets: 'Pets', other: 'Other',
}

const STATUS_VARIANT: Record<string, string> = {
  verified: 'success', manual: 'secondary', pending: 'outline', flagged: 'destructive',
}

export default function ReceiptsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const params: Record<string, string> = {}
  if (debouncedSearch) params.search = debouncedSearch
  if (category !== 'all') params.category = category

  const { data, isLoading, error } = useListReceipts(params as any)
  const items = data?.items ?? []

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
  const openEdit = useCallback((item: any) => { setEditingItem(item); setDialogOpen(true) }, [])

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Purchases</h1>
            <p className="text-sm text-muted-foreground">All your purchases in one vault.</p>
          </div>
          <Button onClick={openCreate} size="sm" className="shrink-0">
            <Plus className="w-4 h-4 mr-1.5" /> Add Purchase
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by merchant, category, invoice…"
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="overflow-hidden border-border/60">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[280px]">Merchant</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1,2,3,4,5,6].map(i => (
                  <TableRow key={i}>
                    <TableCell><div className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded-md" /><Skeleton className="h-4 w-28" /></div></TableCell>
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
                  <TableCell colSpan={6} className="h-56 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                        <ShoppingBag className="w-7 h-7 text-primary/50" />
                      </div>
                      {debouncedSearch || category !== 'all' ? (
                        <>
                          <p className="text-sm font-semibold text-foreground">No results found</p>
                          <p className="text-xs">Try a different search or clear the filters.</p>
                          <Button size="sm" variant="outline" onClick={() => { setSearch(''); setCategory('all') }}>Clear filters</Button>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-foreground">No purchases yet</p>
                          <p className="text-xs max-w-xs">Add your first purchase manually — receipts, invoices, any spend.</p>
                          <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1.5" />Add first purchase</Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((r: any) => (
                  <TableRow key={r.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-xs font-bold shrink-0 text-foreground/70 group-hover:bg-primary/10 transition-colors">
                          {(r.merchantName ?? '?').substring(0, 2).toUpperCase()}
                        </div>
                        <span className="truncate max-w-[200px] text-foreground">{r.merchantName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.purchaseDate ? format(new Date(r.purchaseDate), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {CATEGORY_LABELS[r.category] ?? r.category ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={(STATUS_VARIANT[r.status] || 'secondary') as any} className="text-[10px] capitalize px-2 py-0">
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(r.amount ?? 0, (r as any).currency || 'USD')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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

        {!isLoading && items.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {data?.total ?? items.length} purchase{(data?.total ?? items.length) !== 1 ? 's' : ''}
            {debouncedSearch ? ` matching "${debouncedSearch}"` : ''}
          </p>
        )}
      </div>

      <PurchaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['/api/receipts'] })}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this purchase?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The purchase record will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
