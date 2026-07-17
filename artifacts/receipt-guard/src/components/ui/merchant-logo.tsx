/**
 * MerchantLogo
 *
 * Displays a merchant/brand logo fetched from Clearbit's free logo API.
 * Falls back to a colored initials avatar when:
 *   - the merchant domain is not in the known-domains map
 *   - the Clearbit image fails to load (network error, unknown domain, etc.)
 *
 * The avatar color is deterministic (hash of name) so the same merchant
 * always gets the same color across renders and sessions.
 *
 * Never shows a "?" — always shows either a real logo or the initials avatar.
 */
import React, { useState } from 'react'
import { cn } from '@/lib/utils'

// Map of canonical merchant names (as returned by normalizeMerchantName) → domain
// used to construct the Clearbit logo URL.
const MERCHANT_DOMAINS: Record<string, string> = {
  'Amazon': 'amazon.com',
  'Amazon UK': 'amazon.co.uk',
  'Amazon CA': 'amazon.ca',
  'Apple': 'apple.com',
  'Google': 'google.com',
  'Google Play': 'play.google.com',
  'Google One': 'one.google.com',
  'Google Workspace': 'workspace.google.com',
  'Microsoft': 'microsoft.com',
  'Microsoft Office': 'microsoft.com',
  'Netflix': 'netflix.com',
  'Spotify': 'spotify.com',
  'Hulu': 'hulu.com',
  'Disney+': 'disneyplus.com',
  'Max': 'max.com',
  'Paramount+': 'paramountplus.com',
  'Peacock': 'peacocktv.com',
  'YouTube': 'youtube.com',
  'Prime Video': 'primevideo.com',
  'Audible': 'audible.com',
  'Uber': 'uber.com',
  'Lyft': 'lyft.com',
  'PayPal': 'paypal.com',
  'Adobe': 'adobe.com',
  'Dropbox': 'dropbox.com',
  'GitHub': 'github.com',
  'GitLab': 'gitlab.com',
  'Shopify': 'shopify.com',
  'Stripe': 'stripe.com',
  'Notion': 'notion.so',
  'Slack': 'slack.com',
  'Zoom': 'zoom.us',
  'Discord': 'discord.com',
  'Canva': 'canva.com',
  'Figma': 'figma.com',
  'Atlassian': 'atlassian.com',
  'OpenAI': 'openai.com',
  'ChatGPT': 'openai.com',
  'Anthropic': 'anthropic.com',
  'LinkedIn': 'linkedin.com',
  'X': 'x.com',
  'Bolt': 'bolt.eu',
  'Temu': 'temu.com',
  'AliExpress': 'aliexpress.com',
  'eBay': 'ebay.com',
  'Walmart': 'walmart.com',
  'Best Buy': 'bestbuy.com',
  'Airbnb': 'airbnb.com',
  'Booking.com': 'booking.com',
  'Expedia': 'expedia.com',
  'Hotels.com': 'hotels.com',
  'DoorDash': 'doordash.com',
  'Grubhub': 'grubhub.com',
  'Instacart': 'instacart.com',
  'Epic Games': 'epicgames.com',
  'PlayStation': 'playstation.com',
  'Xbox': 'xbox.com',
  'Steam': 'steampowered.com',
  'DigitalOcean': 'digitalocean.com',
  'Cloudflare': 'cloudflare.com',
  'HubSpot': 'hubspot.com',
  'Salesforce': 'salesforce.com',
  'Datadog': 'datadoghq.com',
  'Twilio': 'twilio.com',
  'Mailchimp': 'mailchimp.com',
  'Namecheap': 'namecheap.com',
  'GoDaddy': 'godaddy.com',
  'Squarespace': 'squarespace.com',
  'Linode': 'linode.com',
  'Costco': 'costco.com',
  'Target': 'target.com',
  'Etsy': 'etsy.com',
  'Box': 'box.com',
  'Sketch': 'sketch.com',
  'Fastly': 'fastly.com',
  'SendGrid': 'sendgrid.com',
  'Creative Fabrica': 'creativefabrica.com',
  'iCloud': 'icloud.com',
  'Amazon Prime': 'amazon.com',
  'Uber One': 'uber.com',
}

/** Deterministic two-letter initials from a merchant name. */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.replace(/[^A-Za-z0-9]/g, '').substring(0, 2).toUpperCase() || 'US'
}

/** Deterministic background color based on a hash of the name. */
const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
]

function colorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const SIZE_CLASSES = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
}
const IMG_PX = { xs: 28, sm: 32, md: 48, lg: 64 }

export interface MerchantLogoProps {
  /** Canonical merchant name (as stored in DB / returned by normalizeMerchantName) */
  name: string | null | undefined
  size?: keyof typeof SIZE_CLASSES
  className?: string
  /** Extra class applied to the avatar (not the img wrapper) */
  avatarClassName?: string
}

export function MerchantLogo({ name, size = 'md', className, avatarClassName }: MerchantLogoProps) {
  const [imgFailed, setImgFailed] = useState(false)

  const displayName = name && name.trim() ? name.trim() : 'Unknown Subscription'
  const domain = name ? MERCHANT_DOMAINS[name] ?? null : null
  const initials = getInitials(displayName)
  const color = colorForName(displayName)
  const px = IMG_PX[size]

  const baseClasses = cn('rounded-xl flex items-center justify-center shrink-0 overflow-hidden', SIZE_CLASSES[size])

  if (domain && !imgFailed) {
    return (
      <div className={cn(baseClasses, 'bg-white border border-border/40', className)}>
        <img
          src={`https://logo.clearbit.com/${domain}?size=${px * 2}`}
          alt={displayName}
          width={px}
          height={px}
          className="w-full h-full object-contain p-1"
          onError={() => setImgFailed(true)}
        />
      </div>
    )
  }

  return (
    <div className={cn(baseClasses, color, 'font-bold', className, avatarClassName)}>
      {initials}
    </div>
  )
}
