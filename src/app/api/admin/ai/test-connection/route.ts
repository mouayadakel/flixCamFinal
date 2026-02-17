/**
 * @file route.ts
 * @description Test AI provider connection (OpenAI / Gemini)
 * @module app/api/admin/ai/test-connection
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/auth/permissions'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await hasPermission(session.user.id, PERMISSIONS.SETTINGS_UPDATE))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const provider = (body.provider ?? 'openai') as 'openai' | 'gemini'

    const setting = await prisma.aISettings.findUnique({
      where: { provider },
    })

    if (!setting?.apiKey || setting.apiKey.length < 10) {
      return NextResponse.json(
        { ok: false, error: 'مفتاح API غير مُعرّف أو غير صالح' },
        { status: 400 }
      )
    }

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${setting.apiKey}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json(
          { ok: false, error: (err as { error?: { message?: string } })?.error?.message ?? 'فشل الاتصال بـ OpenAI' },
          { status: 200 }
        )
      }
      return NextResponse.json({ ok: true, message: 'تم الاتصال بـ OpenAI بنجاح' })
    }

    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${setting.apiKey}`,
        { method: 'GET' }
      )
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: 'فشل الاتصال بـ Gemini' },
          { status: 200 }
        )
      }
      return NextResponse.json({ ok: true, message: 'تم الاتصال بـ Gemini بنجاح' })
    }

    return NextResponse.json({ ok: false, error: 'مزود غير مدعوم' }, { status: 400 })
  } catch (error) {
    console.error('Test connection error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'خطأ غير متوقع' },
      { status: 500 }
    )
  }
}
