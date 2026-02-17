/**
 * @file page.tsx
 * @description AI Dashboard — command center: Overview, Content Health Scanner, Analytics
 * @module app/admin/(routes)/ai-dashboard
 */

'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OverviewTab } from './_components/overview-tab'
import { ContentHealthTab } from './_components/content-health-tab'
import { AnalyticsTab } from './_components/analytics-tab'
import { ImageReviewTab } from './_components/image-review-tab'

export default function AIDashboardPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold">لوحة الذكاء الاصطناعي</h1>
        <p className="mt-2 text-muted-foreground">
          نظرة عامة على صحة المحتوى، والمسح، والملء التلقائي، وسجل المهام
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="content-health">صحة المحتوى</TabsTrigger>
          <TabsTrigger value="image-review">مراجعة الصور</TabsTrigger>
          <TabsTrigger value="analytics">التحليلات</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="content-health">
          <ContentHealthTab />
        </TabsContent>

        <TabsContent value="image-review">
          <ImageReviewTab />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
