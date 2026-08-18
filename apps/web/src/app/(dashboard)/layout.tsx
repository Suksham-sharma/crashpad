'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { TopNav } from '@/components/TopNav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session) router.replace('/');
  }, [isPending, session, router]);

  if (isPending || !session) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span className="font-mono text-3xs uppercase tracking-widest text-fg-2">
          {isPending ? 'Loading session...' : 'Redirecting...'}
        </span>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <TopNav />
      {children}
    </div>
  );
}
