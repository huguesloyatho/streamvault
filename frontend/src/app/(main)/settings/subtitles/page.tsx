'use client';

import { useState, useEffect } from 'react';
import {
  Subtitles,
  Languages,
  Download,
  Trash2,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Info,
  Globe,
  Mic,
  Settings2,
  Server,
  Loader2,
  Link,
  Unlink,
} from 'lucide-react';
import { Card, Button, Modal, toast } from '@/components/ui';

interface SubtitleSession {
  id: string;
  channel_id: string;
  status: string;
  language: string;
  target_lang: string;
  subtitle_count: number;
  started_at: string;
}

interface SubtitleLanguage {
  code: string;
  name: string;
}

const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090';

export default function SubtitleSettingsPage() {
  const [sessions, setSessions] = useState<SubtitleSession[]>([]);
  const [languages, setLanguages] = useState<SubtitleLanguage[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; message: string }>({
    available: false,
    message: '',
  });
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3.2');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingOllama, setIsSavingOllama] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Default settings
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [defaultTargetLanguage, setDefaultTargetLanguage] = useState('');
  const [autoStartSubtitles, setAutoStartSubtitles] = useState(false);
  const [subtitlePosition, setSubtitlePosition] = useState<'bottom' | 'top'>('bottom');
  const [subtitleFontSize, setSubtitleFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [subtitleBackground, setSubtitleBackground] = useState<'transparent' | 'semi' | 'solid'>('semi');

  useEffect(() => {
    loadData();
    loadSettings();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('pocketbase_auth');
    const authData = token ? JSON.parse(token) : null;
    return {
      'Content-Type': 'application/json',
      Authorization: authData?.token ? `Bearer ${authData.token}` : '',
    };
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchSessions(), fetchLanguages(), fetchOllamaConfig()]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettings = () => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('subtitle_settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setDefaultLanguage(settings.defaultLanguage || 'en');
      setDefaultTargetLanguage(settings.defaultTargetLanguage || '');
      setAutoStartSubtitles(settings.autoStartSubtitles || false);
      setSubtitlePosition(settings.subtitlePosition || 'bottom');
      setSubtitleFontSize(settings.subtitleFontSize || 'medium');
      setSubtitleBackground(settings.subtitleBackground || 'semi');
    }
  };

  const saveSettings = () => {
    const settings = {
      defaultLanguage,
      defaultTargetLanguage,
      autoStartSubtitles,
      subtitlePosition,
      subtitleFontSize,
      subtitleBackground,
    };
    localStorage.setItem('subtitle_settings', JSON.stringify(settings));
    toast.success('Settings saved');
  };

  const fetchSessions = async () => {
    try {
      const response = await fetch(`${POCKETBASE_URL}/api/subtitle/sessions`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  const fetchLanguages = async () => {
    try {
      const response = await fetch(`${POCKETBASE_URL}/api/subtitle/languages`);
      if (response.ok) {
        const data = await response.json();
        setLanguages(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch languages:', error);
    }
  };

  const fetchOllamaConfig = async () => {
    try {
      const response = await fetch(`${POCKETBASE_URL}/api/subtitle/ollama/config`);
      if (response.ok) {
        const data = await response.json();
        setOllamaUrl(data.url || 'http://localhost:11434');
        setOllamaModel(data.model || 'llama3.2');
        setOllamaStatus({ available: data.available, message: data.available ? 'Connected' : 'Not connected' });
        setAvailableModels(data.available_models || []);
      }
    } catch (error) {
      setOllamaStatus({ available: false, message: 'Failed to check status' });
    }
  };

  const testOllamaConnection = async () => {
    setIsTesting(true);
    try {
      const response = await fetch(`${POCKETBASE_URL}/api/subtitle/ollama/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ollamaUrl }),
      });
      if (response.ok) {
        const data = await response.json();
        setOllamaStatus({ available: data.available, message: data.message });
        if (data.available && data.models) {
          setAvailableModels(data.models);
          if (data.models.length > 0 && !data.models.includes(ollamaModel)) {
            setOllamaModel(data.models[0]);
          }
        }
        if (data.available) {
          toast.success('Connection successful!');
        } else {
          toast.error(data.message || 'Connection failed');
        }
      }
    } catch (error) {
      toast.error('Failed to test connection');
      setOllamaStatus({ available: false, message: 'Connection test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const saveOllamaConfig = async () => {
    setIsSavingOllama(true);
    try {
      const response = await fetch(`${POCKETBASE_URL}/api/subtitle/ollama/config`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ url: ollamaUrl, model: ollamaModel }),
      });
      if (response.ok) {
        const data = await response.json();
        setOllamaStatus({ available: data.available, message: data.message });
        toast.success('Ollama configuration saved');
      } else {
        toast.error('Failed to save configuration');
      }
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setIsSavingOllama(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    toast.success('Data refreshed');
  };

  const handleStopSession = async (sessionId: string) => {
    try {
      const response = await fetch(`${POCKETBASE_URL}/api/subtitle/stop`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (response.ok) {
        toast.success('Session stopped');
        fetchSessions();
      } else {
        toast.error('Failed to stop session');
      }
    } catch (error) {
      toast.error('Failed to stop session');
    }
  };

  const handleExportSRT = async (sessionId: string) => {
    try {
      const response = await fetch(`${POCKETBASE_URL}/api/subtitle/session/${sessionId}/download`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to export SRT');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `subtitles_${sessionId}.srt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('SRT file downloaded');
    } catch (error) {
      toast.error('Failed to export SRT');
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${POCKETBASE_URL}/api/subtitle/session/${sessionToDelete}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        toast.success('Session deleted');
        fetchSessions();
      } else {
        toast.error('Failed to delete session');
      }
    } catch (error) {
      toast.error('Failed to delete session');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSessionToDelete(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500/10 text-green-500';
      case 'stopped':
        return 'bg-gray-500/10 text-gray-500';
      case 'error':
        return 'bg-red-500/10 text-red-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Subtitle Settings</h1>
          <p className="text-text-secondary mt-1">
            Configure automatic subtitle generation and translation
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleRefresh}
          isLoading={isRefreshing}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh
        </Button>
      </div>

      {/* Ollama Configuration */}
      <Card variant="bordered" padding="lg" className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Server className="w-5 h-5" />
          Ollama Server Configuration
        </h2>

        <div className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
            <div className="flex items-center gap-3">
              {ollamaStatus.available ? (
                <Link className="w-5 h-5 text-green-500" />
              ) : (
                <Unlink className="w-5 h-5 text-yellow-500" />
              )}
              <div>
                <p className="font-medium text-text-primary">
                  {ollamaStatus.available ? 'Connected' : 'Not Connected'}
                </p>
                <p className="text-xs text-text-muted">{ollamaStatus.message}</p>
              </div>
            </div>
            <div
              className={`w-3 h-3 rounded-full ${
                ollamaStatus.available ? 'bg-green-500' : 'bg-yellow-500'
              }`}
            />
          </div>

          {/* Server URL */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Server URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button
                variant="secondary"
                onClick={testOllamaConnection}
                isLoading={isTesting}
              >
                Test
              </Button>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Enter the URL of your Ollama server (e.g., http://192.168.1.100:11434)
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Translation Model
            </label>
            {availableModels.length > 0 ? (
              <select
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                placeholder="llama3.2"
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
            <p className="text-xs text-text-muted mt-1">
              {availableModels.length > 0
                ? `${availableModels.length} model(s) available`
                : 'Connect to Ollama to see available models'}
            </p>
          </div>

          {/* Save Button */}
          <Button
            onClick={saveOllamaConfig}
            isLoading={isSavingOllama}
            leftIcon={<Check className="w-4 h-4" />}
          >
            Save Ollama Configuration
          </Button>

          {/* Info Box */}
          {!ollamaStatus.available && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-500">
                    Ollama not connected
                  </p>
                  <p className="text-xs text-text-secondary mt-1">
                    To enable real-time translation, install Ollama and start it with a translation model.
                  </p>
                  <a
                    href="https://ollama.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mt-2 inline-block"
                  >
                    Download Ollama →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Vosk Status */}
      <Card variant="bordered" padding="lg" className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Speech Recognition (Vosk)
        </h2>

        <div className="p-4 bg-surface rounded-lg">
          <div className="flex items-center gap-2 text-sm mb-2">
            <Check className="w-4 h-4 text-green-500" />
            <span className="text-green-500">Engine Ready</span>
          </div>
          <p className="text-sm text-text-secondary">
            Local speech-to-text engine for real-time transcription. Vosk models need to be
            installed for each language you want to transcribe.
          </p>
          <a
            href="https://alphacephei.com/vosk/models"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline mt-2 inline-block"
          >
            Download Vosk Models →
          </a>
        </div>
      </Card>

      {/* Default Settings */}
      <Card variant="bordered" padding="lg" className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Languages className="w-5 h-5" />
          Default Settings
        </h2>

        <div className="space-y-6">
          {/* Language Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Default Audio Language
              </label>
              <select
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-muted mt-1">
                Language spoken in the stream
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Default Translation Language
              </label>
              <select
                value={defaultTargetLanguage}
                onChange={(e) => setDefaultTargetLanguage(e.target.value)}
                disabled={!ollamaStatus.available}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              >
                <option value="">No translation</option>
                {languages
                  .filter((lang) => lang.code !== defaultLanguage)
                  .map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-text-muted mt-1">
                Translate subtitles to this language
              </p>
            </div>
          </div>

          {/* Display Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Position
              </label>
              <select
                value={subtitlePosition}
                onChange={(e) => setSubtitlePosition(e.target.value as 'bottom' | 'top')}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="bottom">Bottom</option>
                <option value="top">Top</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Font Size
              </label>
              <select
                value={subtitleFontSize}
                onChange={(e) => setSubtitleFontSize(e.target.value as 'small' | 'medium' | 'large')}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Background
              </label>
              <select
                value={subtitleBackground}
                onChange={(e) => setSubtitleBackground(e.target.value as 'transparent' | 'semi' | 'solid')}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="transparent">Transparent</option>
                <option value="semi">Semi-transparent</option>
                <option value="solid">Solid</option>
              </select>
            </div>
          </div>

          {/* Auto-start option */}
          <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
            <div>
              <p className="font-medium text-text-primary">Auto-start Subtitles</p>
              <p className="text-sm text-text-secondary">
                Automatically start subtitle generation when playing a channel
              </p>
            </div>
            <button
              onClick={() => setAutoStartSubtitles(!autoStartSubtitles)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                autoStartSubtitles ? 'bg-primary' : 'bg-surface-hover'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  autoStartSubtitles ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <Button onClick={saveSettings} leftIcon={<Check className="w-4 h-4" />}>
            Save Settings
          </Button>
        </div>
      </Card>

      {/* Active Sessions */}
      <Card variant="bordered" padding="lg" className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Subtitles className="w-5 h-5" />
          Subtitle Sessions
          {sessions.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
              {sessions.length}
            </span>
          )}
        </h2>

        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 text-text-muted animate-spin mx-auto mb-2" />
            <p className="text-text-muted">Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8">
            <Subtitles className="w-12 h-12 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary mb-1">No active subtitle sessions</p>
            <p className="text-sm text-text-muted">
              Start subtitles from the video player to see sessions here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="p-4 bg-surface rounded-lg border border-border"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-text-primary font-mono text-sm">
                      {session.id}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      Channel: {session.channel_id}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(session.status)}`}
                  >
                    {session.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                  <div>
                    <p className="text-text-muted">Language</p>
                    <p className="text-text-primary">
                      {languages.find((l) => l.code === session.language)?.name || session.language}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted">Translation</p>
                    <p className="text-text-primary">
                      {session.target_lang
                        ? languages.find((l) => l.code === session.target_lang)?.name || session.target_lang
                        : 'None'}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted">Subtitles</p>
                    <p className="text-text-primary">{session.subtitle_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Started</p>
                    <p className="text-text-primary">{formatDate(session.started_at)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {session.status === 'running' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleStopSession(session.id)}
                    >
                      Stop
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleExportSRT(session.id)}
                    leftIcon={<Download className="w-4 h-4" />}
                  >
                    Export SRT
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSessionToDelete(session.id);
                      setShowDeleteModal(true);
                    }}
                    className="text-red-500 hover:bg-red-500/10"
                    leftIcon={<Trash2 className="w-4 h-4" />}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Requirements Info */}
      <Card variant="bordered" padding="lg">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Info className="w-5 h-5" />
          Requirements
        </h2>

        <div className="space-y-4">
          <div className="p-4 bg-surface rounded-lg">
            <h3 className="font-medium text-text-primary mb-2">FFmpeg</h3>
            <p className="text-sm text-text-secondary mb-2">
              Required for extracting audio from video streams.
            </p>
            <code className="block text-xs bg-background-secondary p-2 rounded text-text-muted">
              brew install ffmpeg
            </code>
          </div>

          <div className="p-4 bg-surface rounded-lg">
            <h3 className="font-medium text-text-primary mb-2">Vosk Models</h3>
            <p className="text-sm text-text-secondary mb-2">
              Download language models for speech recognition.
            </p>
            <a
              href="https://alphacephei.com/vosk/models"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Download Vosk Models →
            </a>
          </div>

          <div className="p-4 bg-surface rounded-lg">
            <h3 className="font-medium text-text-primary mb-2">Ollama (Optional)</h3>
            <p className="text-sm text-text-secondary mb-2">
              Install Ollama for real-time translation support.
            </p>
            <a
              href="https://ollama.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Install Ollama →
            </a>
          </div>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSessionToDelete(null);
        }}
        title="Delete Session"
        description="Are you sure you want to delete this subtitle session? This action cannot be undone."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setSessionToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDeleteSession}
              isLoading={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </Button>
          </>
        }
      >
        <div className="p-4 bg-red-500/10 rounded-lg">
          <p className="text-sm text-red-500">
            This will permanently delete the session and all associated subtitle data.
          </p>
        </div>
      </Modal>
    </div>
  );
}
