/**
 * @file content-health-tab.tsx
 * @description Content Health Scanner: gap cards, scan/fill actions, products table
 * @module app/admin/(routes)/ai-dashboard/_components
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import type { GapType } from '@/lib/services/content-health.service'

const GAP_LABELS: Record<GapType, string> = {
  translations: 'ترجمات ناقصة',
  seo: 'SEO ناقص',
  description: 'وصف ناقص',
  photos: 'صور أقل من 4',
  specs: 'مواصفات ناقصة',
}

export function ContentHealthTab() {
  const { toast } = useToast()
  const [scanData, setScanData] = useState<{
    total: number
    byGapType: Record<GapType, number>
    products: Array<{ id: string; name: string; qualityScore: number; missingFields: GapType[] }>
  } | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState<{
    status: string
    progress: number
    processed: number
    total: number
    errors: number
  } | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 20

  const fetchScan = useCallback(async () => {
    setIsScanning(true)
    try {
      const res = await fetch(`/api/admin/ai/content-health?page=${page}&limit=${limit}`)
      if (!res.ok) throw new Error('فشل الفحص')
      const data = await res.json()
      setScanData({
        total: data.total,
        byGapType: data.byGapType,
        products: data.products ?? [],
      })
    } catch (e) {
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل تحميل البيانات', variant: 'destructive' })
    } finally {
      setIsScanning(false)
    }
  }, [page, toast])

  useEffect(() => {
    fetchScan()
  }, [fetchScan])

  useEffect(() => {
    if (!jobId || !isRunning) return
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/ai/backfill?jobId=${jobId}`)
        if (!res.ok) return
        const data = await res.json()
        setJobProgress({
          status: data.status,
          progress: data.progress ?? 0,
          processed: data.processed ?? 0,
          total: data.total ?? 0,
          errors: data.errors ?? 0,
        })
        if (data.status === 'done' || data.status === 'failed') {
          setIsRunning(false)
          setJobId(null)
          fetchScan()
          toast({ title: 'تم', description: data.status === 'done' ? 'اكتمل الملء' : 'فشل بعض العناصر' })
        }
      } catch {
        // ignore
      }
    }, 2000)
    return () => clearInterval(t)
  }, [jobId, isRunning, fetchScan, toast])

  const handleScanAll = () => {
    fetchScan()
    toast({ title: 'تم', description: 'تم تحديث الفحص' })
  }

  const handleFillAll = async () => {
    setIsRunning(true)
    try {
      const res = await fetch('/api/admin/ai/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fillAll: true }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'فشل البدء')
      }
      const data = await res.json()
      setJobId(data.jobId ?? null)
      setJobProgress({ status: 'running', progress: 0, processed: 0, total: data.queued ?? 0, errors: 0 })
      if (data.queued === 0 && data.message) {
        toast({ title: 'تم', description: data.message })
        setIsRunning(false)
      } else {
        toast({ title: 'تم', description: `تم إدراج ${data.queued} منتج في قائمة المعالجة` })
      }
    } catch (e) {
      setIsRunning(false)
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل تشغيل الملء', variant: 'destructive' })
    }
  }

  const handleFillSelected = async () => {
    if (selectedIds.length === 0) {
      toast({ title: 'تنبيه', description: 'اختر منتجات أولاً', variant: 'destructive' })
      return
    }
    setIsRunning(true)
    try {
      const res = await fetch('/api/admin/ai/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedIds }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'فشل البدء')
      }
      const data = await res.json()
      setJobId(data.jobId ?? null)
      setJobProgress({ status: 'running', progress: 0, processed: 0, total: data.queued ?? 0, errors: 0 })
      setSelectedIds([])
      toast({ title: 'تم', description: data.message ?? `تم إدراج ${data.queued} منتج` })
    } catch (e) {
      setIsRunning(false)
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل', variant: 'destructive' })
    }
  }

  const handleFillOne = async (id: string) => {
    try {
      const res = await fetch('/api/admin/ai/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: [id] }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'فشل الملء')
      }
      toast({ title: 'تم', description: 'تم إدراج المنتج في المعالجة' })
      if (data.jobId) {
        setJobId(data.jobId)
        setIsRunning(true)
        setJobProgress({ status: 'running', progress: 0, processed: 0, total: 1, errors: 0 })
      }
    } catch (e) {
      toast({ title: 'خطأ', description: e instanceof Error ? e.message : 'فشل الملء', variant: 'destructive' })
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  const toggleSelectAll = () => {
    if (!scanData?.products.length) return
    if (selectedIds.length === scanData.products.length) setSelectedIds([])
    else setSelectedIds(scanData.products.map((p) => p.id))
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(GAP_LABELS) as GapType[]).map((key) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{GAP_LABELS[key]}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{scanData?.byGapType?.[key] ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleScanAll} disabled={isScanning} variant="outline">
          فحص الكل
        </Button>
        <Button onClick={handleFillAll} disabled={isRunning}>
          ملء الكل بالذكاء الاصطناعي
        </Button>
        <Button onClick={handleFillSelected} disabled={isRunning || selectedIds.length === 0} variant="secondary">
          ملء المحدد ({selectedIds.length})
        </Button>
        {scanData && (
          <span className="text-muted-foreground text-sm">آخر فحص: منذ قليل</span>
        )}
      </div>

      {jobProgress && isRunning && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>جاري المعالجة...</span>
                <span>
                  {jobProgress.processed} / {jobProgress.total} ({jobProgress.progress}%)
                </span>
              </div>
              <Progress value={jobProgress.progress} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>المنتجات</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={scanData?.products.length ? selectedIds.length === scanData.products.length : false}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>نقاط الجودة</TableHead>
                  <TableHead>اسم المنتج</TableHead>
                  <TableHead>الحقول الناقصة</TableHead>
                  <TableHead className="text-left">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scanData?.products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(p.id)}
                        onCheckedChange={() => toggleSelect(p.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          p.qualityScore >= 70
                            ? 'text-green-600'
                            : p.qualityScore >= 40
                              ? 'text-amber-600'
                              : 'text-red-600'
                        }
                      >
                        {p.qualityScore}
                      </span>
                    </TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.missingFields.map((g) => (
                          <Badge key={g} variant="secondary" className="text-xs">
                            {GAP_LABELS[g]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-left">
                      <Button size="sm" variant="outline" onClick={() => handleFillOne(p.id)} disabled={isRunning}>
                        ملء الآن
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {scanData?.products.length === 0 && !isScanning && (
              <div className="py-8 text-center text-muted-foreground">لا توجد منتجات في هذه الصفحة</div>
            )}
            {scanData && scanData.total > limit && (
              <div className="flex justify-between p-4">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  السابق
                </Button>
                <span className="text-sm text-muted-foreground">
                  صفحة {page} من {Math.ceil(scanData.total / limit)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= Math.ceil(scanData.total / limit)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  التالي
                </Button>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  )
}
