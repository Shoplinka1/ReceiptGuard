/**
 * Lightweight i18n context for ReceiptGuard.
 *
 * No external library — just a React context + a flat translation dict.
 * Language syncs from the user's settings (via react-query) and is also
 * mirrored to localStorage so the correct language renders on first paint
 * without a flash to English.
 *
 * Usage:
 *   const { t, lang, locale } = useTranslation()
 *   t('nav_dashboard')              → "Dashboard" | "Tableau de bord" | …
 *   t('dash_in_days', { n: 3 })    → "In 3 days" | "In 3 Tagen" | …
 */
import React, { createContext, useContext, useState, useEffect } from 'react'
import { useGetUserSettings } from '@workspace/api-client-react'
import { translations, LOCALES, type Language } from './translations'

const SUPPORTED_LANGS = Object.keys(translations) as Language[]
const LS_KEY = 'rg-lang'

interface I18nContextValue {
  lang: Language
  locale: string
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  locale: 'en-US',
  t: (key) => key,
})

function readStoredLang(): Language {
  try {
    const v = localStorage.getItem(LS_KEY) as Language | null
    if (v && SUPPORTED_LANGS.includes(v)) return v
  } catch { /* ignore */ }
  return 'en'
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>(readStoredLang)
  const { data: settings } = useGetUserSettings()

  // Sync language from user settings whenever it changes
  useEffect(() => {
    const settingsLang = (settings as any)?.language as string | undefined
    if (settingsLang && SUPPORTED_LANGS.includes(settingsLang as Language) && settingsLang !== lang) {
      const next = settingsLang as Language
      setLang(next)
      try { localStorage.setItem(LS_KEY, next) } catch { /* ignore */ }
    }
  }, [(settings as any)?.language])

  const t = (key: string, vars?: Record<string, string | number>): string => {
    const dict = translations[lang] ?? translations.en
    let str = dict[key] ?? translations.en[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
      }
    }
    return str
  }

  const locale = LOCALES[lang] ?? 'en-US'

  return (
    <I18nContext.Provider value={{ lang, locale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  return useContext(I18nContext)
}
