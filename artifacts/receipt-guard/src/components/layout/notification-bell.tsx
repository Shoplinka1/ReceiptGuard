import React, { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

async function getAuthToken() {
  const { supabase } = await import('@/lib/supabase')
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || ''

async function apiFetch(path: string, opts?: RequestInit) {
  const token = await getAuthToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts?.headers ?? {}) },
  })
  if (res.status === 204) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

interface Notification {
  id: string
  type: string
  title: string
  body?: string
  is_read: boolean
  created_at: string
  metadata?: Record<string, unknown>
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function notificationIcon(type: string): string {
  if (type.includes('renewal')) return '🔁'
  if (type.includes('warranty')) return '🛡️'
  if (type.includes('gmail')) return '📧'
  if (type.includes('payment')) return '💳'
  if (type.includes('plan')) return '✨'
  return '🔔'
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => apiFetch('/api/notifications/unread-count'),
    refetchInterval: 60_000, // poll every minute
    retry: false,
  })

  const unreadCount: number = (unreadData as any)?.count ?? 0

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => apiFetch('/api/notifications?limit=20'),
    enabled: open,
    retry: false,
  })

  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-count'] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => apiFetch('/api/notifications/mark-all-read', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-count'] })
    },
  })

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'relative flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all w-full',
          open
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <div className="relative">
          <Bell className={cn('w-4 h-4', open ? 'text-primary' : 'opacity-70')} />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <span>Notifications</span>
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
            ) : !notifications?.length ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    'flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50',
                    !n.is_read && 'bg-primary/5',
                  )}
                  onClick={() => { if (!n.is_read) markRead.mutate(n.id) }}
                >
                  <span className="text-lg shrink-0 mt-0.5">{notificationIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm leading-snug', !n.is_read ? 'font-medium' : 'text-muted-foreground')}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
