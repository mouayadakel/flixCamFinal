/**
 * Test component to verify language switching works correctly
 */

'use client'

import { useLocale } from '@/hooks/use-locale'
import { Button } from '@/components/ui/button'

export function LanguageSwitchTest() {
  const { locale, t } = useLocale()

  return (
    <div className="p-4 border rounded-lg bg-muted/50">
      <h3 className="text-lg font-semibold mb-2">Language Switch Test</h3>
      <div className="space-y-2">
        <p><strong>Current Locale:</strong> {locale}</p>
        <p><strong>Test Translation:</strong> {t('common.loading')}</p>
        <p><strong>Nav Equipment:</strong> {t('nav.equipment')}</p>
        <p><strong>Hero Title:</strong> {t('hero.title')}</p>
      </div>
      <div className="mt-4 text-sm text-muted-foreground">
        If you see translation keys instead of translated text, 
        the language switching needs to be fixed.
      </div>
    </div>
  )
}
