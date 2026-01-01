'use client';

import { useState, useEffect } from 'react';
import {
  Subtitles,
  Languages,
  Download,
  Settings2,
  Check,
  X,
  Globe,
  Clock,
} from 'lucide-react';
import { Button, Modal, toast } from '@/components/ui';
import { cn } from '@/lib/utils';

interface SubtitleLanguage {
  code: string;
  name: string;
}

interface SubtitleControlsProps {
  channelId: string;
  streamUrl: string;
  onSessionChange: (sessionId: string | null) => void;
  onEnabledChange: (enabled: boolean) => void;
  enabled: boolean;
  className?: string;
}

const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090';

export function SubtitleControls({
  channelId,
  streamUrl,
  onSessionChange,
  onEnabledChange,
  enabled,
  className,
}: SubtitleControlsProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<string>('stopped');

  // Settings
  const [languages, setLanguages] = useState<SubtitleLanguage[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [translateToFrench, setTranslateToFrench] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);

  // Processing time info (for display only)
  const [avgProcessingTime, setAvgProcessingTime] = useState<number | null>(null);

  // Load available languages on mount
  useEffect(() => {
    fetchLanguages();
  }, []);

  // Reload Ollama status when modal opens
  useEffect(() => {
    if (showSettings) {
      checkOllamaStatus();
    }
  }, [showSettings]);

  // Fetch session info to get processing time (for info display)
  useEffect(() => {
    if (!sessionId || sessionStatus !== 'running') return;

    const fetchProcessingTime = async () => {
      try {
        const response = await fetch(
          `${POCKETBASE_URL}/api/subtitle/session/${sessionId}`,
          { headers: getAuthHeaders() }
        );
        if (response.ok) {
          const data = await response.json();
          if (data.avg_processing_time && data.avg_processing_time > 0) {
            setAvgProcessingTime(data.avg_processing_time);
          }
        }
      } catch {
        // Ignore errors
      }
    };

    // Fetch immediately and then every 10 seconds
    fetchProcessingTime();
    const interval = setInterval(fetchProcessingTime, 10000);
    return () => clearInterval(interval);
  }, [sessionId, sessionStatus]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('pocketbase_auth');
    const authData = token ? JSON.parse(token) : null;
    return {
      'Content-Type': 'application/json',
      Authorization: authData?.token ? `Bearer ${authData.token}` : '',
    };
  };

  const fetchLanguages = async () => {
    try {
      const response = await fetch(`${POCKETBASE_URL}/api/subtitle/languages`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          setLanguages(data);
        } else {
          setLanguages([
            { code: 'en', name: 'English' },
            { code: 'fr', name: 'Français' },
            { code: 'de', name: 'German' },
            { code: 'es', name: 'Spanish' },
            { code: 'it', name: 'Italian' },
            { code: 'pt', name: 'Portuguese' },
            { code: 'ru', name: 'Russian' },
            { code: 'zh', name: 'Chinese' },
            { code: 'ja', name: 'Japanese' },
            { code: 'ko', name: 'Korean' },
            { code: 'ar', name: 'Arabic' },
          ]);
        }
      }
    } catch {
      setLanguages([
        { code: 'en', name: 'English' },
        { code: 'fr', name: 'Français' },
        { code: 'de', name: 'German' },
        { code: 'es', name: 'Spanish' },
        { code: 'it', name: 'Italian' },
      ]);
    }
  };

  const checkOllamaStatus = async () => {
    try {
      const response = await fetch(`${POCKETBASE_URL}/api/subtitle/ollama/status`);
      if (response.ok) {
        const data = await response.json();
        setOllamaAvailable(data.available);
      }
    } catch {
      setOllamaAvailable(false);
    }
  };

  const startSubtitles = async () => {
    if (!channelId || !streamUrl) return;

    setIsStarting(true);
    try {
      const newSessionId = `sub_${channelId}_${Date.now()}`;

      const shouldTranslate = translateToFrench && selectedLanguage !== 'fr' && ollamaAvailable;

      const response = await fetch(`${POCKETBASE_URL}/api/subtitle/start`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          session_id: newSessionId,
          channel_id: channelId,
          stream_url: streamUrl,
          language: selectedLanguage,
          target_lang: shouldTranslate ? 'fr' : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start subtitles');
      }

      const data = await response.json();
      setSessionId(data.session_id);
      setSessionStatus('running');
      onSessionChange(data.session_id);
      onEnabledChange(true);

      if (shouldTranslate) {
        toast.success('Sous-titres démarrés avec traduction française');
      } else if (selectedLanguage === 'fr') {
        toast.success('Sous-titres français démarrés');
      } else {
        toast.success(`Sous-titres démarrés (${languages.find(l => l.code === selectedLanguage)?.name || selectedLanguage})`);
      }
    } catch (error) {
      toast.error((error as Error).message || 'Failed to start subtitles');
    } finally {
      setIsStarting(false);
    }
  };

  const stopSubtitles = async () => {
    if (!sessionId) return;

    setIsStopping(true);
    try {
      const response = await fetch(`${POCKETBASE_URL}/api/subtitle/stop`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to stop subtitles');
      }

      setSessionStatus('stopped');
      onEnabledChange(false);
      toast.success('Sous-titres arrêtés');
    } catch {
      toast.error('Erreur lors de l\'arrêt des sous-titres');
    } finally {
      setIsStopping(false);
    }
  };

  const exportSRT = async () => {
    if (!sessionId) return;

    setIsExporting(true);
    try {
      const response = await fetch(
        `${POCKETBASE_URL}/api/subtitle/session/${sessionId}/download`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export SRT');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `subtitles_${channelId}.srt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Fichier SRT téléchargé');
    } catch {
      toast.error('Erreur lors de l\'export SRT');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleSubtitles = () => {
    if (enabled) {
      onEnabledChange(false);
    } else if (sessionId && sessionStatus === 'running') {
      onEnabledChange(true);
    } else {
      setShowSettings(true);
    }
  };

  const isSourceFrench = selectedLanguage === 'fr';

  return (
    <>
      {/* Subtitle Toggle Button */}
      <button
        onClick={toggleSubtitles}
        className={cn(
          'p-2 rounded-lg transition-colors',
          enabled
            ? 'bg-primary/20 text-primary'
            : 'text-white/70 hover:text-white hover:bg-white/10',
          className
        )}
        title={enabled ? 'Masquer les sous-titres' : 'Afficher les sous-titres'}
      >
        <Subtitles className="w-5 h-5" />
      </button>

      {/* Settings Button */}
      <button
        onClick={() => setShowSettings(true)}
        className={cn(
          'p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors',
          className
        )}
        title="Paramètres des sous-titres"
      >
        <Settings2 className="w-5 h-5" />
      </button>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Sous-titres automatiques"
        description="Reconnaissance vocale et traduction en temps réel"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowSettings(false)}>
              Fermer
            </Button>
            {sessionId && sessionStatus === 'running' && (
              <Button
                variant="secondary"
                onClick={exportSRT}
                isLoading={isExporting}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Exporter SRT
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-6">
          {/* Session Status */}
          <div className="p-4 bg-surface rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">
                Statut
              </span>
              <span
                className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-full',
                  sessionStatus === 'running'
                    ? 'bg-green-500/10 text-green-500'
                    : sessionStatus === 'error'
                    ? 'bg-red-500/10 text-red-500'
                    : 'bg-surface-hover text-text-muted'
                )}
              >
                {sessionStatus === 'running'
                  ? 'Actif'
                  : sessionStatus === 'error'
                  ? 'Erreur'
                  : 'Inactif'}
              </span>
            </div>
            {sessionId && (
              <p className="text-xs text-text-muted font-mono truncate">
                Session: {sessionId}
              </p>
            )}
            {/* Translation status indicator */}
            {sessionStatus === 'running' && (
              <div className="mt-2 pt-2 border-t border-border">
                <div className="flex items-center gap-2 text-xs">
                  <Globe className="w-3 h-3" />
                  <span className="text-text-secondary">
                    {translateToFrench && selectedLanguage !== 'fr' && ollamaAvailable
                      ? 'Traduction FR activée'
                      : selectedLanguage === 'fr'
                      ? 'Source française (pas de traduction)'
                      : 'Sans traduction'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Ollama Status Warning */}
          {!ollamaAvailable && !isSourceFrench && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Globe className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-500">
                    Traduction non disponible
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    Ollama n&apos;est pas connecté. Configurez-le dans Paramètres → Sous-titres pour activer la traduction française.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Source Language */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              <Languages className="w-4 h-4 inline mr-2" />
              Langue audio du flux
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => {
                setSelectedLanguage(e.target.value);
                if (e.target.value === 'fr') {
                  setTranslateToFrench(false);
                }
              }}
              disabled={sessionStatus === 'running'}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-muted mt-1">
              Sélectionnez la langue parlée dans le flux
            </p>
          </div>

          {/* Processing Time Info */}
          {sessionStatus === 'running' && avgProcessingTime !== null && (
            <div className="p-3 bg-surface rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-text-secondary" />
                <span className="text-text-secondary">Temps de traitement :</span>
                <span className="text-primary font-mono">
                  {(avgProcessingTime / 1000).toFixed(1)}s
                </span>
              </div>
              <p className="text-xs text-text-muted mt-2">
                Les sous-titres s&apos;affichent dès réception. Le délai affiché
                correspond au temps de reconnaissance vocale + traduction.
              </p>
            </div>
          )}

          {/* Translation Option - Only show if source is NOT French */}
          {!isSourceFrench && (
            <div className="p-4 bg-surface rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-text-secondary" />
                  <span className="text-sm font-medium text-text-primary">
                    Traduire en français
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={translateToFrench}
                    onChange={(e) => setTranslateToFrench(e.target.checked)}
                    disabled={sessionStatus === 'running' || !ollamaAvailable}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-hover peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                </label>
              </div>

              {/* Ollama Status */}
              <div className="flex items-center gap-2 text-xs">
                {ollamaAvailable ? (
                  <>
                    <Check className="w-3 h-3 text-green-500" />
                    <span className="text-green-500">Ollama connecté - traduction disponible</span>
                  </>
                ) : (
                  <>
                    <X className="w-3 h-3 text-yellow-500" />
                    <span className="text-yellow-500">
                      Ollama non connecté - configurez-le dans Paramètres → Sous-titres
                    </span>
                  </>
                )}
              </div>

              {translateToFrench && ollamaAvailable && (
                <p className="text-xs text-text-muted">
                  Les sous-titres seront traduits en français via Ollama
                </p>
              )}
            </div>
          )}

          {/* French Source Info */}
          {isSourceFrench && (
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <p className="text-sm text-blue-400">
                Les sous-titres seront générés directement en français (pas de traduction nécessaire)
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {sessionStatus !== 'running' ? (
              <Button
                onClick={startSubtitles}
                isLoading={isStarting}
                leftIcon={<Subtitles className="w-4 h-4" />}
                className="flex-1"
              >
                {isSourceFrench
                  ? 'Démarrer les sous-titres'
                  : translateToFrench && ollamaAvailable
                  ? 'Démarrer avec traduction FR'
                  : 'Démarrer les sous-titres'}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={stopSubtitles}
                isLoading={isStopping}
                className="flex-1 text-red-500 border-red-500/30 hover:bg-red-500/10"
              >
                Arrêter les sous-titres
              </Button>
            )}
          </div>

          {/* Info */}
          <div className="p-3 bg-surface-hover rounded-lg text-xs text-text-muted">
            <p className="mb-2">
              <strong>Fonctionnement :</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Sous-titres automatiques dans la langue du flux</li>
              <li>Délai ajustable pour synchroniser avec la vidéo</li>
              <li>Traduction française optionnelle (nécessite Ollama)</li>
              <li>Export SRT disponible après génération</li>
            </ul>
          </div>
        </div>
      </Modal>
    </>
  );
}
