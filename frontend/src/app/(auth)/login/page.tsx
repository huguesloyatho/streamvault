'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Tv } from 'lucide-react';
import { Button, Input, Card, toast } from '@/components/ui';
import { useAuthStore } from '@/stores';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const fullyAuthenticated = await login(data.email, data.password);
      if (fullyAuthenticated) {
        toast.success('Welcome back!');
        router.push('/home');
      } else {
        // 2FA required, redirect to verification
        router.push('/verify-2fa');
      }
    } catch (error) {
      toast.error((error as Error).message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card variant="elevated" padding="lg" className="auth-card">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Tv className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Welcome Back</h1>
        <p className="text-text-secondary mt-2">Sign in to StreamVault</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="your@email.com"
          leftIcon={<Mail className="w-5 h-5" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          leftIcon={<Lock className="w-5 h-5" />}
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-text-secondary hover:text-primary transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          fullWidth
          size="lg"
          isLoading={isLoading}
        >
          Sign In
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-text-secondary">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="text-primary hover:underline font-medium"
          >
            Sign up
          </Link>
        </p>
      </div>
    </Card>
  );
}
