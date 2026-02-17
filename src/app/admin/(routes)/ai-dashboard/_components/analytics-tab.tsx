/**
 * @file analytics-tab.tsx
 * @description Job history table + cost chart
 * @module app/admin/(routes)/ai-dashboard/_components
 */

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'
import { arSA } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'

interface AiJobRow {
  id: string
  type: string
  status: string
  total: number
  processed: number
  errors: number
  costUsd: number | null
  startedAt: string
  completedAt: string | null
}

const TYPE_LABELS: Record<string, string> = {
  backfill: 'ملء محتوى',
  photos: 'صور',
  specs: 'مواصفات',
  chatbot: 'دردشة',
}

export function AnalyticsTab() {
  const [jobs, setJobs] = useState<AiJobRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/ai/jobs?limit=30')
        if (res.ok) {
          const data = await res.json()
          setJobs(data.jobs ?? [])
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const chartData = (() => {
    const byDate: Record<string, number> = {}
    jobs.forEach((j) => {
      if (j.costUsd != null && j.costUsd > 0) {
        const d = format(new Date(j.startedAt), 'yyyy-MM-dd')
        byDate[d] = (byDate[d] ?? 0) + j.costUsd
      }
    })
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cost]) => ({ date: format(new Date(date), 'dd/MM', { locale: arSA }), cost }))
  })()

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>التكلفة حسب اليوم</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value: number | undefined) => [
                    `${(value ?? 0).toFixed(4)} USD`,
                    'التكلفة',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="#1F87E8"
                  strokeWidth={2}
                  name="التكلفة"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>سجل المهام</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الوقت</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>المُعالَج</TableHead>
                <TableHead>الأخطاء</TableHead>
                <TableHead>التكلفة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>
                    {format(new Date(j.startedAt), 'dd/MM/yyyy HH:mm', { locale: arSA })}
                  </TableCell>
                  <TableCell>{TYPE_LABELS[j.type] ?? j.type}</TableCell>
                  <TableCell>
                    <Badge variant={j.status === 'done' ? 'default' : j.status === 'failed' ? 'destructive' : 'secondary'}>
                      {j.status === 'done' ? 'منتهية' : j.status === 'failed' ? 'فشل' : j.status === 'running' ? 'جارية' : 'قيد الانتظار'}
                    </Badge>
                  </TableCell>
                  <TableCell>{j.processed} / {j.total}</TableCell>
                  <TableCell>{j.errors}</TableCell>
                  <TableCell>{j.costUsd != null ? `${j.costUsd.toFixed(4)} USD` : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {jobs.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">لا توجد مهام حتى الآن</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
