// User types
export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  totp_enabled: boolean;
  created: string;
  updated: string;
}

// Profile types
export interface Profile {
  id: string;
  user: string;
  name: string;
  avatar?: string;
  pin?: string;
  is_kids: boolean;
  language: string;
  created: string;
  updated: string;
}

// Playlist types
export interface Playlist {
  id: string;
  user: string;
  name: string;
  url?: string;
  content?: string;
  is_active: boolean;
  last_synced?: string;
  auto_sync: boolean;
  sync_interval: number;
  created: string;
  updated: string;
}

// Channel types
export interface Channel {
  id: string;
  playlist: string;
  tvg_id?: string;
  tvg_name?: string;
  tvg_logo?: string;
  group_title: string;
  name: string;
  url: string;
  is_active: boolean;
  quality?: 'SD' | 'HD' | 'FHD' | '4K';
  language?: string;
  country?: string;
  sort_order: number;
  custom_name?: string;
  custom_logo?: string;
  created: string;
  updated: string;
}

// Category types
export interface Category {
  id: string;
  user: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  sort_order: number;
  is_visible: boolean;
  created: string;
  updated: string;
}

// Favorite types
export interface Favorite {
  id: string;
  profile: string;
  channel: string;
  sort_order: number;
  created: string;
  expand?: {
    channel?: Channel;
  };
}

// Watch history types
export interface WatchHistory {
  id: string;
  profile: string;
  channel: string;
  watched_at: string;
  duration: number;
  progress?: number;
  created: string;
  expand?: {
    channel?: Channel;
  };
}

// EPG types
export interface EPGSource {
  id: string;
  user: string;
  name: string;
  url: string;
  is_active: boolean;
  last_synced?: string;
  sync_interval: number;
  created: string;
  updated: string;
}

export interface EPGProgram {
  id: string;
  source: string;
  channel_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  category?: string;
  icon?: string;
  rating?: string;
  episode?: string;
  created: string;
}

// Recording types
export interface Recording {
  id: string;
  profile: string;
  channel: string;
  program_title: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start?: string;
  actual_end?: string;
  status: 'scheduled' | 'recording' | 'completed' | 'failed';
  file_path?: string;
  file_size?: number;
  created: string;
  updated: string;
  expand?: {
    channel?: Channel;
  };
}

// Settings types
export interface UserSettings {
  id: string;
  user: string;
  key: string;
  value: Record<string, unknown>;
  created: string;
  updated: string;
}

// Auth types
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requires2FA: boolean;
  pendingUserId?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  passwordConfirm: string;
}

export interface TOTPSetupResponse {
  secret: string;
  qrCode: string;
  otpAuthUrl: string;
}

// M3U Parser types
export interface M3UChannel {
  tvgId?: string;
  tvgName?: string;
  tvgLogo?: string;
  groupTitle: string;
  name: string;
  url: string;
  language?: string;
  country?: string;
}

export interface M3UPlaylist {
  channels: M3UChannel[];
  info?: {
    name?: string;
    author?: string;
    url?: string;
  };
  epgUrl?: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: T[];
}

// Player types
export interface PlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  quality: string;
  availableQualities: string[];
  error: string | null;
}

// Navigation types
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}
