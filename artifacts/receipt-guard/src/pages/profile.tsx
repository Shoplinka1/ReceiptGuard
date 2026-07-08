import React from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { useGetUserProfile, useGetUserSettings } from "@workspace/api-client-react"
import { User, Mail, CreditCard, HardDrive, Shield, AlertTriangle } from "lucide-react"
import { useLocation } from "wouter"

export default function ProfilePage() {
  const { data: profile } = useGetUserProfile()
  const { data: settings } = useGetUserSettings()
  const [, setLocation] = useLocation()

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Profile & Settings</h1>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-24 h-24 rounded-full bg-secondary mx-auto mb-4 border-4 border-background flex items-center justify-center text-3xl font-bold">
                  {profile?.name?.substring(0,1) || 'U'}
                </div>
                <h2 className="text-xl font-bold">{profile?.name || 'User'}</h2>
                <p className="text-sm text-muted-foreground mb-4">{profile?.email}</p>
                <Badge variant={profile?.plan === 'pro' ? 'default' : 'secondary'} className="uppercase">
                  {profile?.plan || 'free'} Plan
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <HardDrive className="w-4 h-4" /> Storage Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-primary" style={{ width: `${(profile?.storageUsed || 0) / 100}%` }}></div>
                </div>
                <p className="text-xs text-muted-foreground">{profile?.storageUsed || 0}MB of 100MB (Free Limit)</p>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Connected Accounts</CardTitle>
                <CardDescription>Manage integrations that provide data to ReceiptGuard.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-xl bg-card">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-secondary rounded text-foreground">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Google Workspace</p>
                      <p className="text-xs text-muted-foreground">
                        {profile?.gmailConnected ? profile.gmailEmail : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  {profile?.gmailConnected ? (
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 border-transparent">Disconnect</Button>
                  ) : (
                    <Button size="sm">Connect</Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Dark Mode</p>
                    <p className="text-xs text-muted-foreground">Use dark theme across the application</p>
                  </div>
                  <Switch checked={settings?.theme === 'dark'} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Email Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive alerts for renewals and warranties</p>
                  </div>
                  <Switch checked={settings?.emailNotifications} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                {/* Redirect to Settings → Security tab which has the full delete-account confirmation dialog */}
                <Button variant="destructive" onClick={() => setLocation('/settings?tab=security')}>
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  )
}