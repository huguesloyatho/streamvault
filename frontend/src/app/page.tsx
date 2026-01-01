'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores';
import { Spinner } from '@/components/ui';

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/home');
      } else {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="loading-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="text-4xl font-bold text-primary">StreamVault</div>
        <Spinner size="lg" />
      </div>
    </div>
  );
}
