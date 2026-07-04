import React, { useState } from 'react'
import { useLocation, Link } from 'wouter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { SiGoogle } from 'react-icons/si'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'

export default function SignupPage() {
  const [, setLocation] = useLocation()
  const { signInWithGoogle, signUpWithEmail, user, loading } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Redirect if already logged in
  React.useEffect(() => {
    if (!loading && user) setLocation('/dashboard')
  }, [user, loading, setLocation])

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { toast.error('Password must be at least 8 characters.'); return }
    setSubmitting(true)
    try {
      await signUpWithEmail(email, password, fullName)
      toast.success('Account created! Check your email to verify your address.')
      setLocation('/login')
    } catch (err: any) {
      toast.error(err?.message ?? 'Sign up failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleSignup = async () => {
    try {
      await signInWithGoogle()
    } catch (err: any) {
      toast.error(err?.message ?? 'Google sign up failed.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-3 pb-6">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl mb-2 shadow-lg shadow-primary/20">
            R
          </div>
          <CardTitle className="text-2xl font-bold">Create your account</CardTitle>
          <CardDescription className="text-base">Start organizing your financial life in minutes.</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full h-12 rounded-lg font-medium border-border hover:bg-secondary"
              onClick={handleGoogleSignup}
              disabled={submitting}
            >
              <SiGoogle className="mr-2 h-4 w-4" />
              Sign up with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground font-medium">Or continue with</span>
              </div>
            </div>

            <form onSubmit={handleEmailSignup} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Full Name</label>
                <Input
                  type="text"
                  required
                  placeholder="Jane Smith"
                  className="h-11 rounded-lg bg-background"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email address</label>
                <Input
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="h-11 rounded-lg bg-background"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="h-11 rounded-lg bg-background"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <Button type="submit" className="w-full h-11 rounded-lg font-medium mt-6" disabled={submitting}>
                {submitting ? 'Creating account…' : 'Create account'}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground text-center">
              By creating an account, you agree to our{' '}
              <Link href="/terms" className="underline hover:text-foreground">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
            </p>
          </div>
        </CardContent>

        <CardFooter className="justify-center border-t border-border/50 pt-6">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
