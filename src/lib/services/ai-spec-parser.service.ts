/**
 * @file ai-spec-parser.service.ts
 * @description LLM-based spec inference with confidence scoring.
 * >90% auto-save, 70-90% save as suggestion, <70% flag for manual entry.
 * @module lib/services
 */

import { getExpectedSpecs } from '@/lib/ai/spec-templates'
import type { InferredSpec } from '@/lib/types/backfill.types'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

export type ProductForSpecInference = {
  id: string
  sku: string | null
  category?: { name: string } | null
  brand?: { name: string } | null
  boxContents?: string | null
  translations: Array<{
    locale: string
    name: string
    shortDescription: string | null
    longDescription: string | null
    specifications: unknown
  }>
}

/**
 * Infer missing specification values using LLM (product name, category, description, partial specs).
 * Confidence: >90% auto-save, 70-90% suggestion, <70% flag for manual.
 */
export async function inferMissingSpecs(product: ProductForSpecInference | null): Promise<{
  specs: InferredSpec[]
  autoSaved: number
  suggestions: number
  discarded: number
  cost: number
}> {
  if (!product) {
    return { specs: [], autoSaved: 0, suggestions: 0, discarded: 0, cost: 0 }
  }

  const categoryName = product.category?.name ?? 'Cameras'
  const expected = getExpectedSpecs(categoryName)
  const firstTranslation =
    product.translations.find((t) => t.locale === 'en') ?? product.translations[0]
  const existingSpecs = (firstTranslation?.specifications as Record<string, unknown>) ?? {}
  const missingKeys = expected.filter((k) => {
    const v = existingSpecs[k]
    return v == null || (typeof v === 'string' && (v as string).trim() === '')
  })

  if (missingKeys.length === 0) {
    return { specs: [], autoSaved: 0, suggestions: 0, discarded: 0, cost: 0 }
  }

  const name = firstTranslation?.name ?? product.sku ?? ''
  const desc = [
    firstTranslation?.shortDescription,
    firstTranslation?.longDescription,
    product.boxContents,
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 800)

  const prompt = `You are a cinema equipment specifications expert. Infer missing product specs for Saudi B2B rental.

Product name: ${name}
Brand: ${product.brand?.name ?? 'Unknown'}
Category: ${categoryName}
Description: ${desc}
Existing specs (partial): ${JSON.stringify(existingSpecs)}

Missing keys to infer: ${missingKeys.join(', ')}

Return a JSON array only. Each object: { "key": "spec_name", "value": "inferred value with unit if applicable", "confidence": 0-100 }
Rules: confidence 90+ only if very certain (e.g. from model name); 70-89 if likely; 50-69 if guess; below 50 use value "unknown" and confidence 0. Use standard units (kg, cm, W, fps). Output ONLY the JSON array.`

  let specs: InferredSpec[] = []
  let cost = 0

  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const openai = new OpenAI({ apiKey: openaiKey })
      const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
      })
      const text = res.choices[0]?.message?.content?.trim()
      const match = text?.replace(/```json?\s*|\s*```/g, '').match(/\[[\s\S]*\]/)
      if (match) {
        const arr = JSON.parse(match[0]) as Array<{
          key: string
          value: string
          confidence: number
        }>
        if (Array.isArray(arr)) {
          specs = arr
            .filter((s) => missingKeys.includes(s.key))
            .map((s) => ({
              key: s.key,
              value: String(s.value).trim() === '' ? 'unknown' : String(s.value),
              confidence: typeof s.confidence === 'number' ? Math.max(0, Math.min(100, s.confidence)) : 0,
              source: 'ai_inference' as const,
              autoSaved: typeof s.confidence === 'number' && s.confidence >= 90,
            }))
          cost = 0.0002
        }
      }
    } catch {
      // fall through to Gemini
    }
  }

  if (specs.length === 0) {
    const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
        const result = await model.generateContent(prompt)
        const text = result.response.text()?.trim()
        const match = text?.replace(/```json?\s*|\s*```/g, '').match(/\[[\s\S]*\]/)
        if (match) {
          const arr = JSON.parse(match[0]) as Array<{
            key: string
            value: string
            confidence: number
          }>
          if (Array.isArray(arr)) {
            specs = arr
              .filter((s) => missingKeys.includes(s.key))
              .map((s) => ({
                key: s.key,
                value: String(s.value).trim() === '' ? 'unknown' : String(s.value),
                confidence: typeof s.confidence === 'number' ? Math.max(0, Math.min(100, s.confidence)) : 0,
                source: 'ai_inference' as const,
                autoSaved: typeof s.confidence === 'number' && s.confidence >= 90,
              }))
            cost = 0.0001
          }
        }
      } catch {
        // return empty
      }
    }
  }

  let autoSaved = 0
  let suggestions = 0
  let discarded = 0
  for (const s of specs) {
    if (s.confidence >= 90) autoSaved++
    else if (s.confidence >= 70) suggestions++
    else discarded++
  }

  return { specs, autoSaved, suggestions, discarded, cost }
}
