import React, { useState, useMemo } from "react"
import { Link } from "wouter"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Calendar, CreditCard, Repeat, Mail, AlertCircle, Globe, Tag } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useListSubscriptions, useGetUserSettings } from "@workspace/api-client-react"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/currency"
import { MerchantLogo } from "@/components/ui/merchant-logo"
import { useTranslation } from "@/lib/i18n"

// Known merchant → canonical website URL (for the "Website" field on the card)
const MERCHANT_WEBSITES: Record<string, string> = {
  'Amazon': 'amazon.com', 'Apple': 'apple.com', 'Google': 'google.com',
  'Microsoft': 'microsoft.com', 'Netflix': 'netflix.com', 'Spotify': 'spotify.com',
  'Hulu': 'hulu.com', 'Disney+': 'disneyplus.com', 'Max': 'max.com',
  'Paramount+': 'paramountplus.com', 'Peacock': 'peacocktv.com', 'YouTube': 'youtube.com',
  'Prime Video': 'primevideo.com', 'Audible': 'audible.com', 'Uber': 'uber.com',
  'PayPal': 'paypal.com', 'Adobe': 'adobe.com', 'Dropbox': 'dropbox.com',
  'GitHub': 'github.com', 'GitLab': 'gitlab.com', 'Shopify': 'shopify.com',
  'Notion': 'notion.so', 'Slack': 'slack.com', 'Zoom': 'zoom.us',
  'Discord': 'discord.com', 'Canva': 'canva.com', 'Figma': 'figma.com',
  'Atlassian': 'atlassian.com', 'OpenAI': 'openai.com', 'ChatGPT': 'openai.com',
  'LinkedIn': 'linkedin.com', 'X': 'x.com', 'Bolt': 'bolt.eu',
  'Temu': 'temu.com', 'AliExpress': 'aliexpress.com', 'eBay': 'ebay.com',
  'Walmart': 'walmart.com', 'Best Buy': 'bestbuy.com', 'Airbnb': 'airbnb.com',
  'Booking.com': 'booking.com', 'DoorDash': 'doordash.com', 'Grubhub': 'grubhub.com',
  'Instacart': 'instacart.com', 'Epic Games': 'epicgames.com',
  'PlayStation': 'playstation.com', 'Xbox': 'xbox.com', 'Steam': 'steampowered.com',
  'DigitalOcean': 'digitalocean.com', 'Cloudflare': 'cloudflare.com',
  'Creative Fabrica': 'creativefabrica.com', 'Google One': 'one.google.com',
  'Google Workspace': 'workspace.google.com', 'iCloud': 'icloud.com',
  'Uber One': 'uber.com', 'Walmart+': 'walmart.com',
}

function resolveWebsite(sub: any): string | null {
  if (sub.website) return sub.website
  if (sub.companyName && MERCHANT_WEBSITES[sub.companyName]) return MERCHANT_WEBSITES[sub.companyName]
  return null
}

export default function SubscriptionsPage() {
  const [search, setSearch] = useState("")
  const { data: subs, isLoading, error } = useListSubscriptions()
  const { data: userSettings } = useGetUserSettings()
  const { t, locale } = useTranslation()
  const currency = userSettings?.currency || 'USD'

  const filtered = useMemo(() => {
    if (!subs) return []
    if (!search.trim()) return subs
    const q = search.toLowerCase()
    return subs.filter(s => (s.companyName ?? '').toLowerCase().includes(q))
  }, [subs, search])

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('subs_title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subs_subtitle')}</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('subs_search')}
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {error ? (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <AlertCircle className="w-10 h-10 opacity-30 text-destructive" />
            <p className="text-sm font-medium text-destructive">Failed to load subscriptions</p>
            <p className="text-xs">Check your connection and refresh the page.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              [1,2,3,4,5,6].map(i => (
                <Card key={i} className="border-border/50">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex justify-between">
                      <Skeleton className="w-12 h-12 rounded-xl" />
                      <Skeleton className="w-16 h-6 rounded-full" />
                    </div>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))
            ) : filtered.length === 0 && search.trim() ? (
              <div className="col-span-full py-16 flex flex-col items-center gap-3 text-muted-foreground">
                <Search className="w-10 h-10 opacity-20" />
                <p className="text-sm font-semibold text-foreground">
                  {t('subs_no_results', { q: search })}
                </p>
                <p className="text-xs">{t('subs_no_results_hint')}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="col-span-full py-16 flex flex-col items-center gap-4 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                  <Repeat className="w-8 h-8 opacity-30" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">{t('subs_empty_title')}</p>
                  <p className="text-xs mt-1 max-w-xs mx-auto">{t('subs_empty_hint')}</p>
                </div>
                <Link href="/connect-gmail">
                  <Button size="sm">
                    <Mail className="w-4 h-4 mr-2" />
                    {t('subs_connect')}
                  </Button>
                </Link>
              </div>
            ) : (
              filtered.map((sub) => {
                const displayName = sub.companyName || t('subs_unknown')
                const website = resolveWebsite(sub)
                const isYearly = sub.billingCycle === 'yearly'
                const price = isYearly
                  ? (sub.yearlyPrice ?? (sub.monthlyPrice ?? 0) * 12)
                  : (sub.monthlyPrice ?? 0)

                return (
                  <Card key={sub.id} className="border-border/50 hover:border-primary/30 transition-colors group">
                    <CardContent className="p-6">
                      {/* Header row: logo + status badge */}
                      <div className="flex justify-between items-start mb-4">
                        <MerchantLogo
                          name={sub.companyName}
                          size="md"
                          className="group-hover:ring-2 group-hover:ring-primary/20 transition-all"
                        />
                        <Badge variant={sub.status === 'active' ? 'success' : 'secondary'} className="capitalize">
                          {sub.status}
                        </Badge>
                      </div>

                      {/* Merchant name */}
                      <h3 className="font-bold text-lg leading-tight">{displayName}</h3>

                      {/* Price */}
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-bold">
                          {formatCurrency(price, currency, locale)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {isYearly ? t('subs_per_yr') : t('subs_per_mo')}
                        </span>
                      </div>

                      {/* Detail rows */}
                      <div className="mt-6 pt-4 border-t border-border space-y-2 text-sm text-muted-foreground">
                        {/* Next bill date */}
                        {sub.renewalDate && (
                          <div className="flex justify-between items-center">
                            <span className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 shrink-0" />
                              {t('subs_next_bill')}
                            </span>
                            <span className="font-medium text-foreground">
                              {format(new Date(sub.renewalDate), "MMM dd, yyyy")}
                            </span>
                          </div>
                        )}

                        {/* Billing cycle */}
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 shrink-0" />
                            {t('subs_billing')}
                          </span>
                          <span className="capitalize">
                            {isYearly ? t('common_yearly') || 'yearly' : t('common_monthly') || 'monthly'}
                          </span>
                        </div>

                        {/* Category — only if present */}
                        {sub.category && (
                          <div className="flex justify-between items-center">
                            <span className="flex items-center gap-2">
                              <Tag className="w-4 h-4 shrink-0" />
                              {t('subs_category')}
                            </span>
                            <span className="capitalize">{sub.category}</span>
                          </div>
                        )}

                        {/* Website — only if resolvable */}
                        {website && (
                          <div className="flex justify-between items-center">
                            <span className="flex items-center gap-2">
                              <Globe className="w-4 h-4 shrink-0" />
                              {t('subs_website')}
                            </span>
                            <a
                              href={`https://${website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-primary hover:underline truncate max-w-[120px]"
                            >
                              {website}
                            </a>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {filtered.length} subscription{filtered.length !== 1 ? 's' : ''}
            {search.trim() ? ` matching "${search}"` : ''}
          </p>
        )}
      </div>
    </AppShell>
  )
}
