'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Shield, Copy, Check, ArrowRight } from 'lucide-react';
import { Button, Card, toast } from '@/components/ui';
import { useAuthStore } from '@/stores';
import { totpHelpers } from '@/lib/pocketbase/client';

export default function Setup2FAPage() {
  const router = useRouter();
  const [step, setStep] = useState<'setup' | 'verify'>('setup');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    // Generate TOTP secret and QR code
    const setupTOTP = async () => {
      try {
        const result = await totpHelpers.setup();
        setQrCode(result.qrCode);
        setSecret(result.secret);
      } catch (error) {
        toast.error('Failed to setup 2FA. Please try again.');
        router.push('/home');
      }
    };

    setupTOTP();
  }, [isAuthenticated, router]);

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setIsCopied(true);
      toast.success('Secret copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Failed to copy secret');
    }
  };

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      const pastedCode = value.slice(0, 6).split('');
      const newCode = [...code];
      pastedCode.forEach((char, i) => {
        if (index + i < 6) {
          newCode[index + i] = char;
        }
      });
      setCode(newCode);
      const nextIndex = Math.min(index + pastedCode.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');

    if (fullCode.length !== 6) {
      toast.error('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    try {
      await totpHelpers.verify(fullCode);
      toast.success('Two-factor authentication enabled successfully!');
      router.push('/home');
    } catch (error) {
      toast.error((error as Error).message || 'Invalid verification code');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.push('/home');
  };

  return (
    <Card variant="elevated" padding="lg" className="auth-card max-w-lg">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary">
          {step === 'setup' ? 'Secure Your Account' : 'Verify Setup'}
        </h1>
        <p className="text-text-secondary mt-2">
          {step === 'setup'
            ? 'Add an extra layer of security with two-factor authentication'
            : 'Enter the code from your authenticator app to confirm setup'}
        </p>
      </div>

      {step === 'setup' ? (
        <div className="space-y-6">
          {/* QR Code */}
          <div className="flex flex-col items-center">
            <div className="bg-white p-4 rounded-lg mb-4">
              {qrCode ? (
                <Image
                  src={qrCode}
                  alt="QR Code for 2FA setup"
                  width={200}
                  height={200}
                  className="rounded"
                />
              ) : (
                <div className="w-[200px] h-[200px] bg-surface animate-pulse rounded" />
              )}
            </div>
            <p className="text-sm text-text-secondary text-center mb-4">
              Scan this QR code with your authenticator app
              <br />
              (Google Authenticator, Authy, etc.)
            </p>
          </div>

          {/* Manual entry */}
          <div className="bg-surface rounded-lg p-4">
            <p className="text-xs text-text-muted mb-2 uppercase tracking-wide">
              Or enter this code manually:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-text-primary bg-background-primary px-3 py-2 rounded break-all">
                {secret || 'Loading...'}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={copySecret}
                disabled={!secret}
              >
                {isCopied ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={handleSkip}>
              Skip for now
            </Button>
            <Button
              fullWidth
              onClick={() => setStep('verify')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex justify-center gap-2">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-2xl font-bold bg-surface border border-border rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                           transition-all duration-200"
                autoFocus={index === 0}
              />
            ))}
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setStep('setup')}
            >
              Back
            </Button>
            <Button type="submit" fullWidth isLoading={isLoading}>
              Enable 2FA
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
