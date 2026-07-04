import React from "react"
import { Link, useLocation } from "wouter"
import { 
  LayoutDashboard, 
  Receipt, 
  Repeat, 
  CalendarDays, 
  ShieldCheck, 
  Settings,
  Bell,
  LogOut,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()
  const { signOut } = useAuth()
  
  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Search", href: "/search", icon: Search },
    { name: "Receipts", href: "/receipts", icon: Receipt },
    { name: "Subscriptions", href: "/subscriptions", icon: Repeat },
    { name: "Renewals", href: "/renewals", icon: CalendarDays },
    { name: "Warranties", href: "/warranties", icon: ShieldCheck },
  ]
  
  const bottomItems = [
    { name: "Reminders", href: "/reminders", icon: Bell },
    { name: "Settings", href: "/settings", icon: Settings },
  ]

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground">
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
        
        <div className="px-4 py-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">Overview</p>
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
        
        <div className="mt-auto px-4 py-6 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">Account</p>
          <nav className="space-y-1">
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
              onClick={() => signOut()}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all cursor-pointer mt-4"
            >
              <LogOut className="w-4 h-4 opacity-70" />
              Sign Out
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
      
      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background z-50 flex items-center justify-between px-6 py-3 safe-area-bottom">
        {[navItems[0], navItems[1], navItems[2], bottomItems[1]].map((item) => {
          const isActive = location === item.href
          return (
            <Link key={item.name} href={item.href}>
              <div className={cn(
                "flex flex-col items-center gap-1 cursor-pointer",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "opacity-70")} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}