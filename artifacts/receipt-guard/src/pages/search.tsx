import { useState, useEffect, useRef } from 'react'
import { Link } from 'wouter'
import { AppShell } from '@/components/layout/app-shell'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Receipt, Repeat, ShieldCheck, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

async function getAuthToken() {
  const { supabase } = await import('@/lib/supabase')
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

async function searchAll(q: string) {
  if (!q.trim()) return { receipts: [], subscriptions: [], warranties: [] }
  const token = await getAuthToken()
  const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

const TYPE_CONFIG = {
  receipt: { label: 'Receipt', icon: Receipt, href: '/receipts', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  subscription: { label: 'Subscription', icon: Repeat, href: '/subscriptions', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  warranty: { label: 'Warranty', icon: ShieldCheck, href: '/warranties', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 350)
    return () => clearTimeout(t)
  }, [query])

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: () => searchAll(debouncedQ),
    enabled: debouncedQ.length > 0,
  })

  const all = [
    ...(data?.receipts ?? []),
    ...(data?.subscriptions ?? []),
    ...(data?.warranties ?? []),
  ]
  const totalCount = all.length

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="pb-4 border-b border-border">
          <h1 className="text-3xl font-bold tracking-tight mb-1">Search</h1>
          <p className="text-muted-foreground">Find receipts, subscriptions, and warranties instantly.</p>
        </header>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by merchant, product, category…"
            className="pl-10 pr-10 h-12 text-base"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results */}
        {isLoading && debouncedQ && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        )}

        {!isLoading && debouncedQ && data && totalCount === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium">No results for "{debouncedQ}"</p>
            <p className="text-sm mt-1">Try a different merchant name, category, or product.</p>
          </div>
        )}

        {!isLoading && data && totalCount > 0 && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground mb-3">
              {totalCount} result{totalCount !== 1 ? 's' : ''} for "{debouncedQ}"
            </p>
            {all.map((item: any) => {
              const cfg = TYPE_CONFIG[item.type as keyof typeof TYPE_CONFIG]
              const Icon = cfg.icon
              return (
                <Link key={`${item.type}-${item.id}`} href={`${cfg.href}?highlight=${item.id}`}>
                  <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.date && (
                        <span className="text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString()}</span>
                      )}
                      <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {!debouncedQ && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium">Start typing to search</p>
            <p className="text-sm mt-1">Receipts, subscriptions, and warranties all in one place.</p>
          </div>
        )}
      </div>
    </AppShell>
  )
}
