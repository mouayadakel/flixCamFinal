/**
 * @file page.tsx
 * @description Admin CMS overview – links to FAQ, Policies, Featured.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Layout, HelpCircle, FileText, Star, Video } from 'lucide-react'

const cmsSections = [
  {
    titleAr: 'الأسئلة الشائعة',
    titleEn: 'FAQ',
    href: '/admin/cms/faq',
    icon: HelpCircle,
    description: 'إدارة أسئلة الصفحة الرئيسية: إضافة، تعديل، حذف، وترتيب',
  },
  {
    titleAr: 'السياسات',
    titleEn: 'Policies',
    href: '/admin/cms/policies',
    icon: FileText,
    description: 'إدارة بنود صفحة السياسات (شروط التأجير)',
  },
  {
    titleAr: 'المحتوى المميز',
    titleEn: 'Featured',
    href: '/admin/cms/featured',
    icon: Star,
    description: 'إدارة المحتوى المميز على الموقع',
  },
  {
    titleAr: 'الاستوديوهات',
    titleEn: 'Studios',
    href: '/admin/cms/studios',
    icon: Video,
    description: 'إدارة محتوى صفحات الاستوديوهات: صور، أسعار، باكجات، موقع، أسئلة شائعة',
  },
]

export default function CmsPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Layout className="h-8 w-8" />
          إدارة المحتوى (CMS)
        </h1>
        <p className="mt-1 text-muted-foreground">
          إدارة محتوى الموقع العام: الأسئلة الشائعة، السياسات، والمحتوى المميز
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {cmsSections.map((section) => {
          const Icon = section.icon
          return (
            <Card key={section.href}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {section.titleAr} / {section.titleEn}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={section.href}>فتح</Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
