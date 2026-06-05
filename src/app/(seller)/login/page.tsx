import { redirect } from 'next/navigation';
import { auth, signIn } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingBag, Globe } from 'lucide-react';

interface LoginPageProps {
  searchParams: Promise<{
    callbackUrl?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl || '/dashboard';

  // If already authenticated, redirect immediately
  if (session && session.user) {
    redirect(callbackUrl);
  }

  return (
    <div className="flex-1 flex items-center justify-center py-20 px-4 relative">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <Card className="glass w-full max-w-md border-border shadow-2xl relative z-10">
        <CardHeader className="text-center">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-md flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="h-6 w-6 text-black" />
          </div>
          <CardTitle className="text-2xl font-extrabold text-foreground">Log in to Seyon</CardTitle>
          <CardDescription>
            Access your seller dashboard or review products.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Credentials Email Sign-In */}
          <form
            action={async (formData) => {
              'use server';
              const email = formData.get('email') as string;
              if (email) {
                await signIn('credentials', { email, redirectTo: callbackUrl });
              }
            }}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Email Address</label>
              <Input
                required
                type="email"
                name="email"
                placeholder="e.g. you@example.com"
                className="h-11"
              />
            </div>
            <Button type="submit" className="h-11 font-semibold">
              Continue with Email
            </Button>
          </form>

          <div className="relative flex py-2 items-center text-xs">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink mx-4 text-muted-foreground uppercase font-bold">Or</span>
            <div className="flex-grow border-t border-border"></div>
          </div>

          {/* Google Sign-in */}
          <form
            action={async () => {
              'use server';
              await signIn('google', { redirectTo: callbackUrl });
            }}
          >
            <Button variant="outline" type="submit" className="w-full h-11 font-semibold gap-2">
              <Globe className="h-4 w-4" /> Sign in with Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
