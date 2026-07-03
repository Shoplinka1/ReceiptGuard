import React, { useState } from "react"
import { useLocation } from "wouter"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ShieldCheck, Mail, Lock, CheckCircle2 } from "lucide-react"
import { useTriggerGmailScan } from "@workspace/api-client-react"
import { toast } from "sonner"

export default function ConnectGmailPage() {
  const [, setLocation] = useLocation()
  const triggerScan = useTriggerGmailScan()
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      // Mocking connection flow delay
      await new Promise(r => setTimeout(r, 1500))
      
      // Hit the API to trigger the initial scan
      await triggerScan.mutateAsync({ data: { forceRescan: true } })
      
      toast.success("Gmail connected successfully! Initial scan started.")
      setLocation("/dashboard")
    } catch (e) {
      toast.error("Failed to connect Gmail")
      setIsConnecting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary mb-6 border border-border">
            <Mail className="w-8 h-8 text-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">Connect your inbox</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            To automatically organize your receipts and track subscriptions, ReceiptGuard needs read-only access to your Gmail.
          </p>
        </div>

        <div className="grid gap-4 mb-10">
          <Card className="bg-card/50 border-border">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Strictly Read-Only</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We cannot send, delete, or modify any emails. Our systems only extract data from emails matching known receipt formats.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Bank-level Encryption</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Your credentials are never stored. We use secure OAuth tokens and encrypt all extracted financial data at rest.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Zero Personal Email Scanning</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Our algorithm explicitly ignores emails from personal contacts. We only process emails from recognized merchants and payment processors.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            variant="outline" 
            size="lg" 
            className="rounded-full px-8 h-12"
            onClick={() => setLocation("/dashboard")}
            disabled={isConnecting}
          >
            Skip for now
          </Button>
          <Button 
            size="lg" 
            className="rounded-full px-8 h-12 font-semibold"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Connect Gmail"}
          </Button>
        </div>
      </div>
    </div>
  )
}