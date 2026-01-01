'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, requires2FA } = useAuthStore();

  useEffect(() => {
    if (!isLoading && isAuthenticated && !requires2FA) {
      router.replace('/home');
    }
  }, [isAuthenticated, isLoading, requires2FA, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-primary p-4">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{
          backgroundImage: `url('/images/auth-bg.jpg')`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background-primary via-background-primary/90 to-background-primary/70" />
      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
