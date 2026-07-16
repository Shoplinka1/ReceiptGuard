import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { signInWithEmail, user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (!loading && user) setLocation('/');
  }, [user, loading, setLocation]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
      setLocation('/');
    } catch (err: any) {
      toast.error(err?.message ?? 'Sign in failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[120px] -z-10 pointer-events-none" />

      <Card className="w-full max-w-sm border-border/60 bg-card/90 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-3 pb-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground mx-auto shadow-lg shadow-primary/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">ReceiptGuard Admin</CardTitle>
            <CardDescription className="text-sm mt-1">Restricted access — authorised personnel only.</CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email address</label>
              <Input
                type="email"
                required
                placeholder="admin@example.com"
                className="h-10 rounded-lg bg-background"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={submitting}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <Input
                type="password"
                required
                className="h-10 rounded-lg bg-background"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={submitting}
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-10 rounded-lg font-medium mt-2"
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
