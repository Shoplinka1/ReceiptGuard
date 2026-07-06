import { useState } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MessageSquare, Bug, Lightbulb, HeadphonesIcon, Send, Clock, CheckCircle2, XCircle } from 'lucide-react'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || ''

async function getAuthToken() {
  const { supabase } = await import('@/lib/supabase')
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

async function apiFetch(path: string, opts?: RequestInit) {
  const token = await getAuthToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

const FEEDBACK_TYPES = [
  { value: 'feedback', label: 'General Feedback', icon: MessageSquare, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  { value: 'feature_request', label: 'Feature Request', icon: Lightbulb, color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  { value: 'bug_report', label: 'Bug Report', icon: Bug, color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  { value: 'support', label: 'Support', icon: HeadphonesIcon, color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
]

const STATUS_CONFIG: Record<string, { label: string; icon: any; class: string }> = {
  open: { label: 'Open', icon: Clock, class: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In Progress', icon: Clock, class: 'bg-blue-500/10 text-blue-500' },
  resolved: { label: 'Resolved', icon: CheckCircle2, class: 'bg-emerald-500/10 text-emerald-600' },
  closed: { label: 'Closed', icon: XCircle, class: 'bg-muted text-muted-foreground' },
}

export default function FeedbackPage() {
  const qc = useQueryClient()
  const [type, setType] = useState('feedback')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['feedback'],
    queryFn: () => apiFetch('/api/feedback'),
  })

  const submit = useMutation({
    mutationFn: () => apiFetch('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ type, subject: subject.trim(), body: body.trim() }),
    }),
    onSuccess: () => {
      toast.success('Submitted — thank you for your feedback!')
      setSubject('')
      setBody('')
      setType('feedback')
      qc.invalidateQueries({ queryKey: ['feedback'] })
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to submit'),
  })

  const selectedType = FEEDBACK_TYPES.find(t => t.value === type)!

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="pb-4 border-b border-border">
          <h1 className="text-3xl font-bold tracking-tight mb-1">Feedback</h1>
          <p className="text-muted-foreground">Share ideas, report issues, or get support. We read everything.</p>
        </header>

        {/* Submission form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submit Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Type selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FEEDBACK_TYPES.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                    type === value ? color + ' border-current' : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs leading-tight text-center">{label}</span>
                </button>
              ))}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Subject</label>
              <Input
                placeholder={`Brief summary of your ${selectedType.label.toLowerCase()}`}
                value={subject}
                onChange={e => setSubject(e.target.value)}
                maxLength={120}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Details</label>
              <Textarea
                placeholder="Describe in as much detail as you'd like…"
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>

            <Button
              onClick={() => submit.mutate()}
              disabled={submit.isPending || !subject.trim() || !body.trim()}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {submit.isPending ? 'Submitting…' : 'Submit'}
            </Button>
          </CardContent>
        </Card>

        {/* Past submissions */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Your Submissions</h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : (submissions as any[]).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No submissions yet. We'd love to hear from you!
            </div>
          ) : (
            <div className="space-y-3">
              {(submissions as any[]).map((item: any) => {
                const typeConfig = FEEDBACK_TYPES.find(t => t.value === item.type)
                const statusConfig = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.open
                const StatusIcon = statusConfig.icon
                return (
                  <Card key={item.id} className="bg-card/60">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {typeConfig && (
                              <Badge variant="outline" className={`text-xs ${typeConfig.color}`}>
                                {typeConfig.label}
                              </Badge>
                            )}
                            <Badge variant="outline" className={`text-xs flex items-center gap-1 ${statusConfig.class}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusConfig.label}
                            </Badge>
                          </div>
                          <p className="font-medium text-sm text-foreground truncate">{item.subject}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>
                        </div>
                        <p className="text-xs text-muted-foreground shrink-0">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
