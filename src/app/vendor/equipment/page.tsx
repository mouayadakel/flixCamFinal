/**
 * Vendor equipment list page
 */

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Package, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format.utils'

export default async function VendorEquipmentPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login?callbackUrl=/vendor/equipment')

  const vendor = await prisma.vendor.findFirst({
    where: { userId: session.user.id, deletedAt: null, status: 'APPROVED' },
  })
  if (!vendor) redirect('/login?error=VendorAccessDenied')

  const equipment = await prisma.equipment.findMany({
    where: { vendorId: vendor.id, deletedAt: null },
    include: {
      category: { select: { name: true, slug: true } },
      brand: { select: { name: true } },
      media: { where: { deletedAt: null }, take: 1, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">معداتي</h1>
          <p className="mt-1 text-muted-foreground">إدارة المعدات المدرجة وتتبع الإيجارات</p>
        </div>
        <Link href="/vendor/equipment/new">
          <Button>
            <Plus className="ml-2 h-4 w-4" />
            إضافة معدات جديدة
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            قائمة المعدات ({equipment.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {equipment.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>لا توجد معدات مدرجة بعد</p>
              <Link href="/vendor/equipment/new">
                <Button className="mt-4">إضافة أول معدات</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {equipment.map((eq) => {
                const customFields = (eq.customFields as Record<string, unknown>) || {}
                const status = (customFields.vendorSubmissionStatus as string) || 'approved'
                return (
                  <div
                    key={eq.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-4">
                      {eq.media[0] ? (
                        <img
                          src={eq.media[0].url}
                          alt=""
                          className="h-16 w-16 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded bg-muted">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{eq.model || eq.sku}</div>
                        <div className="text-sm text-muted-foreground">
                          {eq.category?.name} {eq.brand?.name && `• ${eq.brand.name}`}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge
                            variant={
                              status === 'approved'
                                ? 'default'
                                : status === 'rejected'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {status === 'pending_review'
                              ? 'قيد المراجعة'
                              : status === 'approved'
                                ? 'معتمد'
                                : 'مرفوض'}
                          </Badge>
                          {!eq.isActive && <Badge variant="outline">غير نشط</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(Number(eq.dailyPrice))}</div>
                        <div className="text-xs text-muted-foreground">/ يوم</div>
                      </div>
                      <Link href={`/vendor/equipment/${eq.id}`}>
                        <Button variant="outline" size="sm">
                          تعديل
                        </Button>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
