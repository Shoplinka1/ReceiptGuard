import React, { useState, useRef, useCallback } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FileText, FileImage, File, Upload, Search, Plus, MoreHorizontal,
  Trash2, Download, AlertCircle, FolderOpen, Loader2,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customFetch } from '@workspace/api-client-react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { toast } from 'sonner'

const CATEGORIES = ['all', 'receipt', 'warranty', 'return', 'invoice', 'manual', 'other'] as const

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All documents', receipt: 'Receipts', warranty: 'Warranties',
  return: 'Returns', invoice: 'Invoices', manual: 'Manuals', other: 'Other',
}

function fileIcon(fileType: string | null | undefined) {
  if (!fileType) return <File className="w-6 h-6 text-muted-foreground" />
  if (fileType === 'pdf') return <FileText className="w-6 h-6 text-red-500" />
  if (fileType === 'image') return <FileImage className="w-6 h-6 text-blue-500" />
  return <File className="w-6 h-6 text-muted-foreground" />
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function detectFileType(file: File): 'pdf' | 'image' | 'other' {
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type.startsWith('image/')) return 'image'
  return 'other'
}

async function fetchDocuments(category?: string, search?: string) {
  const params = new URLSearchParams()
  if (category && category !== 'all') params.set('category', category)
  if (search) params.set('search', search)
  const qs = params.toString()
  return customFetch<any[]>(`/api/documents${qs ? `?${qs}` : ''}`)
}

export default function DocumentsPage() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [uploadCategory, setUploadCategory] = useState('other')
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [dragOver, setDragOver] = useState(false)

  const { data: documents = [], isLoading, error } = useQuery({
    queryKey: ['/api/documents', category, search],
    queryFn: () => fetchDocuments(category, search),
    staleTime: 30_000,
  })

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      const result = await customFetch<any>(`/api/documents/${doc.id}`, { method: 'DELETE' })
      // Remove from Supabase Storage if URL is a Supabase storage path
      if (result.fileUrl && result.fileUrl.includes('/storage/')) {
        try {
          const pathParts = result.fileUrl.split('/storage/v1/object/public/documents/')
          if (pathParts[1]) {
            await supabase.storage.from('documents').remove([pathParts[1]])
          }
        } catch {}
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/documents'] })
      toast.success('Document deleted')
      setDeleteTarget(null)
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete'),
  })

  const handleFileSelect = (file: File) => {
    setUploadFile(file)
    setUploadName(file.name.replace(/\.[^.]+$/, ''))
    setUploadOpen(true)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [])

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim()) { toast.error('Name is required'); return }
    setUploading(true)
    try {
      // Upload to Supabase Storage
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) throw new Error('Not authenticated')

      const ext = uploadFile.name.split('.').pop()
      const path = `${userId}/${Date.now()}.${ext}`

      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(path, uploadFile, { upsert: false, contentType: uploadFile.type })

      if (storageError) {
        // If bucket doesn't exist or permission error, fall back to blob URL handling
        throw new Error(storageError.message)
      }

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
      const fileUrl = urlData.publicUrl

      // Save metadata to API
      await customFetch('/api/documents', {
        method: 'POST',
        body: JSON.stringify({
          name: uploadName.trim(),
          fileUrl,
          fileType: detectFileType(uploadFile),
          fileSizeBytes: uploadFile.size,
          category: uploadCategory,
        }),
      })

      qc.invalidateQueries({ queryKey: ['/api/documents'] })
      toast.success('Document uploaded!')
      setUploadOpen(false)
      setUploadFile(null)
    } catch (e: any) {
      toast.error(e.message || 'Upload failed. Ensure the "documents" storage bucket exists in Supabase.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Document Vault</h1>
            <p className="text-sm text-muted-foreground">Receipts, warranties, invoices, and manuals — all in one place.</p>
          </div>
          <Button onClick={() => fileInputRef.current?.click()} size="sm" className="shrink-0">
            <Upload className="w-4 h-4 mr-1.5" /> Upload Document
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.txt,.csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }}
          />
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
        >
          <Upload className={`w-8 h-8 mx-auto mb-3 transition-colors ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
          <p className="text-sm font-medium text-foreground">Drop files here or click to upload</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, images, Word docs, spreadsheets — any file type</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search documents…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Document grid */}
        {error ? (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <AlertCircle className="w-10 h-10 opacity-30 text-destructive" />
            <p className="text-sm font-medium text-destructive">Failed to load documents</p>
            <p className="text-xs">Check your connection and refresh.</p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full mb-3" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-4 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <FolderOpen className="w-8 h-8 opacity-30" />
            </div>
            {search || category !== 'all' ? (
              <>
                <p className="text-sm font-semibold text-foreground">No documents match</p>
                <Button size="sm" variant="outline" onClick={() => { setSearch(''); setCategory('all') }}>Clear filters</Button>
              </>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Your document vault is empty</p>
                  <p className="text-xs mt-1 max-w-xs">Upload receipts, warranty PDFs, invoices, and product manuals to keep everything in one searchable place.</p>
                </div>
                <Button size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4 mr-1.5" />Upload first document</Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {documents.map((doc: any) => (
              <Card key={doc.id} className="border-border/60 hover:border-primary/20 transition-colors group overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-secondary rounded-lg">
                      {fileIcon(doc.fileType)}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="w-4 h-4 mr-2" />Download
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(doc)}>
                          <Trash2 className="w-4 h-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate leading-tight">{doc.name}</p>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] capitalize">{doc.category}</Badge>
                    {doc.fileSizeBytes && <span className="text-xs text-muted-foreground">{formatBytes(doc.fileSizeBytes)}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{format(new Date(doc.createdAt), 'MMM d, yyyy')}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && documents.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={o => { if (!uploading) { setUploadOpen(o); if (!o) setUploadFile(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>Set a name and category before saving to your vault.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {uploadFile && (
              <div className="p-3 bg-muted rounded-lg flex items-center gap-3">
                {fileIcon(detectFileType(uploadFile))}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{uploadFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(uploadFile.size)}</p>
                </div>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Document Name <span className="text-destructive">*</span></Label>
              <Input value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="e.g. Apple MacBook Receipt 2024" />
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['receipt', 'warranty', 'return', 'invoice', 'manual', 'other'] as const).map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setUploadFile(null) }} disabled={uploading}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadName.trim()}>
              {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the document from your vault and storage.</AlertDialogDescription>
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
