'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Shield,
  Smartphone,
  Key,
  Clock,
  Monitor,
  LogOut,
  AlertTriangle,
  Check,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Card, Button, Input, Modal, toast } from '@/components/ui';
import { useAuthStore } from '@/stores';
import { pb, totpHelpers } from '@/lib/pocketbase/client';
import { cn } from '@/lib/utils';

interface Session {
  id: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export default function SecuritySettingsPage() {
  const { user, setup2FA, disable2FA, refreshAuth } = useAuthStore();

  // 2FA Setup state
  const [show2FASetupModal, setShow2FASetupModal] = useState(false);
  const [setupStep, setSetupStep] = useState<'qr' | 'verify'>('qr');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verifyCode, setVerifyCode] = useState('');
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // 2FA Disable state
  const [show2FADisableModal, setShow2FADisableModal] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [isDisabling2FA, setIsDisabling2FA] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isRevokingSession, setIsRevokingSession] = useState<string | null>(null);

  // Security log state
  const [securityLogs, setSecurityLogs] = useState<Array<{
    id: string;
    action: string;
    device: string;
    ip: string;
    timestamp: string;
    status: 'success' | 'failed';
  }>>([]);

  // Load sessions (mock data for now)
  useEffect(() => {
    loadSessions();
    loadSecurityLogs();
  }, []);

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      // In a real app, this would fetch from an API
      // For now, we'll show mock data
      setSessions([
        {
          id: '1',
          device: 'MacBook Pro',
          browser: 'Chrome 120',
          ip: '192.168.1.100',
          location: 'Paris, France',
          lastActive: new Date().toISOString(),
          current: true,
        },
      ]);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadSecurityLogs = async () => {
    // Mock security logs
    setSecurityLogs([
      {
        id: '1',
        action: 'Login successful',
        device: 'Chrome on MacBook',
        ip: '192.168.1.100',
        timestamp: new Date().toISOString(),
        status: 'success',
      },
      {
        id: '2',
        action: 'Password changed',
        device: 'Chrome on MacBook',
        ip: '192.168.1.100',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        status: 'success',
      },
    ]);
  };

  // Start 2FA setup
  const handleStart2FASetup = async () => {
    setIsSettingUp2FA(true);
    try {
      const result = await setup2FA();
      setQrCode(result.qrCode);
      setSecret(result.secret);
      setSetupStep('qr');
      setShow2FASetupModal(true);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to start 2FA setup');
    } finally {
      setIsSettingUp2FA(false);
    }
  };

  // Verify 2FA code during setup
  const handleVerify2FASetup = async () => {
    if (verifyCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setIsSettingUp2FA(true);
    try {
      await totpHelpers.verify(verifyCode);
      await refreshAuth();
      toast.success('Two-factor authentication enabled successfully');
      setShow2FASetupModal(false);
      resetSetupState();
    } catch (error) {
      toast.error((error as Error).message || 'Invalid verification code');
    } finally {
      setIsSettingUp2FA(false);
    }
  };

  // Disable 2FA
  const handleDisable2FA = async () => {
    if (disableCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }
    if (!disablePassword) {
      toast.error('Password is required');
      return;
    }

    setIsDisabling2FA(true);
    try {
      await disable2FA(disableCode, disablePassword);
      toast.success('Two-factor authentication disabled');
      setShow2FADisableModal(false);
      setDisableCode('');
      setDisablePassword('');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to disable 2FA');
    } finally {
      setIsDisabling2FA(false);
    }
  };

  // Reset setup state
  const resetSetupState = () => {
    setQrCode('');
    setSecret('');
    setVerifyCode('');
    setSetupStep('qr');
    setShowSecret(false);
  };

  // Copy secret to clipboard
  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    toast.success('Secret copied to clipboard');
  };

  // Revoke session
  const handleRevokeSession = async (sessionId: string) => {
    setIsRevokingSession(sessionId);
    try {
      // In a real app, this would call an API to revoke the session
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSessions(sessions.filter((s) => s.id !== sessionId));
      toast.success('Session revoked');
    } catch (error) {
      toast.error('Failed to revoke session');
    } finally {
      setIsRevokingSession(null);
    }
  };

  // Revoke all other sessions
  const handleRevokeAllSessions = async () => {
    try {
      // In a real app, this would call an API
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSessions(sessions.filter((s) => s.current));
      toast.success('All other sessions revoked');
    } catch (error) {
      toast.error('Failed to revoke sessions');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/settings"
          className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Security</h1>
          <p className="text-sm text-text-secondary">
            Manage your security settings and two-factor authentication
          </p>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Two-Factor Authentication
      </h2>
      <Card variant="bordered" padding="md" className="mb-8">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0',
              user?.totp_enabled ? 'bg-green-500/10' : 'bg-surface-hover'
            )}
          >
            <Shield
              className={cn(
                'w-6 h-6',
                user?.totp_enabled ? 'text-green-500' : 'text-text-muted'
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-medium text-text-primary">
                Authenticator App
              </h3>
              {user?.totp_enabled ? (
                <span className="px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-500 rounded-full">
                  Enabled
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs font-medium bg-surface-hover text-text-muted rounded-full">
                  Not enabled
                </span>
              )}
            </div>
            <p className="text-sm text-text-secondary mb-4">
              {user?.totp_enabled
                ? 'Your account is protected with two-factor authentication using an authenticator app.'
                : 'Add an extra layer of security to your account by requiring a verification code from your authenticator app.'}
            </p>
            {user?.totp_enabled ? (
              <Button
                variant="secondary"
                onClick={() => setShow2FADisableModal(true)}
                className="text-red-500 border-red-500/30 hover:bg-red-500/10"
              >
                Disable 2FA
              </Button>
            ) : (
              <Button
                onClick={handleStart2FASetup}
                isLoading={isSettingUp2FA}
                leftIcon={<Smartphone className="w-4 h-4" />}
              >
                Enable 2FA
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Recovery Options */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Recovery Options
      </h2>
      <Card variant="bordered" padding="md" className="mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-surface-hover flex items-center justify-center flex-shrink-0">
            <Key className="w-6 h-6 text-text-muted" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-medium text-text-primary mb-1">
              Recovery Codes
            </h3>
            <p className="text-sm text-text-secondary mb-3">
              Recovery codes can be used to access your account if you lose
              access to your authenticator app.
            </p>
            <Button variant="secondary" disabled={!user?.totp_enabled}>
              {user?.totp_enabled ? 'View Recovery Codes' : 'Enable 2FA first'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Active Sessions */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Active Sessions
      </h2>
      <Card variant="bordered" padding="none" className="mb-8 overflow-hidden">
        {isLoadingSessions ? (
          <div className="p-8 flex justify-center">
            <RefreshCw className="w-6 h-6 text-text-muted animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            No active sessions
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {sessions.map((session) => (
                <div key={session.id} className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center flex-shrink-0">
                    <Monitor className="w-5 h-5 text-text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary">
                        {session.device}
                      </span>
                      {session.current && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-green-500/10 text-green-500 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary">
                      {session.browser} - {session.location}
                    </p>
                    <p className="text-xs text-text-muted">
                      {session.ip} - {formatDate(session.lastActive)}
                    </p>
                  </div>
                  {!session.current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeSession(session.id)}
                      isLoading={isRevokingSession === session.id}
                      className="text-red-500 hover:bg-red-500/10"
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {sessions.length > 1 && (
              <div className="p-4 bg-surface border-t border-border">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRevokeAllSessions}
                  className="w-full"
                >
                  Sign out all other sessions
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Security Activity */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Recent Security Activity
      </h2>
      <Card variant="bordered" padding="none" className="overflow-hidden">
        {securityLogs.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            No recent activity
          </div>
        ) : (
          <div className="divide-y divide-border">
            {securityLogs.map((log) => (
              <div key={log.id} className="p-4 flex items-center gap-4">
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                    log.status === 'success'
                      ? 'bg-green-500/10'
                      : 'bg-red-500/10'
                  )}
                >
                  {log.status === 'success' ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-text-primary">
                    {log.action}
                  </span>
                  <p className="text-sm text-text-secondary">{log.device}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-text-secondary">
                    {formatDate(log.timestamp)}
                  </p>
                  <p className="text-xs text-text-muted">{log.ip}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 2FA Setup Modal */}
      <Modal
        isOpen={show2FASetupModal}
        onClose={() => {
          setShow2FASetupModal(false);
          resetSetupState();
        }}
        title="Set Up Two-Factor Authentication"
        description={
          setupStep === 'qr'
            ? 'Scan this QR code with your authenticator app'
            : 'Enter the verification code from your authenticator app'
        }
        footer={
          setupStep === 'qr' ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setShow2FASetupModal(false);
                  resetSetupState();
                }}
              >
                Cancel
              </Button>
              <Button onClick={() => setSetupStep('verify')}>Continue</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setSetupStep('qr')}>
                Back
              </Button>
              <Button
                onClick={handleVerify2FASetup}
                isLoading={isSettingUp2FA}
              >
                Verify & Enable
              </Button>
            </>
          )
        }
      >
        {setupStep === 'qr' ? (
          <div className="space-y-4">
            {/* QR Code */}
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-lg">
                {qrCode ? (
                  <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Manual entry option */}
            <div className="text-center">
              <p className="text-sm text-text-secondary mb-2">
                Can't scan the code? Enter this key manually:
              </p>
              <div className="flex items-center justify-center gap-2">
                <code
                  className={cn(
                    'px-3 py-2 bg-surface rounded-lg font-mono text-sm',
                    showSecret ? 'text-text-primary' : 'text-transparent bg-clip-text'
                  )}
                  style={!showSecret ? { background: 'repeating-linear-gradient(90deg, currentColor 0, currentColor 8px, transparent 8px, transparent 12px)' } : {}}
                >
                  {showSecret ? secret : '••••••••••••••••'}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
                <Button variant="ghost" size="sm" onClick={copySecret}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-4 bg-surface rounded-lg">
              <h4 className="text-sm font-medium text-text-primary mb-2">
                Recommended authenticator apps:
              </h4>
              <ul className="text-sm text-text-secondary space-y-1">
                <li>- Google Authenticator</li>
                <li>- Authy</li>
                <li>- Microsoft Authenticator</li>
                <li>- 1Password</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Verification Code"
              value={verifyCode}
              onChange={(e) =>
                setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              placeholder="000000"
              maxLength={6}
              className="text-center text-2xl tracking-widest font-mono"
              autoFocus
            />
            <p className="text-sm text-text-secondary text-center">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>
        )}
      </Modal>

      {/* Disable 2FA Modal */}
      <Modal
        isOpen={show2FADisableModal}
        onClose={() => {
          setShow2FADisableModal(false);
          setDisableCode('');
          setDisablePassword('');
        }}
        title="Disable Two-Factor Authentication"
        description="This will remove the extra security layer from your account"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShow2FADisableModal(false);
                setDisableCode('');
                setDisablePassword('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              className="bg-red-500 text-white hover:bg-red-600 border-red-500"
              onClick={handleDisable2FA}
              isLoading={isDisabling2FA}
            >
              Disable 2FA
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <p className="text-sm text-yellow-200">
              Disabling two-factor authentication will make your account less
              secure. Only proceed if you have lost access to your authenticator
              app.
            </p>
          </div>
          <Input
            label="Verification Code"
            value={disableCode}
            onChange={(e) =>
              setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            placeholder="000000"
            maxLength={6}
            hint="Enter a code from your authenticator app"
          />
          <Input
            label="Password"
            type="password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            hint="Enter your account password to confirm"
          />
        </div>
      </Modal>
    </div>
  );
}
