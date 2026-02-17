/**
 * @file overview-tab.tsx
 * @description Quality score dashboard: gauge, donut gap breakdown, trend chart, bottom-20 table, goal tracking
 * @module app/admin/(routes)/ai-dashboard/_components
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CircularProgress } from '@/components/ui/circular-progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Package, CheckCircle, AlertCircle, Activity, Target, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { arSA } from 'date-fns/locale'

interface SummaryData {
  totalProducts: number
  avgQualityScore: number
  distribution: { excellent: number; good: number; fair: number; poor: number }
  gaps: {
    missingTranslations: number
    missingSeo: number
    missingDescription: number
    missingPhotos: number
    missingSpecs: number
  }
  scannedAt: string
}

interface TrendPoint {
  date: string
  avgScore: number
  totalProducts: number
}

interface BottomProduct {
  id: string
  name: string
  score: number
}

const GAP_LABELS: Record<string, string> = {
  missingTranslations: 'ترجمات',
  missingSeo: 'SEO',
  missingDescription: 'وصف',
  missingPhotos: 'صور',
  missingSpecs: 'مواصفات',
}

const GAP_COLORS = ['#1F87E8', '#E8A31F', '#E84A1F', '#1FE87E', '#9B1FE8']

export function OverviewTab() {
  const { toast } = useToast()
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [bottomProducts, setBottomProducts] = useState<BottomProduct[]>([])
  const [targetScore, setTargetScore] = useState(80)
  const [loading, setLoading] = useState(true)
  const [fillingId, setFillingId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [summaryRes, trendRes, productsRes] = await Promise.all([
        fetch('/api/admin/ai/quality/summary'),
        fetch('/api/admin/ai/quality/trend?days=84'),
        fetch('/api/admin/ai/quality/products?sort=score&order=asc&limit=20'),
      ])
      if (summaryRes.ok) {
        const d = await summaryRes.json()
        const data = d.data ?? d
        setSummary({
          totalProducts: data.totalProducts ?? 0,
          avgQualityScore: data.avgQualityScore ?? 0,
          distribution: data.distribution ?? { excellent: 0, good: 0, fair: 0, poor: 0 },
          gaps: data.gaps ?? {
            missingTranslations: 0,
            missingSeo: 0,
            missingDescription: 0,
            missingPhotos: 0,
            missingSpecs: 0,
          },
          scannedAt: data.scannedAt ?? '',
        })
      }
      if (trendRes.ok) {
        const t = await trendRes.json()
        const arr = (t.data ?? t) as Array<{ date: string; avgScore: number; totalProducts: number }>
        setTrend(Array.isArray(arr) ? arr : [])
      }
      if (productsRes.ok) {
        const p = await productsRes.json()
        const list = (p.data?.products ?? p.products ?? []) as BottomProduct[]
        setBottomProducts(Array.isArray(list) ? list : [])
      }
    } catch {
      toast({ title: 'خطأ', description: 'فشل تحميل بيانات الجودة', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleFillNow = async (productId: string) => {
    setFillingId(productId)
    try {
      const res = await fetch('/api/admin/ai/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: [productId] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل تشغيل الملء')
      toast({
        title: 'تمت إضافة المهمة',
        description: data.jobId ? `رقم المهمة: ${data.jobId}` : 'سيتم معالجة المنتج قريباً',
      })
      setBottomProducts((prev) => prev.filter((p) => p.id !== productId))
    } catch (e) {
      toast({
        title: 'خطأ',
        description: e instanceof Error ? e.message : 'فشل تشغيل الملء',
        variant: 'destructive',
      })
    } finally {
      setFillingId(null)
    }
  }

  const donutData = summary?.gaps
    ? Object.entries(summary.gaps)
        .filter(([, v]) => Number(v) > 0)
        .map(([key, value]) => ({ name: GAP_LABELS[key] ?? key, value: Number(value) }))
    : []

  const trendChartData = trend.map((t) => ({
    date: format(new Date(t.date), 'dd/MM', { locale: arSA }),
    avgScore: t.avgScore,
  }))

  const productsToReachTarget = summary
    ? (() => {
        const { excellent, good, fair, poor } = summary.distribution
        if (targetScore >= 80) return good + fair + poor
        if (targetScore >= 60) return fair + poor
        if (targetScore >= 40) return poor
        return 0
      })()
    : 0

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المنتجات</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalProducts ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">منتجات بمحتوى كامل (80+)</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.distribution?.excellent ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">منتجات تحتاج تحسين</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary?.distribution?.good ?? 0) +
                (summary?.distribution?.fair ?? 0) +
                (summary?.distribution?.poor ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">متوسط نقاط الجودة</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CircularProgress
                value={summary?.avgQualityScore ?? 0}
                size={48}
                strokeWidth={4}
              />
              <span className="text-2xl font-bold">{summary?.avgQualityScore ?? 0}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>مقياس الجودة الإجمالي</CardTitle>
            <CardDescription>متوسط نقاط المحتوى عبر الكتالوج</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <CircularProgress
              value={summary?.avgQualityScore ?? 0}
              size={160}
              strokeWidth={8}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>توزيع الفجوات</CardTitle>
            <CardDescription>عدد المنتجات حسب نوع النقص</CardDescription>
          </CardHeader>
          <CardContent>
            {donutData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={GAP_COLORS[i % GAP_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, 'منتج']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">لا توجد فجوات مسجلة</p>
            )}
          </CardContent>
        </Card>
      </div>

      {trendChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>اتجاه الجودة (آخر 12 أسبوعاً)</CardTitle>
            <CardDescription>متوسط النقاط حسب التاريخ</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip
                  formatter={(value: number | undefined) => [
                    `${value ?? 0}%`,
                    'متوسط النقاط',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  stroke="#1F87E8"
                  strokeWidth={2}
                  name="نقاط الجودة"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>تتبع الهدف</CardTitle>
            <CardDescription>حدد هدف نقاط الجودة واعرف كم منتج يحتاج تحسين</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-muted-foreground" />
            <input
              type="number"
              min={0}
              max={100}
              value={targetScore}
              onChange={(e) => setTargetScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              className="w-16 rounded border bg-background px-2 py-1 text-center text-lg font-medium"
            />
            <span className="text-muted-foreground">%</span>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-lg">
            <span className="font-bold text-primary">{productsToReachTarget}</span>
            {' '}
            منتج تحتاج تحسين للوصول إلى هدف
            {' '}
            <span className="font-bold">{targetScore}%</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>أقل 20 منتجاً من حيث الجودة</CardTitle>
          <CardDescription>ملء الآن بالذكاء الاصطناعي لكل منتج</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {bottomProducts.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">لا توجد منتجات في القائمة</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead>النقاط</TableHead>
                  <TableHead className="text-left">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bottomProducts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <span className="font-mono">{p.score}%</span>
                    </TableCell>
                    <TableCell className="text-left">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={fillingId === p.id}
                        onClick={() => handleFillNow(p.id)}
                      >
                        <Sparkles className="h-4 w-4 ml-1" />
                        {fillingId === p.id ? 'جاري...' : 'ملء الآن'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>إجراءات سريعة</CardTitle>
          <CardDescription>فحص المحتوى أو تشغيل الملء بالذكاء الاصطناعي</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/admin/ai-dashboard">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => fetchAll()}>
              تحديث البيانات
            </Button>
          </Link>
          <Link href="/admin/ai-dashboard">
            <Button variant="outline" className="w-full sm:w-auto">
              فحص الكل
            </Button>
          </Link>
          <Link href="/admin/ai-dashboard">
            <Button className="w-full sm:w-auto">ملء الكل بالذكاء الاصطناعي</Button>
          </Link>
          <Link href="/admin/ai-dashboard">
            <Button variant="secondary" className="w-full sm:w-auto">
              عرض سجل المهام
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
