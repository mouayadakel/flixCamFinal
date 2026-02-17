/**
 * @file image-review-tab.tsx
 * @description Grid of AI-generated images pending review; approve/reject actions
 * @module app/admin/(routes)/ai-dashboard/_components
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { CheckCircle, XCircle, ImageIcon } from 'lucide-react'

interface PendingImageItem {
  id: string
  url: string
  imageSource: string
  qualityScore: number | null
  productId: string
  productName: string
  createdAt: string
}

export function ImageReviewTab() {
  const { toast } = useToast()
  const [items, setItems] = useState<PendingImageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [bulkActing, setBulkActing] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filterProductId, setFilterProductId] = useState<string>('all')

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterProductId && filterProductId !== 'all') params.set('productId', filterProductId)
      const res = await fetch(`/api/admin/ai/pending-images?${params.toString()}`)
      if (!res.ok) throw new Error('فشل تحميل الصور')
      const data = await res.json()
      setItems(data.items ?? [])
      setSelectedIds(new Set())
    } catch (e) {
      toast({
        title: 'خطأ',
        description: e instanceof Error ? e.message : 'فشل تحميل قائمة الصور',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast, filterProductId])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const productOptions = Array.from(
    new Map(items.map((i) => [i.productId, i.productName])).entries()
  )

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(items.map((i) => i.id)))
  }

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActingId(id)
    try {
      const res = await fetch(`/api/admin/ai/pending-images/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل التنفيذ')
      toast({
        title: action === 'approve' ? 'تمت الموافقة' : 'تم الرفض',
        description: data.message,
      })
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (e) {
      toast({
        title: 'خطأ',
        description: e instanceof Error ? e.message : 'فشل التنفيذ',
        variant: 'destructive',
      })
    } finally {
      setActingId(null)
    }
  }

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) {
      toast({ title: 'اختر صوراً', variant: 'destructive' })
      return
    }
    setBulkActing(true)
    try {
      const res = await fetch('/api/admin/ai/pending-images/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل التنفيذ')
      toast({
        title: action === 'approve' ? 'تمت الموافقة على المحدد' : 'تم رفض المحدد',
        description: data.message,
      })
      setItems((prev) => prev.filter((i) => !selectedIds.has(i.id)))
      setSelectedIds(new Set())
    } catch (e) {
      toast({
        title: 'خطأ',
        description: e instanceof Error ? e.message : 'فشل التنفيذ',
        variant: 'destructive',
      })
    } finally {
      setBulkActing(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>مراجعة الصور</CardTitle>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 rounded-lg" />
              ))}
            </div>
          </CardContent>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>مراجعة الصور المُنشأة بالذكاء الاصطناعي</CardTitle>
        <p className="text-muted-foreground text-sm">
          {items.length === 0
            ? 'لا توجد صور في انتظار المراجعة'
            : `${items.length} صورة في انتظار المراجعة`}
        </p>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Select value={filterProductId} onValueChange={setFilterProductId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="المنتج" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المنتجات</SelectItem>
              {productOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {items.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === items.length}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-muted-foreground">تحديد الكل</span>
              </div>
              <Button
                size="sm"
                variant="default"
                disabled={bulkActing || selectedIds.size === 0}
                onClick={() => handleBulkAction('approve')}
              >
                <CheckCircle className="h-4 w-4 ml-1" />
                موافقة على المحدد ({selectedIds.size})
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={bulkActing || selectedIds.size === 0}
                onClick={() => handleBulkAction('reject')}
              >
                <XCircle className="h-4 w-4 ml-1" />
                رفض المحدد ({selectedIds.size})
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mb-4" />
            <p>لا توجد صور معلقة حاليًا</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((img) => (
              <div
                key={img.id}
                className="rounded-lg border bg-card p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedIds.has(img.id)}
                    onCheckedChange={() => toggleSelect(img.id)}
                  />
                  <div className="aspect-square flex-1 rounded-md bg-muted overflow-hidden min-w-0">
                    <img
                      src={img.url}
                      alt={img.productName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
                <p className="font-medium text-sm truncate" title={img.productName}>
                  {img.productName}
                </p>
                {img.qualityScore != null && (
                  <p className="text-muted-foreground text-xs">
                    جودة: {Math.round((img.qualityScore ?? 0) * 100)}%
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1"
                    disabled={actingId === img.id}
                    onClick={() => handleAction(img.id, 'approve')}
                  >
                    <CheckCircle className="h-4 w-4 ml-1" />
                    موافقة
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={actingId === img.id}
                    onClick={() => handleAction(img.id, 'reject')}
                  >
                    <XCircle className="h-4 w-4 ml-1" />
                    رفض
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
