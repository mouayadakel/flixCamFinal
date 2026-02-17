/**
 * @file page.tsx
 * @description Featured equipment control – select which equipment appears on the homepage (unlimited).
 * This is the only place to set or clear the featured flag.
 * @module app/admin/(routes)/inventory/featured
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Package, Loader2, Save, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import Image from 'next/image'

interface EquipmentItem {
  id: string
  sku: string
  model: string | null
  featured: boolean
  category: { id: string; name: string; slug: string }
  brand: { id: string; name: string; slug: string } | null
  media: Array<{ id: string; url: string }>
}

export default function FeaturedEquipmentPage() {
  const { toast } = useToast()
  const [equipment, setEquipment] = useState<EquipmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [featuredFilter, setFeaturedFilter] = useState<'all' | 'featured'>('all')
  const [localFeatured, setLocalFeatured] = useState<Record<string, boolean>>({})

  const loadEquipment = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('take', '500')
      const response = await fetch(`/api/equipment?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to load equipment')
      const data = await response.json()
      const items: EquipmentItem[] = data.items || []
      setEquipment(items)
      setLocalFeatured(
        items.reduce<Record<string, boolean>>((acc, item) => {
          acc[item.id] = item.featured
          return acc
        }, {})
      )
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'فشل تحميل المعدات',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadEquipment()
  }, [loadEquipment])

  const handleToggle = (id: string, checked: boolean) => {
    setLocalFeatured((prev) => ({ ...prev, [id]: checked }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const toFeature = equipment
        .filter((e) => localFeatured[e.id] === true && !e.featured)
        .map((e) => e.id)
      const toUnfeature = equipment
        .filter((e) => localFeatured[e.id] === false && e.featured)
        .map((e) => e.id)

      if (toFeature.length > 0) {
        const res1 = await fetch('/api/admin/equipment/featured', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ equipmentIds: toFeature, featured: true }),
        })
        if (!res1.ok) {
          const err = await res1.json()
          throw new Error(err.error || 'Failed to set featured')
        }
      }
      if (toUnfeature.length > 0) {
        const res2 = await fetch('/api/admin/equipment/featured', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ equipmentIds: toUnfeature, featured: false }),
        })
        if (!res2.ok) {
          const err = await res2.json()
          throw new Error(err.error || 'Failed to unset featured')
        }
      }

      toast({
        title: 'تم الحفظ',
        description: 'تم تحديث المعدات المميزة بنجاح. ستظهر عشوائياً في الصفحة الرئيسية.',
      })
      loadEquipment()
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'فشل حفظ التغييرات',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const filtered = equipment.filter((item) => {
    const matchSearch =
      !search ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.model?.toLowerCase().includes(search.toLowerCase()) ||
      item.category.name.toLowerCase().includes(search.toLowerCase())
    const matchFeatured =
      featuredFilter === 'all' || (featuredFilter === 'featured' && localFeatured[item.id])
    return matchSearch && matchFeatured
  })

  const hasChanges = equipment.some((e) => localFeatured[e.id] !== e.featured)

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">المعدات المميزة</h1>
          <p className="mt-1 text-sm text-neutral-600">
            العناصر المحددة هنا تظهر عشوائياً في قسم «معدات مميزة» بالصفحة الرئيسية. يمكنك اختيار
            عدد غير محدود.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="ml-2 h-4 w-4" />
          )}
          حفظ التغييرات
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Input
                placeholder="بحث (SKU، الموديل، الفئة)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-3"
                dir="rtl"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={featuredFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFeaturedFilter('all')}
              >
                الكل
              </Button>
              <Button
                variant={featuredFilter === 'featured' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFeaturedFilter('featured')}
              >
                <Star className="ml-1 h-4 w-4" />
                المميزة فقط
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-neutral-500">
              {equipment.length === 0
                ? 'لا توجد معدات. أضف معدات من صفحة المعدات أولاً.'
                : 'لا توجد نتائج تطابق البحث أو الفلتر.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">عرض على الصفحة الرئيسية</TableHead>
                  <TableHead>الصورة</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>الموديل</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const imgUrl = item.media?.[0]?.url
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={!!localFeatured[item.id]}
                          onCheckedChange={(checked) =>
                            handleToggle(item.id, checked === true)
                          }
                          aria-label={`عرض ${item.model || item.sku} على الصفحة الرئيسية`}
                        />
                      </TableCell>
                      <TableCell>
                        {imgUrl ? (
                          <div className="relative h-12 w-12 overflow-hidden rounded border border-neutral-200">
                            <Image
                              src={imgUrl}
                              alt={item.sku}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded border border-neutral-200 bg-neutral-100">
                            <Package className="h-5 w-5 text-neutral-400" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                      <TableCell>{item.model || '—'}</TableCell>
                      <TableCell>{item.category.name}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/inventory/equipment/${item.id}`}>عرض</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
