import React, { useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Plus, Edit2, Trash2, FileText, Shield, RotateCcw } from "lucide-react"
import { useListPurchases, useCreatePurchase, useUpdatePurchase, useDeletePurchase, getListPurchasesQueryKey } from "@workspace/api-client-react"
import { format } from "date-fns"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

export default function PurchasesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  
  const { data, isLoading } = useListPurchases({ search, page, pageSize: 20 })
  
  const createPurchase = useCreatePurchase()
  const updatePurchase = useUpdatePurchase()
  const deletePurchase = useDeletePurchase()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  
  const [formData, setFormData] = useState({
    merchantName: '',
    amount: '',
    purchaseDate: format(new Date(), 'yyyy-MM-dd'),
    category: 'other',
    notes: ''
  })

  const openNew = () => {
    setEditingId(null)
    setFormData({
      merchantName: '', amount: '', purchaseDate: format(new Date(), 'yyyy-MM-dd'), category: 'other', notes: ''
    })
    setDialogOpen(true)
  }

  const openEdit = (purchase: any) => {
    setEditingId(purchase.id)
    setFormData({
      merchantName: purchase.merchantName,
      amount: String(purchase.amount),
      purchaseDate: format(new Date(purchase.purchaseDate), 'yyyy-MM-dd'),
      category: purchase.category || 'other',
      notes: purchase.notes || ''
    })
    setDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      merchantName: formData.merchantName,
      amount: Number(formData.amount),
      purchaseDate: new Date(formData.purchaseDate).toISOString(),
      category: formData.category,
      notes: formData.notes || undefined
    }

    if (editingId) {
      updatePurchase.mutate({ id: editingId, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPurchasesQueryKey() })
          toast.success("Purchase updated")
          setDialogOpen(false)
        },
        onError: () => toast.error("Failed to update purchase")
      })
    } else {
      createPurchase.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPurchasesQueryKey() })
          toast.success("Purchase added")
          setDialogOpen(false)
        },
        onError: () => toast.error("Failed to add purchase")
      })
    }
  }

  const handleDelete = (purchase: any) => {
    if (purchase.documentCount > 0 || purchase.hasWarranty || purchase.hasReturn) {
      if (!window.confirm("This purchase has linked documents, warranties, or returns. Delete anyway?")) return
    } else {
      if (!window.confirm("Are you sure you want to delete this purchase?")) return
    }
    
    deletePurchase.mutate({ id: purchase.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPurchasesQueryKey() })
        toast.success("Purchase deleted")
      },
      onError: () => toast.error("Failed to delete purchase")
    })
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Purchases</h1>
            <p className="text-sm text-muted-foreground">Master record of all your spending and assets.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search merchants..." 
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" /> Add Purchase
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden border-border/50 shadow-sm">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead>Merchant</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Linked Assets</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1,2,3,4,5].map(i => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : data?.items?.length ? (
                data.items.map((purchase) => (
                  <TableRow key={purchase.id} className="group hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium text-foreground">
                      {purchase.merchantName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(purchase.purchaseDate), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground capitalize bg-secondary px-2 py-1 rounded-md">
                        {purchase.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {purchase.documentCount ? (
                          <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                            <FileText className="w-3 h-3" /> {purchase.documentCount}
                          </Badge>
                        ) : null}
                        {purchase.hasWarranty && (
                          <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                            <Shield className="w-3 h-3" />
                          </Badge>
                        )}
                        {purchase.hasReturn && (
                          <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 text-amber-500 border-amber-500/30 bg-amber-500/10">
                            <RotateCcw className="w-3 h-3" />
                          </Badge>
                        )}
                        {!purchase.documentCount && !purchase.hasWarranty && !purchase.hasReturn && (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">
                      ${purchase.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(purchase)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(purchase)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center border-dashed">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <FileText className="w-8 h-8 mb-2 opacity-50" />
                      <p>No purchases found.</p>
                      <Button variant="link" onClick={openNew} className="mt-2 text-primary">Add your first purchase</Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          
          {data && data.total > data.pageSize && (
            <div className="p-4 border-t flex justify-center gap-2">
              <Button disabled={page === 1} onClick={() => setPage(p => p - 1)} variant="outline" size="sm">Previous</Button>
              <Button disabled={page * data.pageSize >= data.total} onClick={() => setPage(p => p + 1)} variant="outline" size="sm">Next</Button>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Purchase' : 'Add Purchase'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Merchant</label>
                <Input required value={formData.merchantName} onChange={e => setFormData({...formData, merchantName: e.target.value})} placeholder="e.g. Apple Store" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount ($)</label>
                <Input required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Input required type="date" value={formData.purchaseDate} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Category</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                >
                  <option value="electronics">Electronics</option>
                  <option value="clothing">Clothing</option>
                  <option value="food">Food</option>
                  <option value="home">Home</option>
                  <option value="travel">Travel</option>
                  <option value="health">Health</option>
                  <option value="software">Software</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Input value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Receipt #, tracking link, etc." />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createPurchase.isPending || updatePurchase.isPending}>
                {createPurchase.isPending || updatePurchase.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
