'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Mail,
  Camera,
  Save,
  Trash2,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';
import { Card, Button, Input, Modal, toast } from '@/components/ui';
import { useAuthStore } from '@/stores';
import { pb, authHelpers } from '@/lib/pocketbase/client';
import { cn } from '@/lib/utils';

export default function AccountSettingsPage() {
  const { user, logout } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile form state
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Email change state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Get avatar URL
  const getAvatarUrl = () => {
    if (avatarPreview) return avatarPreview;
    if (user?.avatar) {
      return pb.files.getUrl(user, user.avatar);
    }
    return null;
  };

  // Handle avatar selection
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  // Upload avatar
  const handleUploadAvatar = async () => {
    if (!avatarFile || !user?.id) return;

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);

      await pb.collection('users').update(user.id, formData);

      // Refresh auth to get updated user data
      await authHelpers.refreshAuth();

      setAvatarFile(null);
      setAvatarPreview(null);
      toast.success('Avatar updated successfully');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Remove avatar
  const handleRemoveAvatar = async () => {
    if (!user?.id) return;

    setIsUploadingAvatar(true);
    try {
      await pb.collection('users').update(user.id, { avatar: null });
      await authHelpers.refreshAuth();
      setAvatarPreview(null);
      toast.success('Avatar removed');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to remove avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Update profile (username)
  const handleUpdateProfile = async () => {
    if (!user?.id) return;
    if (!username.trim()) {
      toast.error('Username is required');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await pb.collection('users').update(user.id, { username });
      await authHelpers.refreshAuth();
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    if (!user?.id) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      await pb.collection('users').update(user.id, {
        oldPassword: currentPassword,
        password: newPassword,
        passwordConfirm: confirmPassword,
      });

      toast.success('Password changed successfully');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Request email change
  const handleRequestEmailChange = async () => {
    if (!user?.id) return;

    if (!newEmail || !emailPassword) {
      toast.error('All fields are required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsChangingEmail(true);
    try {
      // First verify current password
      await pb.collection('users').authWithPassword(user.email, emailPassword);

      // Request email change
      await pb.collection('users').requestEmailChange(newEmail);

      toast.success('Verification email sent to your new address');
      setShowEmailModal(false);
      setNewEmail('');
      setEmailPassword('');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to request email change');
    } finally {
      setIsChangingEmail(false);
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (!user?.id) return;

    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }
    if (!deletePassword) {
      toast.error('Password is required');
      return;
    }

    setIsDeletingAccount(true);
    try {
      // Verify password first
      await pb.collection('users').authWithPassword(user.email, deletePassword);

      // Delete account
      await pb.collection('users').delete(user.id);

      toast.success('Account deleted successfully');
      logout();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to delete account');
    } finally {
      setIsDeletingAccount(false);
    }
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
          <h1 className="text-2xl font-bold text-text-primary">Account</h1>
          <p className="text-sm text-text-secondary">
            Manage your profile and account settings
          </p>
        </div>
      </div>

      {/* Profile Picture */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Profile Picture
      </h2>
      <Card variant="bordered" padding="md" className="mb-8">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div
              className={cn(
                'w-24 h-24 rounded-full flex items-center justify-center overflow-hidden',
                getAvatarUrl() ? '' : 'bg-surface-hover'
              )}
            >
              {getAvatarUrl() ? (
                <img
                  src={getAvatarUrl()!}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-text-muted" />
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-medium text-text-primary mb-1">
              {user?.username || 'User'}
            </h3>
            <p className="text-sm text-text-secondary mb-3">{user?.email}</p>
            <div className="flex gap-2">
              {avatarFile ? (
                <>
                  <Button
                    size="sm"
                    onClick={handleUploadAvatar}
                    isLoading={isUploadingAvatar}
                    leftIcon={<Check className="w-4 h-4" />}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview(null);
                    }}
                    leftIcon={<X className="w-4 h-4" />}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload new
                  </Button>
                  {user?.avatar && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRemoveAvatar}
                      isLoading={isUploadingAvatar}
                    >
                      Remove
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Profile Information */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Profile Information
      </h2>
      <Card variant="bordered" padding="md" className="mb-8">
        <div className="space-y-4">
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            leftIcon={<User className="w-5 h-5" />}
          />
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Email
            </label>
            <div className="flex gap-2">
              <Input
                value={email}
                disabled
                leftIcon={<Mail className="w-5 h-5" />}
                className="flex-1"
              />
              <Button
                variant="secondary"
                onClick={() => setShowEmailModal(true)}
              >
                Change
              </Button>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleUpdateProfile}
              isLoading={isUpdatingProfile}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Card>

      {/* Password */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">Password</h2>
      <Card variant="bordered" padding="md" className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium text-text-primary">
              Change password
            </h3>
            <p className="text-sm text-text-secondary">
              Update your password to keep your account secure
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setShowPasswordModal(true)}
          >
            Change Password
          </Button>
        </div>
      </Card>

      {/* Account Info */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Account Information
      </h2>
      <Card variant="bordered" padding="md" className="mb-8">
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-text-secondary">Account ID</span>
            <span className="text-text-primary font-mono text-sm">
              {user?.id}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-text-secondary">Created</span>
            <span className="text-text-primary">
              {user?.created
                ? new Date(user.created).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '-'}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-text-secondary">Last updated</span>
            <span className="text-text-primary">
              {user?.updated
                ? new Date(user.updated).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '-'}
            </span>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <h2 className="text-lg font-semibold text-red-500 mb-4">Danger Zone</h2>
      <Card
        variant="bordered"
        padding="md"
        className="border-red-500/30 bg-red-500/5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <h3 className="text-base font-medium text-text-primary">
                Delete Account
              </h3>
              <p className="text-sm text-text-secondary">
                Permanently delete your account and all associated data. This
                action cannot be undone.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            className="border-red-500/50 text-red-500 hover:bg-red-500/10"
            onClick={() => setShowDeleteModal(true)}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Delete
          </Button>
        </div>
      </Card>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        }}
        title="Change Password"
        description="Enter your current password and choose a new one"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowPasswordModal(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              isLoading={isChangingPassword}
            >
              Change Password
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            hint="Must be at least 8 characters"
            autoComplete="new-password"
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
      </Modal>

      {/* Change Email Modal */}
      <Modal
        isOpen={showEmailModal}
        onClose={() => {
          setShowEmailModal(false);
          setNewEmail('');
          setEmailPassword('');
        }}
        title="Change Email"
        description="A verification link will be sent to your new email address"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowEmailModal(false);
                setNewEmail('');
                setEmailPassword('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestEmailChange}
              isLoading={isChangingEmail}
            >
              Send Verification
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="New Email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="newemail@example.com"
          />
          <Input
            label="Current Password"
            type="password"
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
            hint="Required for security verification"
          />
        </div>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmText('');
          setDeletePassword('');
        }}
        title="Delete Account"
        description="This action is permanent and cannot be undone"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmText('');
                setDeletePassword('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              className="bg-red-500 text-white hover:bg-red-600 border-red-500"
              onClick={handleDeleteAccount}
              isLoading={isDeletingAccount}
              disabled={deleteConfirmText !== 'DELETE'}
            >
              Delete Account
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">
              Warning: This will permanently delete your account, including:
            </p>
            <ul className="text-sm text-red-400 list-disc list-inside mt-2 space-y-1">
              <li>All your playlists and channels</li>
              <li>Your watch history and favorites</li>
              <li>All recordings and scheduled recordings</li>
              <li>Your profile and settings</li>
            </ul>
          </div>
          <Input
            label="Type DELETE to confirm"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
            placeholder="DELETE"
          />
          <Input
            label="Password"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            hint="Enter your password to confirm"
          />
        </div>
      </Modal>
    </div>
  );
}
