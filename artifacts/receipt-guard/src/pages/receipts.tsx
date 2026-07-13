import React, { useState, useEffect } from "react"
import { Link } from "wouter"
import { AppShell } from "@/components/layout/app-shell"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Receipt, Mail } from "lucide-react"
import { useListReceipts } from "@workspace/api-client-react"
import { format } from "date-fns"

export default function ReceiptsPage() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  // Debounce search: only fire the API query 300ms after the user stops typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, error } = useListReceipts({ search: debouncedSearch })
  const items = data?.items ?? []

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Receipt Vault</h1>
            <p className="text-sm text-muted-foreground">All receipts extracted from your Gmail inbox.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search merchants…"
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Card className="overflow-hidden border-border/50">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="w-[250px]">Merchant</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1,2,3,4,5].map(i => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Receipt className="w-8 h-8 opacity-20" />
                      <p className="text-sm font-medium text-destructive">Failed to load receipts</p>
                      <p className="text-xs">Check your connection and try refreshing.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 && debouncedSearch ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="w-8 h-8 opacity-20" />
                      <p className="text-sm font-medium">No results for "{debouncedSearch}"</p>
                      <p className="text-xs">Try a different merchant name or clear the search.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
                        <Receipt className="w-7 h-7 opacity-40" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">No receipts yet</p>
                        <p className="text-xs mt-1">Connect your Gmail to automatically import receipts, invoices, and order confirmations.</p>
                      </div>
                      <Link href="/connect-gmail">
                        <Button size="sm" className="mt-1">
                          <Mail className="w-4 h-4 mr-2" />
                          Connect Gmail
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((receipt) => (
                  <TableRow key={receipt.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-xs font-bold shrink-0">
                          {(receipt.merchantName ?? '?').substring(0, 2).toUpperCase()}
                        </div>
                        <span className="truncate max-w-[180px]">{receipt.merchantName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {receipt.purchaseDate ? format(new Date(receipt.purchaseDate), "MMM dd, yyyy") : '—'}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground capitalize">{receipt.category ?? '—'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={receipt.status === 'verified' ? 'success' : 'secondary'} className="capitalize text-[10px] px-2 py-0">
                        {receipt.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ${(receipt.amount ?? 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Footer count */}
        {!isLoading && items.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {items.length} receipt{items.length !== 1 ? 's' : ''}{debouncedSearch ? ` matching "${debouncedSearch}"` : ''}
          </p>
        )}
      </div>
    </AppShell>
  )
}
