import React, { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useGetReminderSettings, useUpdateReminderSettings } from "@workspace/api-client-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Bell, Mail, MonitorSmartphone, Clock } from "lucide-react"

export default function RemindersPage() {
  const { data: settings, isLoading } = useGetReminderSettings()
  const updateSettings = useUpdateReminderSettings()

  const [localSettings, setLocalSettings] = useState<any>(null)

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings)
    }
  }, [settings])

  const handleToggle = (key: string, checked: boolean) => {
    setLocalSettings((prev: any) => ({ ...prev, [key]: checked }))
    updateSettings.mutate({ data: { [key]: checked } })
  }

  if (isLoading || !localSettings) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notification Settings</h1>
          <p className="text-sm text-muted-foreground">Configure how and when ReceiptGuard alerts you.</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" /> Delivery Methods
              </CardTitle>
              <CardDescription>Where should we send your notifications?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary rounded-lg text-foreground"><Mail className="w-4 h-4" /></div>
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive daily summaries and critical alerts via email.</p>
                  </div>
                </div>
                <Switch 
                  checked={localSettings.emailNotifications} 
                  onCheckedChange={(c) => handleToggle('emailNotifications', c)} 
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary rounded-lg text-foreground"><MonitorSmartphone className="w-4 h-4" /></div>
                  <div>
                    <p className="font-medium">Push Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive browser and mobile push alerts.</p>
                  </div>
                </div>
                <Switch 
                  checked={localSettings.browserNotifications} 
                  onCheckedChange={(c) => handleToggle('browserNotifications', c)} 
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" /> Alert Timing
              </CardTitle>
              <CardDescription>How far in advance should we warn you about upcoming events?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { key: 'daysBefore30', label: '30 Days Before', desc: 'Good for yearly subscriptions' },
                { key: 'daysBefore14', label: '14 Days Before', desc: 'Standard warning for major renewals' },
                { key: 'daysBefore7', label: '7 Days Before', desc: 'A week notice to cancel if needed' },
                { key: 'daysBefore3', label: '3 Days Before', desc: 'Last chance warning' },
                { key: 'daysBefore1', label: '1 Day Before', desc: 'Urgent reminder' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch 
                    checked={localSettings[item.key]} 
                    onCheckedChange={(c) => handleToggle(item.key, c)} 
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event Types</CardTitle>
              <CardDescription>Which events do you want to be notified about?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Subscription Renewals</p>
                </div>
                <Switch 
                  checked={localSettings.renewalReminder} 
                  onCheckedChange={(c) => handleToggle('renewalReminder', c)} 
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Warranty Expirations</p>
                </div>
                <Switch 
                  checked={localSettings.warrantyReminder} 
                  onCheckedChange={(c) => handleToggle('warrantyReminder', c)} 
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Return Windows</p>
                </div>
                <Switch 
                  checked={localSettings.returnWindowReminder} 
                  onCheckedChange={(c) => handleToggle('returnWindowReminder', c)} 
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}