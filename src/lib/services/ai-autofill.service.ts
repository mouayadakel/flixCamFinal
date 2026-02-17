/**
 * @file ai-autofill.service.ts
 * @description AI autofill orchestration service for product imports
 * @module lib/services
 * @see /docs/features/imports/ for related documentation
 */

import { prisma } from '@/lib/db/prisma'
import { TranslationLocale } from '@prisma/client'
import {
  translateBatch,
  getTranslationCacheKey,
  getCachedTranslation,
  setCachedTranslation,
} from './translation.service'
import { generateSEOBatch, type SEOResult } from './seo-generation.service'
import { recordCost } from '@/lib/utils/cost-tracker'

const REGION_CONTEXT =
  'Saudi Arabia B2B equipment rental market. Use formal Arabic (فصحى) when generating Arabic content.'
const PLACEHOLDER_PATTERN = /lorem|sample|test|placeholder|example text|\[.*\]/i

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function validateGeneratedText(
  text: string,
  options?: { minWords?: number; maxWords?: number; maxChars?: number }
): { valid: boolean; reason?: string } {
  if (!text || text.trim().length === 0) return { valid: false, reason: 'empty' }
  if (PLACEHOLDER_PATTERN.test(text)) return { valid: false, reason: 'placeholder_detected' }
  const words = wordCount(text)
  if (options?.minWords != null && words < options.minWords)
    return { valid: false, reason: `below_min_words_${words}` }
  if (options?.maxWords != null && words > options.maxWords)
    return { valid: false, reason: `above_max_words_${words}` }
  if (options?.maxChars != null && text.length > options.maxChars)
    return { valid: false, reason: 'above_max_chars' }
  return { valid: true }
}

export type ProductData = {
  name: string
  shortDescription?: string
  longDescription?: string
  category?: string
  brand?: string
  specifications?: Record<string, any>
  locale?: TranslationLocale
}

export type AutofillResult = {
  translations: {
    [locale in TranslationLocale]?: {
      name: string
      shortDescription: string
      longDescription: string
    }
  }
  seo: {
    metaTitle: string
    metaDescription: string
    metaKeywords: string
  }
  cost?: number
}

/**
 * Autofill missing fields for a single product
 */
export async function autofillProduct(
  productData: ProductData,
  provider?: 'openai' | 'gemini'
): Promise<AutofillResult> {
  const result: AutofillResult = {
    translations: {},
    seo: {
      metaTitle: productData.name,
      metaDescription: productData.shortDescription || productData.name,
      metaKeywords: '',
    },
  }

  let totalCost = 0

  // Generate SEO
  try {
    const seoResult = await generateSEOBatch(
      [
        {
          name: productData.name,
          description: productData.longDescription || productData.shortDescription,
          category: productData.category,
          brand: productData.brand,
          specifications: productData.specifications,
          locale: productData.locale || 'en',
        },
      ],
      provider
    )

    if (seoResult[0]) {
      result.seo = {
        metaTitle: seoResult[0].metaTitle,
        metaDescription: seoResult[0].metaDescription,
        metaKeywords: seoResult[0].metaKeywords,
      }
      if (seoResult[0].cost) {
        totalCost += seoResult[0].cost
      }
    }
  } catch (error) {
    console.error('SEO generation failed:', error)
    // Use fallback SEO
  }

  // Generate translations for all locales
  const sourceLocale: TranslationLocale = productData.locale || 'en'
  const targetLocales: TranslationLocale[] = ['en', 'ar', 'zh'].filter(
    (loc) => loc !== sourceLocale
  ) as TranslationLocale[]

  const context = `${productData.category || ''} ${productData.brand || ''}`.trim()

  for (const targetLocale of targetLocales) {
    try {
      // Check cache first
      const nameKey = getTranslationCacheKey(productData.name, sourceLocale, targetLocale)
      const cachedName = getCachedTranslation(nameKey)

      if (cachedName) {
        result.translations[targetLocale] = {
          name: cachedName,
          shortDescription: productData.shortDescription || '',
          longDescription: productData.longDescription || '',
        }
        continue
      }

      // Translate name
      const nameTranslation = await translateBatch(
        [
          {
            text: productData.name,
            sourceLocale,
            targetLocale,
            context,
          },
        ],
        provider
      )

      if (nameTranslation[0]) {
        const translatedName = nameTranslation[0].translatedText
        setCachedTranslation(nameKey, translatedName)

        // Translate descriptions if available
        let translatedShortDesc = productData.shortDescription || ''
        let translatedLongDesc = productData.longDescription || ''

        if (productData.shortDescription) {
          const shortDescKey = getTranslationCacheKey(
            productData.shortDescription,
            sourceLocale,
            targetLocale
          )
          const cachedShortDesc = getCachedTranslation(shortDescKey)

          if (cachedShortDesc) {
            translatedShortDesc = cachedShortDesc
          } else {
            const shortDescTranslation = await translateBatch(
              [
                {
                  text: productData.shortDescription,
                  sourceLocale,
                  targetLocale,
                  context,
                },
              ],
              provider
            )
            if (shortDescTranslation[0]) {
              translatedShortDesc = shortDescTranslation[0].translatedText
              setCachedTranslation(shortDescKey, translatedShortDesc)
              if (shortDescTranslation[0].cost) {
                totalCost += shortDescTranslation[0].cost
              }
            }
          }
        }

        if (productData.longDescription) {
          const longDescKey = getTranslationCacheKey(
            productData.longDescription,
            sourceLocale,
            targetLocale
          )
          const cachedLongDesc = getCachedTranslation(longDescKey)

          if (cachedLongDesc) {
            translatedLongDesc = cachedLongDesc
          } else {
            const longDescTranslation = await translateBatch(
              [
                {
                  text: productData.longDescription,
                  sourceLocale,
                  targetLocale,
                  context,
                },
              ],
              provider
            )
            if (longDescTranslation[0]) {
              translatedLongDesc = longDescTranslation[0].translatedText
              setCachedTranslation(longDescKey, translatedLongDesc)
              if (longDescTranslation[0].cost) {
                totalCost += longDescTranslation[0].cost
              }
            }
          }
        }

        result.translations[targetLocale] = {
          name: translatedName,
          shortDescription: translatedShortDesc,
          longDescription: translatedLongDesc,
        }

        if (nameTranslation[0].cost) {
          totalCost += nameTranslation[0].cost
        }
      }
    } catch (error) {
      console.error(`Translation to ${targetLocale} failed:`, error)
      // Continue with other locales
    }
  }

  result.cost = totalCost
  return result
}

/**
 * Batch autofill multiple products
 */
export async function autofillProductsBatch(
  products: ProductData[],
  provider?: 'openai' | 'gemini'
): Promise<AutofillResult[]> {
  const results: AutofillResult[] = []

  // Process in smaller batches to avoid rate limits
  const batchSize = 10
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize)

    const batchResults = await Promise.allSettled(
      batch.map((product) => autofillProduct(product, provider))
    )

    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        // Fallback: return minimal result
        const product = batch[batchResults.indexOf(result)]
        results.push({
          translations: {},
          seo: {
            metaTitle: product.name,
            metaDescription: product.shortDescription || product.name,
            metaKeywords: '',
          },
        })
      }
    })

    // Small delay between batches to avoid rate limits
    if (i + batchSize < products.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  return results
}

/**
 * Autofill only missing fields for a product.
 * Gemini-first, OpenAI fallback. Optional jobId for cost tracking.
 */
export async function autofillMissingFields(
  productId: string,
  existingData: {
    name?: string
    shortDescription?: string
    longDescription?: string
    seoTitle?: string
    seoDescription?: string
    seoKeywords?: string
    translations?: Array<{
      locale: TranslationLocale
      name?: string
      shortDescription?: string
      longDescription?: string
    }>
  },
  context: {
    category?: string
    brand?: string
    specifications?: Record<string, unknown>
  },
  provider?: 'openai' | 'gemini',
  options?: { jobId?: string }
): Promise<Partial<AutofillResult>> {
  const result: Partial<AutofillResult> = {
    translations: {},
    seo: { metaTitle: '', metaDescription: '', metaKeywords: '' },
  }
  const effectiveProvider = provider ?? 'gemini'

  const contextualDescription = [
    existingData.longDescription || existingData.shortDescription,
    `Product: ${existingData.name ?? ''}.`,
    context.category ? `Category: ${context.category}.` : '',
    context.brand ? `Brand: ${context.brand}.` : '',
    REGION_CONTEXT,
  ]
    .filter(Boolean)
    .join(' ')

  // Fill missing SEO — try Gemini first, then OpenAI; validate and retry once if invalid
  if (!existingData.seoTitle || !existingData.seoDescription) {
    try {
      let seoResult: SEOResult[] = []
      const seoPayload = [
        {
          name: existingData.name || '',
          description: contextualDescription,
          category: context.category,
          brand: context.brand,
          specifications: context.specifications as Record<string, unknown> | undefined,
        },
      ]
      try {
        seoResult = await generateSEOBatch(seoPayload, effectiveProvider === 'gemini' ? 'gemini' : 'openai')
      } catch {
        seoResult = await generateSEOBatch(seoPayload, effectiveProvider === 'gemini' ? 'openai' : 'gemini')
      }
      let metaTitle = seoResult[0]?.metaTitle ?? ''
      let metaDescription = seoResult[0]?.metaDescription ?? ''
      const metaKeywords = seoResult[0]?.metaKeywords ?? ''
      const titleValid = validateGeneratedText(metaTitle, { maxChars: 70 })
      const descValid = validateGeneratedText(metaDescription, { minWords: 20, maxWords: 30 })
      if ((!titleValid.valid || !descValid.valid) && seoResult[0]) {
        try {
          const retry = await generateSEOBatch(seoPayload, effectiveProvider === 'gemini' ? 'openai' : 'gemini')
          if (retry[0]) {
            const rTitle = validateGeneratedText(retry[0].metaTitle, { maxChars: 70 })
            const rDesc = validateGeneratedText(retry[0].metaDescription, { minWords: 20, maxWords: 30 })
            if (rTitle.valid && rDesc.valid) {
              metaTitle = retry[0].metaTitle
              metaDescription = retry[0].metaDescription
            }
          }
        } catch {
          // keep first result; caller may flag for manual review
        }
      }
      if (metaTitle || metaDescription) {
        result.seo = {
          metaTitle: existingData.seoTitle || metaTitle,
          metaDescription: existingData.seoDescription || metaDescription,
          metaKeywords: existingData.seoKeywords || metaKeywords,
        }
        if (options?.jobId && seoResult[0]?.cost != null) {
          await recordCost({
            jobId: options.jobId,
            feature: 'text_backfill',
            costUsd: seoResult[0].cost,
          })
        }
      }
    } catch (error) {
      console.error('SEO generation failed:', error)
    }
  }

  // Fill missing translations
  const sourceLocale: TranslationLocale = 'en'
  const targetLocales: TranslationLocale[] = ['ar', 'zh']

  for (const targetLocale of targetLocales) {
    const existingTranslation = existingData.translations?.find((t) => t.locale === targetLocale)

    if (!existingTranslation || !existingTranslation.name) {
      try {
        const translationContext = `${context.category ?? ''} ${context.brand ?? ''} ${REGION_CONTEXT}`.trim()
        const translatePayload = [
          {
            text: existingData.name || '',
            sourceLocale,
            targetLocale,
            context: translationContext,
          },
        ]
        let nameTranslation: Awaited<ReturnType<typeof translateBatch>>
        try {
          nameTranslation = await translateBatch(
            translatePayload,
            effectiveProvider === 'gemini' ? 'gemini' : 'openai'
          )
        } catch {
          nameTranslation = await translateBatch(
            translatePayload,
            effectiveProvider === 'gemini' ? 'openai' : 'gemini'
          )
        }
        let translatedName = nameTranslation[0]?.translatedText ?? ''
        if (translatedName && !validateGeneratedText(translatedName).valid) {
          try {
            const retry = await translateBatch(
              translatePayload,
              effectiveProvider === 'gemini' ? 'openai' : 'gemini'
            )
            if (retry[0]?.translatedText && validateGeneratedText(retry[0].translatedText).valid) {
              translatedName = retry[0].translatedText
            }
          } catch {
            // keep first result
          }
        }
        if (nameTranslation[0] && !result.translations) {
          result.translations = {}
        }
        if (translatedName) {
          result.translations![targetLocale] = {
            name: translatedName,
            shortDescription: existingTranslation?.shortDescription ?? '',
            longDescription: existingTranslation?.longDescription ?? '',
          }
          if (options?.jobId && nameTranslation[0]?.cost != null) {
            await recordCost({
              jobId: options.jobId,
              feature: 'text_backfill',
              costUsd: nameTranslation[0].cost,
            })
          }
        }
      } catch (error) {
        console.error(`Translation to ${targetLocale} failed:`, error)
      }
    }
  }

  return result
}
