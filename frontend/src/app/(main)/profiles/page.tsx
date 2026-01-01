'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Trash2, Check, User } from 'lucide-react';
import { Avatar, Button, Card, Modal, Input, toast } from '@/components/ui';
import { useProfileStore, useAuthStore } from '@/stores';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types';

const avatarColors = [
  'bg-red-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
];

export default function ProfilesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    profiles,
    activeProfile,
    setActiveProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    isLoading,
  } = useProfileStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    is_kids: false,
  });

  const resetForm = () => {
    setFormData({ name: '', is_kids: false });
  };

  const handleSelectProfile = (profile: Profile) => {
    if (isManageMode) return;
    setActiveProfile(profile);
    router.push('/home');
  };

  const handleAddProfile = async () => {
    if (!formData.name.trim() || !user?.id) return;

    setIsSubmitting(true);
    try {
      await createProfile({
        user: user.id,
        name: formData.name,
        is_kids: formData.is_kids,
        language: 'en',
      });
      toast.success('Profile created');
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to create profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditProfile = async () => {
    if (!selectedProfile || !formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      await updateProfile(selectedProfile.id, {
        name: formData.name,
        is_kids: formData.is_kids,
      });
      toast.success('Profile updated');
      setShowEditModal(false);
      setSelectedProfile(null);
      resetForm();
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProfile = async (profile: Profile) => {
    if (profiles.length <= 1) {
      toast.error('You must have at least one profile');
      return;
    }

    if (!confirm(`Delete "${profile.name}"?`)) return;

    try {
      await deleteProfile(profile.id);
      toast.success('Profile deleted');
    } catch (error) {
      toast.error('Failed to delete profile');
    }
  };

  const openEditModal = (profile: Profile) => {
    setSelectedProfile(profile);
    setFormData({
      name: profile.name,
      is_kids: profile.is_kids,
    });
    setShowEditModal(true);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-text-primary mb-2">
        {isManageMode ? 'Manage Profiles' : "Who's Watching?"}
      </h1>
      <p className="text-text-secondary mb-8">
        {isManageMode
          ? 'Edit or delete your profiles'
          : 'Select a profile to continue'}
      </p>

      {/* Profiles grid */}
      <div className="flex flex-wrap justify-center gap-6 mb-8">
        {profiles.map((profile, index) => (
          <div
            key={profile.id}
            className="relative group"
            onClick={() => handleSelectProfile(profile)}
          >
            <div
              className={cn(
                'flex flex-col items-center cursor-pointer transition-all duration-200',
                !isManageMode && 'hover:scale-105'
              )}
            >
              <div
                className={cn(
                  'relative w-24 h-24 md:w-32 md:h-32 rounded-md overflow-hidden mb-3',
                  'ring-2 transition-all',
                  activeProfile?.id === profile.id
                    ? 'ring-primary'
                    : 'ring-transparent hover:ring-text-primary/50',
                  avatarColors[index % avatarColors.length]
                )}
              >
                {profile.avatar ? (
                  <Avatar
                    src={profile.avatar}
                    name={profile.name}
                    size="2xl"
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-12 h-12 md:w-16 md:h-16 text-white/80" />
                  </div>
                )}

                {/* Selected indicator */}
                {activeProfile?.id === profile.id && !isManageMode && (
                  <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Manage mode overlay */}
                {isManageMode && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(profile);
                      }}
                      className="p-2 rounded-full bg-surface hover:bg-surface-hover transition-colors"
                    >
                      <Edit2 className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProfile(profile);
                      }}
                      className="p-2 rounded-full bg-error/80 hover:bg-error transition-colors"
                    >
                      <Trash2 className="w-5 h-5 text-white" />
                    </button>
                  </div>
                )}
              </div>

              <span className="text-text-secondary group-hover:text-text-primary transition-colors">
                {profile.name}
              </span>
              {profile.is_kids && (
                <span className="text-xs text-primary mt-1">KIDS</span>
              )}
            </div>
          </div>
        ))}

        {/* Add profile button */}
        {profiles.length < 5 && !isManageMode && (
          <div
            className="flex flex-col items-center cursor-pointer group"
            onClick={() => setShowAddModal(true)}
          >
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-md border-2 border-dashed border-text-muted flex items-center justify-center mb-3 group-hover:border-text-primary transition-colors">
              <Plus className="w-12 h-12 text-text-muted group-hover:text-text-primary transition-colors" />
            </div>
            <span className="text-text-secondary group-hover:text-text-primary transition-colors">
              Add Profile
            </span>
          </div>
        )}
      </div>

      {/* Manage profiles button */}
      <Button
        variant="secondary"
        onClick={() => setIsManageMode(!isManageMode)}
      >
        {isManageMode ? 'Done' : 'Manage Profiles'}
      </Button>

      {/* Add Profile Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title="Add Profile"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddProfile} isLoading={isSubmitting}>
              Create Profile
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Profile Name"
            placeholder="Enter name"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
          />
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_kids}
              onChange={(e) =>
                setFormData({ ...formData, is_kids: e.target.checked })
              }
              className="w-5 h-5 rounded border-border bg-surface text-primary focus:ring-primary"
            />
            <span className="text-text-primary">Kids Profile</span>
          </label>
          <p className="text-sm text-text-muted">
            Kids profiles show only content suitable for children.
          </p>
        </div>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedProfile(null);
          resetForm();
        }}
        title="Edit Profile"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowEditModal(false);
                setSelectedProfile(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEditProfile} isLoading={isSubmitting}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Profile Name"
            placeholder="Enter name"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
          />
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_kids}
              onChange={(e) =>
                setFormData({ ...formData, is_kids: e.target.checked })
              }
              className="w-5 h-5 rounded border-border bg-surface text-primary focus:ring-primary"
            />
            <span className="text-text-primary">Kids Profile</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
