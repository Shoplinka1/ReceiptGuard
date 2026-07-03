import React from "react"
import { useLocation } from "wouter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { SiGoogle } from "react-icons/si"
import { toast } from "sonner"

export default function LoginPage() {
  const [, setLocation] = useLocation()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success("Successfully logged in!")
    setLocation("/dashboard")
  }

  const handleGoogleLogin = () => {
    toast.success("Successfully logged in with Google!")
    setLocation("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
      
      <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-3 pb-6">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl mb-2 shadow-lg shadow-primary/20">
            R
          </div>
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription className="text-base">
            Sign in to your ReceiptGuard account to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button variant="outline" className="w-full h-12 rounded-lg font-medium border-border hover:bg-secondary" onClick={handleGoogleLogin}>
              <SiGoogle className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground font-medium">Or continue with</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email address</label>
                <Input type="email" required placeholder="name@example.com" className="h-11 rounded-lg bg-background" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  <a href="#" className="text-xs text-primary hover:underline">Forgot password?</a>
                </div>
                <Input type="password" required className="h-11 rounded-lg bg-background" />
              </div>
              <Button type="submit" className="w-full h-11 rounded-lg font-medium mt-6">
                Sign in
              </Button>
            </form>
          </div>
        </CardContent>
        <CardFooter className="justify-center border-t border-border/50 pt-6">
          <p className="text-sm text-muted-foreground">
            Don't have an account? <span className="text-primary cursor-pointer hover:underline font-medium" onClick={() => setLocation("/signup")}>Sign up</span>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}