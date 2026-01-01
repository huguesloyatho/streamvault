'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Link as LinkIcon,
  Upload,
  Download,
  MoreVertical,
  CheckCircle,
  XCircle,
  Tv,
  Globe,
  Zap,
} from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Modal,
  toast,
  Badge,
  Dropdown,
  Spinner,
} from '@/components/ui';
import { useChannelStore, useAuthStore } from '@/stores';
import { parseM3U, fetchAndParseM3U } from '@/lib/parsers';
import { formatRelativeTime } from '@/lib/utils';
import pb from '@/lib/pocketbase/client';
import type { Playlist, Channel } from '@/types';

// Quick import playlist types
type QuickImportType = 'country' | 'category' | 'language' | 'region';

interface QuickImportPlaylist {
  name: string;
  url: string;
  icon: string;
  description: string;
  type: QuickImportType;
  epgUrl?: string;
}

// EPG URL helper - iptv-org provides EPG by country code
function getEpgUrlForCountry(countryCode: string): string {
  return `https://iptv-org.github.io/epg/guides/${countryCode}.xml`;
}

// Pre-configured playlists from iptv-org - By Country (with EPG URLs)
const countryPlaylists: QuickImportPlaylist[] = [
  { name: 'France', url: 'https://iptv-org.github.io/iptv/countries/fr.m3u', icon: '🇫🇷', description: 'French TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/fr.xml' },
  { name: 'United Kingdom', url: 'https://iptv-org.github.io/iptv/countries/uk.m3u', icon: '🇬🇧', description: 'British TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/uk.xml' },
  { name: 'United States', url: 'https://iptv-org.github.io/iptv/countries/us.m3u', icon: '🇺🇸', description: 'American TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/us.xml' },
  { name: 'Germany', url: 'https://iptv-org.github.io/iptv/countries/de.m3u', icon: '🇩🇪', description: 'German TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/de.xml' },
  { name: 'Spain', url: 'https://iptv-org.github.io/iptv/countries/es.m3u', icon: '🇪🇸', description: 'Spanish TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/es.xml' },
  { name: 'Italy', url: 'https://iptv-org.github.io/iptv/countries/it.m3u', icon: '🇮🇹', description: 'Italian TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/it.xml' },
  { name: 'Portugal', url: 'https://iptv-org.github.io/iptv/countries/pt.m3u', icon: '🇵🇹', description: 'Portuguese TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/pt.xml' },
  { name: 'Belgium', url: 'https://iptv-org.github.io/iptv/countries/be.m3u', icon: '🇧🇪', description: 'Belgian TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/be.xml' },
  { name: 'Switzerland', url: 'https://iptv-org.github.io/iptv/countries/ch.m3u', icon: '🇨🇭', description: 'Swiss TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/ch.xml' },
  { name: 'Canada', url: 'https://iptv-org.github.io/iptv/countries/ca.m3u', icon: '🇨🇦', description: 'Canadian TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/ca.xml' },
  { name: 'Netherlands', url: 'https://iptv-org.github.io/iptv/countries/nl.m3u', icon: '🇳🇱', description: 'Dutch TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/nl.xml' },
  { name: 'Brazil', url: 'https://iptv-org.github.io/iptv/countries/br.m3u', icon: '🇧🇷', description: 'Brazilian TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/br.xml' },
  { name: 'Japan', url: 'https://iptv-org.github.io/iptv/countries/jp.m3u', icon: '🇯🇵', description: 'Japanese TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/jp.xml' },
  { name: 'South Korea', url: 'https://iptv-org.github.io/iptv/countries/kr.m3u', icon: '🇰🇷', description: 'Korean TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/kr.xml' },
  { name: 'India', url: 'https://iptv-org.github.io/iptv/countries/in.m3u', icon: '🇮🇳', description: 'Indian TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/in.xml' },
  { name: 'Russia', url: 'https://iptv-org.github.io/iptv/countries/ru.m3u', icon: '🇷🇺', description: 'Russian TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/ru.xml' },
  { name: 'Mexico', url: 'https://iptv-org.github.io/iptv/countries/mx.m3u', icon: '🇲🇽', description: 'Mexican TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/mx.xml' },
  { name: 'Argentina', url: 'https://iptv-org.github.io/iptv/countries/ar.m3u', icon: '🇦🇷', description: 'Argentine TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/ar.xml' },
  { name: 'Australia', url: 'https://iptv-org.github.io/iptv/countries/au.m3u', icon: '🇦🇺', description: 'Australian TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/au.xml' },
  { name: 'Poland', url: 'https://iptv-org.github.io/iptv/countries/pl.m3u', icon: '🇵🇱', description: 'Polish TV channels', type: 'country', epgUrl: 'https://iptv-org.github.io/epg/guides/pl.xml' },
];

// Pre-configured playlists by Category
const categoryPlaylists: QuickImportPlaylist[] = [
  { name: 'News', url: 'https://iptv-org.github.io/iptv/categories/news.m3u', icon: '📰', description: 'News channels worldwide', type: 'category' },
  { name: 'Sports', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u', icon: '⚽', description: 'Sports channels', type: 'category' },
  { name: 'Movies', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u', icon: '🎬', description: 'Movie channels', type: 'category' },
  { name: 'Music', url: 'https://iptv-org.github.io/iptv/categories/music.m3u', icon: '🎵', description: 'Music channels', type: 'category' },
  { name: 'Entertainment', url: 'https://iptv-org.github.io/iptv/categories/entertainment.m3u', icon: '🎭', description: 'Entertainment channels', type: 'category' },
  { name: 'Kids', url: 'https://iptv-org.github.io/iptv/categories/kids.m3u', icon: '👶', description: 'Children channels', type: 'category' },
  { name: 'Documentary', url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u', icon: '🎥', description: 'Documentary channels', type: 'category' },
  { name: 'Animation', url: 'https://iptv-org.github.io/iptv/categories/animation.m3u', icon: '🎨', description: 'Animation & Anime', type: 'category' },
  { name: 'Series', url: 'https://iptv-org.github.io/iptv/categories/series.m3u', icon: '📺', description: 'TV Series channels', type: 'category' },
  { name: 'Education', url: 'https://iptv-org.github.io/iptv/categories/education.m3u', icon: '📚', description: 'Educational channels', type: 'category' },
  { name: 'Cooking', url: 'https://iptv-org.github.io/iptv/categories/cooking.m3u', icon: '🍳', description: 'Cooking channels', type: 'category' },
  { name: 'Travel', url: 'https://iptv-org.github.io/iptv/categories/travel.m3u', icon: '✈️', description: 'Travel & Tourism', type: 'category' },
  { name: 'Science', url: 'https://iptv-org.github.io/iptv/categories/science.m3u', icon: '🔬', description: 'Science channels', type: 'category' },
  { name: 'Religious', url: 'https://iptv-org.github.io/iptv/categories/religious.m3u', icon: '🙏', description: 'Religious channels', type: 'category' },
  { name: 'Weather', url: 'https://iptv-org.github.io/iptv/categories/weather.m3u', icon: '🌤️', description: 'Weather channels', type: 'category' },
];

// Pre-configured playlists by Language
const languagePlaylists: QuickImportPlaylist[] = [
  { name: 'English', url: 'https://iptv-org.github.io/iptv/languages/eng.m3u', icon: '🇬🇧', description: 'English language channels', type: 'language' },
  { name: 'French', url: 'https://iptv-org.github.io/iptv/languages/fra.m3u', icon: '🇫🇷', description: 'French language channels', type: 'language' },
  { name: 'Spanish', url: 'https://iptv-org.github.io/iptv/languages/spa.m3u', icon: '🇪🇸', description: 'Spanish language channels', type: 'language' },
  { name: 'German', url: 'https://iptv-org.github.io/iptv/languages/deu.m3u', icon: '🇩🇪', description: 'German language channels', type: 'language' },
  { name: 'Italian', url: 'https://iptv-org.github.io/iptv/languages/ita.m3u', icon: '🇮🇹', description: 'Italian language channels', type: 'language' },
  { name: 'Portuguese', url: 'https://iptv-org.github.io/iptv/languages/por.m3u', icon: '🇵🇹', description: 'Portuguese language channels', type: 'language' },
  { name: 'Arabic', url: 'https://iptv-org.github.io/iptv/languages/ara.m3u', icon: '🇸🇦', description: 'Arabic language channels', type: 'language' },
  { name: 'Russian', url: 'https://iptv-org.github.io/iptv/languages/rus.m3u', icon: '🇷🇺', description: 'Russian language channels', type: 'language' },
  { name: 'Chinese', url: 'https://iptv-org.github.io/iptv/languages/zho.m3u', icon: '🇨🇳', description: 'Chinese language channels', type: 'language' },
  { name: 'Japanese', url: 'https://iptv-org.github.io/iptv/languages/jpn.m3u', icon: '🇯🇵', description: 'Japanese language channels', type: 'language' },
  { name: 'Korean', url: 'https://iptv-org.github.io/iptv/languages/kor.m3u', icon: '🇰🇷', description: 'Korean language channels', type: 'language' },
  { name: 'Hindi', url: 'https://iptv-org.github.io/iptv/languages/hin.m3u', icon: '🇮🇳', description: 'Hindi language channels', type: 'language' },
  { name: 'Dutch', url: 'https://iptv-org.github.io/iptv/languages/nld.m3u', icon: '🇳🇱', description: 'Dutch language channels', type: 'language' },
  { name: 'Polish', url: 'https://iptv-org.github.io/iptv/languages/pol.m3u', icon: '🇵🇱', description: 'Polish language channels', type: 'language' },
  { name: 'Turkish', url: 'https://iptv-org.github.io/iptv/languages/tur.m3u', icon: '🇹🇷', description: 'Turkish language channels', type: 'language' },
];

// Pre-configured playlists by Region
const regionPlaylists: QuickImportPlaylist[] = [
  { name: 'Europe', url: 'https://iptv-org.github.io/iptv/regions/eur.m3u', icon: '🇪🇺', description: 'European channels', type: 'region' },
  { name: 'North America', url: 'https://iptv-org.github.io/iptv/regions/nam.m3u', icon: '🌎', description: 'North American channels', type: 'region' },
  { name: 'Latin America', url: 'https://iptv-org.github.io/iptv/regions/latam.m3u', icon: '🌎', description: 'Latin American channels', type: 'region' },
  { name: 'Asia', url: 'https://iptv-org.github.io/iptv/regions/asia.m3u', icon: '🌏', description: 'Asian channels', type: 'region' },
  { name: 'Africa', url: 'https://iptv-org.github.io/iptv/regions/afr.m3u', icon: '🌍', description: 'African channels', type: 'region' },
  { name: 'Middle East', url: 'https://iptv-org.github.io/iptv/regions/mideast.m3u', icon: '🌍', description: 'Middle Eastern channels', type: 'region' },
  { name: 'Oceania', url: 'https://iptv-org.github.io/iptv/regions/oce.m3u', icon: '🌏', description: 'Oceanian channels', type: 'region' },
  { name: 'Caribbean', url: 'https://iptv-org.github.io/iptv/regions/carib.m3u', icon: '🏝️', description: 'Caribbean channels', type: 'region' },
  { name: 'European Union', url: 'https://iptv-org.github.io/iptv/regions/eu.m3u', icon: '🇪🇺', description: 'EU member channels', type: 'region' },
  { name: 'All Channels', url: 'https://iptv-org.github.io/iptv/index.m3u', icon: '🌍', description: 'All channels worldwide (large)', type: 'region' },
];

// Generate M3U content from channels
function generateM3UContent(channels: Channel[], playlistName: string): string {
  let content = '#EXTM3U\n';
  content += `#PLAYLIST:${playlistName}\n\n`;

  for (const channel of channels) {
    // Build EXTINF line with attributes
    let extinf = '#EXTINF:-1';

    if (channel.tvg_id) {
      extinf += ` tvg-id="${channel.tvg_id}"`;
    }
    if (channel.tvg_name) {
      extinf += ` tvg-name="${channel.tvg_name}"`;
    }
    if (channel.tvg_logo) {
      extinf += ` tvg-logo="${channel.tvg_logo}"`;
    }
    if (channel.group_title) {
      extinf += ` group-title="${channel.group_title}"`;
    }
    if (channel.language) {
      extinf += ` tvg-language="${channel.language}"`;
    }
    if (channel.country) {
      extinf += ` tvg-country="${channel.country}"`;
    }

    extinf += `,${channel.custom_name || channel.name}\n`;
    content += extinf;
    content += `${channel.url}\n\n`;
  }

  return content;
}

export default function PlaylistsPage() {
  const { user } = useAuthStore();
  const { playlists, channels, addPlaylist, updatePlaylist, deletePlaylist, addChannels, fetchChannels, fetchPlaylists, isLoading } = useChannelStore();

  // Load playlists on mount
  useEffect(() => {
    if (user?.id) {
      fetchPlaylists(user.id);
    }
  }, [user?.id, fetchPlaylists]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQuickImport, setShowQuickImport] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [importingPlaylist, setImportingPlaylist] = useState<string | null>(null);
  const [quickImportTab, setQuickImportTab] = useState<QuickImportType>('country');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    url: '',
  });

  const resetForm = () => {
    setFormData({ name: '', url: '' });
  };

  const handleAddPlaylist = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a playlist name');
      return;
    }
    if (!formData.url.trim()) {
      toast.error('Please enter a playlist URL');
      return;
    }
    if (!user?.id) return;

    setIsSubmitting(true);
    try {
      // Create the playlist
      const playlist = await addPlaylist({
        user: user.id,
        name: formData.name,
        url: formData.url,
        is_active: true,
        auto_sync: false,
        sync_interval: 24,
      });

      // Parse and import channels
      toast.info('Fetching playlist...');
      const parsed = await fetchAndParseM3U(formData.url);

      if (parsed.channels.length === 0) {
        toast.warning('No channels found in the playlist');
      } else {
        // Add channels to the database
        await addChannels(
          parsed.channels.map((ch, index) => ({
            playlist: playlist.id,
            tvg_id: ch.tvgId || '',
            tvg_name: ch.tvgName || '',
            tvg_logo: ch.tvgLogo || '',
            group_title: ch.groupTitle || 'Uncategorized',
            name: ch.name,
            url: ch.url,
            is_active: true,
            language: ch.language || '',
            country: ch.country || '',
            sort_order: index,
          }))
        );

        // Update playlist with last synced time
        await updatePlaylist(playlist.id, {
          last_synced: new Date().toISOString(),
        });

        // Refresh channels
        await fetchChannels(user.id);

        // Auto-add EPG source if found in M3U header
        if (parsed.epgUrl) {
          try {
            // Check if this EPG source already exists
            const existingEpg = await pb.collection('epg_sources').getList(1, 1, {
              filter: `user = "${user.id}" && url = "${parsed.epgUrl}"`,
            });

            if (existingEpg.totalItems === 0) {
              // Create new EPG source
              await pb.collection('epg_sources').create({
                user: user.id,
                name: `EPG - ${formData.name}`,
                url: parsed.epgUrl,
                is_active: true,
                sync_interval: 24,
              });
              toast.success(`Added ${parsed.channels.length} channels + EPG from playlist`);
            } else {
              toast.success(`Added ${parsed.channels.length} channels from playlist`);
            }
          } catch {
            toast.success(`Added ${parsed.channels.length} channels from playlist`);
          }
        } else {
          toast.success(`Added ${parsed.channels.length} channels from playlist`);
        }
      }

      setShowAddModal(false);
      resetForm();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to add playlist');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPlaylist = async () => {
    if (!selectedPlaylist) return;

    setIsSubmitting(true);
    try {
      await updatePlaylist(selectedPlaylist.id, {
        name: formData.name,
        url: formData.url,
      });
      toast.success('Playlist updated');
      setShowEditModal(false);
      setSelectedPlaylist(null);
      resetForm();
    } catch (error) {
      toast.error('Failed to update playlist');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlaylist = async (playlist: Playlist) => {
    if (!confirm(`Delete "${playlist.name}"? This will also remove all channels from this playlist.`)) {
      return;
    }

    try {
      await deletePlaylist(playlist.id);
      if (user?.id) {
        await fetchChannels(user.id);
      }
      toast.success('Playlist deleted');
    } catch (error) {
      toast.error('Failed to delete playlist');
    }
  };

  const handleSyncPlaylist = async (playlist: Playlist) => {
    if (!playlist.url || !user?.id) return;

    setIsSyncing(playlist.id);
    try {
      toast.info('Syncing playlist...');
      const parsed = await fetchAndParseM3U(playlist.url);

      if (parsed.channels.length === 0) {
        toast.warning('No channels found in the playlist');
      } else {
        // Add channels to the database
        await addChannels(
          parsed.channels.map((ch, index) => ({
            playlist: playlist.id,
            tvg_id: ch.tvgId || '',
            tvg_name: ch.tvgName || '',
            tvg_logo: ch.tvgLogo || '',
            group_title: ch.groupTitle || 'Uncategorized',
            name: ch.name,
            url: ch.url,
            is_active: true,
            language: ch.language || '',
            country: ch.country || '',
            sort_order: index,
          }))
        );

        // Refresh channels
        await fetchChannels(user.id);

        toast.success(`Synced ${parsed.channels.length} channels`);
      }

      // Update playlist with last synced time
      await updatePlaylist(playlist.id, {
        last_synced: new Date().toISOString(),
      });
    } catch (error) {
      toast.error('Failed to sync playlist');
    } finally {
      setIsSyncing(null);
    }
  };

  const openEditModal = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setFormData({
      name: playlist.name,
      url: playlist.url || '',
    });
    setShowEditModal(true);
  };

  const handleQuickImport = async (quickPlaylist: QuickImportPlaylist) => {
    if (!user?.id) return;

    // Check if already imported
    const existingPlaylist = playlists.find((p) => p.url === quickPlaylist.url);
    if (existingPlaylist) {
      toast.warning(`"${quickPlaylist.name}" is already imported`);
      return;
    }

    setImportingPlaylist(quickPlaylist.url);
    try {
      // Create the playlist with type prefix for clarity
      const playlistName = quickPlaylist.type === 'country'
        ? quickPlaylist.name
        : `[${quickPlaylist.type.charAt(0).toUpperCase() + quickPlaylist.type.slice(1)}] ${quickPlaylist.name}`;

      const playlist = await addPlaylist({
        user: user.id,
        name: playlistName,
        url: quickPlaylist.url,
        is_active: true,
        auto_sync: true,
        sync_interval: 24,
      });

      // Parse and import channels
      toast.info(`Fetching ${quickPlaylist.name}...`);
      const parsed = await fetchAndParseM3U(quickPlaylist.url);

      if (parsed.channels.length === 0) {
        toast.warning('No channels found in the playlist');
      } else {
        // Add channels to the database
        await addChannels(
          parsed.channels.map((ch, index) => ({
            playlist: playlist.id,
            tvg_id: ch.tvgId || '',
            tvg_name: ch.tvgName || '',
            tvg_logo: ch.tvgLogo || '',
            group_title: ch.groupTitle || 'Uncategorized',
            name: ch.name,
            url: ch.url,
            is_active: true,
            language: ch.language || '',
            country: ch.country || '',
            sort_order: index,
          }))
        );

        // Update playlist with last synced time
        await updatePlaylist(playlist.id, {
          last_synced: new Date().toISOString(),
        });

        // Refresh channels
        await fetchChannels(user.id);

        // Auto-add EPG source if available (from quick import or parsed from M3U)
        const epgUrl = quickPlaylist.epgUrl || parsed.epgUrl;
        if (epgUrl) {
          try {
            // Check if this EPG source already exists
            const existingEpg = await pb.collection('epg_sources').getList(1, 1, {
              filter: `user = "${user.id}" && url = "${epgUrl}"`,
            });

            if (existingEpg.totalItems === 0) {
              // Create new EPG source
              await pb.collection('epg_sources').create({
                user: user.id,
                name: `EPG - ${quickPlaylist.name}`,
                url: epgUrl,
                is_active: true,
                sync_interval: 24,
              });
              toast.success(`Imported ${parsed.channels.length} channels + EPG from ${quickPlaylist.name}`);
            } else {
              toast.success(`Imported ${parsed.channels.length} channels from ${quickPlaylist.name}`);
            }
          } catch {
            // EPG source creation failed, but playlist was imported successfully
            toast.success(`Imported ${parsed.channels.length} channels from ${quickPlaylist.name}`);
          }
        } else {
          toast.success(`Imported ${parsed.channels.length} channels from ${quickPlaylist.name}`);
        }
      }
    } catch (error) {
      toast.error((error as Error).message || `Failed to import ${quickPlaylist.name}`);
    } finally {
      setImportingPlaylist(null);
    }
  };

  const handleExportPlaylist = (playlist: Playlist) => {
    // Get channels for this playlist
    const playlistChannels = channels.filter((ch) => ch.playlist === playlist.id);

    if (playlistChannels.length === 0) {
      toast.warning('No channels to export in this playlist');
      return;
    }

    // Generate M3U content
    const m3uContent = generateM3UContent(playlistChannels, playlist.name);

    // Create and download file
    const blob = new Blob([m3uContent], { type: 'application/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${playlist.name.replace(/[^a-z0-9]/gi, '_')}.m3u`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${playlistChannels.length} channels`);
  };

  const handleExportAllPlaylists = () => {
    if (channels.length === 0) {
      toast.warning('No channels to export');
      return;
    }

    // Generate M3U content with all channels
    const m3uContent = generateM3UContent(channels, 'All Playlists');

    // Create and download file
    const blob = new Blob([m3uContent], { type: 'application/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'all_playlists.m3u';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${channels.length} channels from all playlists`);
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Playlists</h1>
          <p className="text-text-secondary mt-1">
            Manage your M3U/M3U8 playlists
          </p>
        </div>
        <div className="flex items-center gap-2">
          {playlists.length > 0 && (
            <Button
              variant="secondary"
              onClick={handleExportAllPlaylists}
              leftIcon={<Download className="w-5 h-5" />}
            >
              Export All
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => setShowQuickImport(!showQuickImport)}
            leftIcon={<Zap className="w-5 h-5" />}
          >
            Quick Import
          </Button>
          <Button
            onClick={() => setShowAddModal(true)}
            leftIcon={<Plus className="w-5 h-5" />}
          >
            Add Playlist
          </Button>
        </div>
      </div>

      {/* Quick Import Section */}
      {showQuickImport && (
        <Card variant="bordered" padding="md" className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium text-text-primary">
              Quick Import from IPTV-Org
            </h3>
          </div>
          <p className="text-sm text-text-secondary mb-4">
            Import free, legal IPTV channels from{' '}
            <a
              href="https://github.com/iptv-org/iptv"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              iptv-org
            </a>{' '}
            and{' '}
            <a
              href="https://github.com/iptv-org/database"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              iptv-org/database
            </a>
            . Select a source to get started:
          </p>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 p-1 bg-surface rounded-lg">
            {[
              { id: 'country' as QuickImportType, label: 'By Country', icon: '🌍' },
              { id: 'category' as QuickImportType, label: 'By Category', icon: '📁' },
              { id: 'language' as QuickImportType, label: 'By Language', icon: '🗣️' },
              { id: 'region' as QuickImportType, label: 'By Region', icon: '🗺️' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setQuickImportTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  quickImportTab === tab.id
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Playlist Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-80 overflow-y-auto">
            {(quickImportTab === 'country' ? countryPlaylists :
              quickImportTab === 'category' ? categoryPlaylists :
              quickImportTab === 'language' ? languagePlaylists :
              regionPlaylists
            ).map((qp) => {
              const isImported = playlists.some((p) => p.url === qp.url);
              const isImporting = importingPlaylist === qp.url;

              return (
                <button
                  key={qp.url}
                  onClick={() => handleQuickImport(qp)}
                  disabled={isImported || isImporting}
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-all text-left ${
                    isImported
                      ? 'border-green-500/50 bg-green-500/10 cursor-default'
                      : isImporting
                      ? 'border-primary/50 bg-primary/10 cursor-wait'
                      : 'border-border hover:border-primary hover:bg-surface-hover cursor-pointer'
                  }`}
                >
                  <span className="text-xl">{qp.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isImported ? 'text-green-500' : 'text-text-primary'}`}>
                      {qp.name}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      {isImported ? 'Imported' : isImporting ? 'Importing...' : qp.description}
                    </p>
                  </div>
                  {isImported && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                  {isImporting && <RefreshCw className="w-4 h-4 text-primary animate-spin flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Playlists list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : playlists.length === 0 ? (
        <Card variant="bordered" padding="lg" className="text-center">
          <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-4">
            <Tv className="w-8 h-8 text-text-muted" />
          </div>
          <h3 className="text-lg font-medium text-text-primary mb-2">
            No playlists yet
          </h3>
          <p className="text-text-secondary mb-4">
            Add your first M3U playlist to start streaming
          </p>
          <Button onClick={() => setShowAddModal(true)}>
            Add Your First Playlist
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {playlists.map((playlist) => (
            <Card key={playlist.id} variant="bordered" padding="md">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <LinkIcon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-text-primary truncate">
                      {playlist.name}
                    </h3>
                    <Badge
                      variant={playlist.is_active ? 'success' : 'default'}
                      size="sm"
                    >
                      {playlist.is_active ? (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      ) : (
                        <XCircle className="w-3 h-3 mr-1" />
                      )}
                      {playlist.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-sm text-text-muted truncate">
                    {playlist.url || 'No URL'}
                  </p>
                  {playlist.last_synced && (
                    <p className="text-xs text-text-muted mt-1">
                      Last synced: {formatRelativeTime(playlist.last_synced)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSyncPlaylist(playlist)}
                    disabled={!playlist.url || isSyncing === playlist.id}
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${
                        isSyncing === playlist.id ? 'animate-spin' : ''
                      }`}
                    />
                  </Button>
                  <Dropdown
                    trigger={
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    }
                    items={[
                      { label: 'Edit', value: 'edit', icon: <Edit2 className="w-4 h-4" /> },
                      { label: 'Export', value: 'export', icon: <Download className="w-4 h-4" /> },
                      { label: 'Delete', value: 'delete', icon: <Trash2 className="w-4 h-4" />, danger: true },
                    ]}
                    onSelect={(value) => {
                      if (value === 'edit') {
                        openEditModal(playlist);
                      } else if (value === 'export') {
                        handleExportPlaylist(playlist);
                      } else if (value === 'delete') {
                        handleDeletePlaylist(playlist);
                      }
                    }}
                    align="right"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Playlist Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title="Add Playlist"
        description="Enter the details for your M3U/M3U8 playlist"
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
            <Button onClick={handleAddPlaylist} isLoading={isSubmitting}>
              Add Playlist
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Playlist Name"
            placeholder="My IPTV Playlist"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
          />
          <Input
            label="Playlist URL"
            placeholder="https://example.com/playlist.m3u8"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            hint="Enter the URL of your M3U or M3U8 playlist"
          />
        </div>
      </Modal>

      {/* Edit Playlist Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPlaylist(null);
          resetForm();
        }}
        title="Edit Playlist"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowEditModal(false);
                setSelectedPlaylist(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEditPlaylist} isLoading={isSubmitting}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Playlist Name"
            placeholder="My IPTV Playlist"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
          />
          <Input
            label="Playlist URL"
            placeholder="https://example.com/playlist.m3u8"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}
