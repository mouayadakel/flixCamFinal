/**
 * @file finance/reports/page.tsx
 * @description Financial reports and analytics page
 * @module app/admin/(routes)/finance/reports
 * @author Engineering Team
 * @created 2026-01-28
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { BarChart3, TrendingUp, Download, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils/format.utils'
import { useToast } from '@/hooks/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import type { ReportType } from '@/lib/types/reports.types'

function ReportTable({ data }: { data: any }) {
  if (!data) return null

  // If it's an array of objects, render as table
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
    const keys = Object.keys(data[0])
    return (
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {keys.map((k) => (
                <TableHead key={k}>{k}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, 50).map((row: any, i: number) => (
              <TableRow key={i}>
                {keys.map((k) => (
                  <TableCell key={k} className="text-sm">
                    {typeof row[k] === 'number'
                      ? row[k].toLocaleString('ar-SA')
                      : row[k] instanceof Date
                        ? new Date(row[k]).toLocaleDateString('ar-SA')
                        : typeof row[k] === 'object'
                          ? JSON.stringify(row[k])
                          : String(row[k] ?? '—')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data.length > 50 && (
          <p className="mt-2 text-xs text-muted-foreground">عرض 50 من {data.length} سجل</p>
        )}
      </div>
    )
  }

  // If it's a plain object, render key-value pairs
  if (typeof data === 'object' && !Array.isArray(data)) {
    const entries = Object.entries(data)
    const simpleEntries = entries.filter(([, v]) => typeof v !== 'object' || v === null)
    const complexEntries = entries.filter(([, v]) => typeof v === 'object' && v !== null)

    return (
      <div className="space-y-4">
        {simpleEntries.length > 0 && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
            {simpleEntries.map(([key, val]) => (
              <div key={key} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{key}</p>
                <p className="font-medium">
                  {typeof val === 'number' ? val.toLocaleString('ar-SA') : String(val ?? '—')}
                </p>
              </div>
            ))}
          </div>
        )}
        {complexEntries.map(([key, val]) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{key}</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportTable data={val} />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return <p className="text-sm">{String(data)}</p>
}

export default function FinancialReportsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [reportType, setReportType] = useState<ReportType>('revenue')
  const [dateFrom, setDateFrom] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  )
  const [dateTo, setDateTo] = useState<string>(new Date().toISOString().split('T')[0])
  const [reportData, setReportData] = useState<any>(null)

  const reportTypes: Array<{ value: ReportType; label: { ar: string; en: string } }> = [
    { value: 'revenue', label: { ar: 'الإيرادات', en: 'Revenue' } },
    { value: 'bookings', label: { ar: 'الحجوزات', en: 'Bookings' } },
    { value: 'equipment', label: { ar: 'المعدات', en: 'Equipment' } },
    { value: 'customers', label: { ar: 'العملاء', en: 'Customers' } },
    { value: 'financial', label: { ar: 'المالية', en: 'Financial' } },
    { value: 'inventory', label: { ar: 'المخزون', en: 'Inventory' } },
  ]

  const generateReport = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/reports/${reportType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateFrom: new Date(dateFrom),
          dateTo: new Date(dateTo),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'فشل إنشاء التقرير')
      }

      const data = await response.json()
      setReportData(data.data)
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'حدث خطأ أثناء إنشاء التقرير',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [reportType, dateFrom, dateTo, toast])

  useEffect(() => {
    generateReport()
  }, [generateReport])

  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'pdf' | 'xlsx'>('xlsx')

  const handleExport = async () => {
    if (!reportData) return
    setExporting(true)
    try {
      const res = await fetch(`/api/reports/${reportType}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom: new Date(dateFrom),
          dateTo: new Date(dateTo),
          format: exportFormat,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'فشل التصدير')
      }
      const blob = await res.blob()
      const ext = exportFormat === 'xlsx' ? 'xlsx' : 'pdf'
      const contentType =
        exportFormat === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf'
      const url = URL.createObjectURL(new Blob([blob], { type: contentType }))
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${reportType}-${dateFrom}-${dateTo}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'تم التصدير', description: `تم تحميل التقرير (${ext.toUpperCase()})` })
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'فشل تصدير التقرير',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">التقارير المالية</h1>
          <p className="mt-2 text-muted-foreground">تقارير وإحصائيات شاملة للأداء المالي</p>
        </div>
        {reportData && (
          <div className="flex items-center gap-2">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'xlsx')}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="xlsx">Excel (XLSX)</option>
              <option value="pdf">PDF</option>
            </select>
            <Button onClick={handleExport} disabled={exporting}>
              <Download className="ml-2 h-4 w-4" />
              {exporting ? 'جاري التصدير...' : 'تصدير التقرير'}
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>إعدادات التقرير</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium">نوع التقرير</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="w-full rounded-lg border px-4 py-2"
              >
                {reportTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label.ar}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">من تاريخ</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border px-4 py-2"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">إلى تاريخ</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border px-4 py-2"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={generateReport} className="w-full" disabled={loading}>
                <BarChart3 className="ml-2 h-4 w-4" />
                {loading ? 'جاري الإنشاء...' : 'إنشاء التقرير'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {loading ? (
        <Card>
          <CardContent className="py-8">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ) : reportData ? (
        <div className="space-y-4">
          {/* Summary Cards */}
          {reportType === 'revenue' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(reportData.totalRevenue)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {reportData.totalBookings} حجز
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">متوسط قيمة الحجز</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(reportData.averageBookingValue)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">ضريبة القيمة المضافة</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(reportData.vatAmount)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">صافي الإيرادات</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(reportData.netRevenue)}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Report Details */}
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل التقرير</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportTable data={reportData} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {`اختر نوع التقرير والتواريخ ثم انقر على "إنشاء التقرير"`}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
