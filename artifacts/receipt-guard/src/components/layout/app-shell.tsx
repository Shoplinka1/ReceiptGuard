import React, { useEffect } from "react"
import { Link, useLocation } from "wouter"
import { toast } from "sonner"
import { 
  LayoutDashboard, 
  ShoppingBag,
  Repeat, 
  ShieldCheck, 
  Settings,
  RotateCcw,
  FileText,
  BarChart2,
  FolderInput,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { useGetUserProfile } from "@workspace/api-client-react"
import { NotificationBell } from "./notification-bell"
import { useTranslation } from "@/lib/i18n"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation()
  const { user, signOut } = useAuth()
  const { data: profile, isError: profileError, error: profileFetchError } = useGetUserProfile({
    query: { queryKey: ['/api/user/profile'], enabled: !!user, retry: 1, staleTime: 0 },
  })
  const isAdmin = profile?.isAdmin ?? false
  const { t } = useTranslation()

  // Diagnostic logging — visible in browser DevTools Console
  useEffect(() => {
    console.group('[ReceiptGuard] AppShell profile')
    console.log('user id  :', user?.id ?? '(none)')
    console.log('profile  :', profile)
    console.log('isAdmin  :', isAdmin)
    console.log('error    :', profileError, profileFetchError ?? '')
    console.groupEnd()
  }, [profile, isAdmin, profileError, profileFetchError, user?.id])

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (err: any) {
      toast.error(err?.message ?? "Sign out failed")
    } finally {
      setLocation("/login")
    }
  }

  // 2.0 nav — "Receipts" table is now surfaced as "Purchases"
  const navItems = [
    { name: t('nav_dashboard'),     href: "/dashboard",     icon: LayoutDashboard },
    { name: t('nav_purchases'),     href: "/purchases",     icon: ShoppingBag },
    { name: t('nav_subscriptions'), href: "/subscriptions", icon: Repeat },
    { name: t('nav_warranties'),    href: "/warranties",    icon: ShieldCheck },
    { name: t('nav_returns'),       href: "/returns",       icon: RotateCcw },
    { name: t('nav_documents'),     href: "/documents",     icon: FileText },
    { name: t('nav_insights'),      href: "/insights",      icon: BarChart2 },
  ]

  const bottomItems = [
    { name: t('nav_settings'),  href: "/settings",  icon: Settings },
    { name: t('nav_import'),    href: "/import",    icon: FolderInput },
  ]

  // Mobile bottom nav: 5 items max — Dashboard, Purchases, Subscriptions, Warranties, Settings
  const mobileNavItems = [navItems[0], navItems[1], navItems[2], navItems[3], bottomItems[0]]

  return (
    <div className="flex h-dvh w-full bg-background overflow-hidden text-foreground">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-sidebar h-full">
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-lg shadow-primary/20">
              R
            </div>
            <span className="font-bold text-lg tracking-tight">ReceiptGuard</span>
          </Link>
        </div>
        
        <div className="px-4 py-2 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">{t('nav_overview')}</p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href
              return (
                <Link key={item.name} href={item.href}>
                  <div className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all cursor-pointer",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}>
                    <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "opacity-70")} />
                    {item.name}
                  </div>
                </Link>
              )
            })}
          </nav>
        </div>
        
        <div className="px-4 py-6 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">{t('nav_account')}</p>
          <nav className="space-y-1">
            <NotificationBell />
            {bottomItems.map((item) => {
              const isActive = location === item.href
              return (
                <Link key={item.name} href={item.href}>
                  <div className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all cursor-pointer",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}>
                    <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "opacity-70")} />
                    {item.name}
                  </div>
                </Link>
              )
            })}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all cursor-pointer mt-4"
            >
              <LogOut className="w-4 h-4 opacity-70" />
              {t('nav_sign_out')}
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none transform translate-x-1/2 -translate-y-1/2"></div>
        {/* pb-24 on mobile clears the fixed bottom nav so the last bit of
            scrollable content is never hidden underneath it. */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-24 md:p-8 md:pb-8">
          {children}
        </div>
      </main>
      
      {/* Mobile Bottom Nav — Dashboard, Purchases, Subscriptions, Warranties, Settings.
          Five items is the practical max before labels become unreadable. */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background z-50 flex items-center justify-between px-4 py-2 safe-area-bottom">
        {mobileNavItems.map((item) => {
          const isActive = location === item.href
          return (
            <Link key={item.name} href={item.href}>
              <div className={cn(
                "flex flex-col items-center gap-1 cursor-pointer px-2 py-1 rounded-md transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "opacity-60")} />
                <span className="text-[9px] font-medium leading-none">{item.name}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
