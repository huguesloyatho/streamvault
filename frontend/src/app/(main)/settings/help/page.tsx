'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  HelpCircle,
  Book,
  MessageCircle,
  Bug,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Mail,
  Github,
  FileText,
  Keyboard,
} from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface FAQ {
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    question: 'How do I add a playlist?',
    answer:
      'Go to Settings > Playlists and click "Add Playlist". You can either paste an M3U URL or upload an M3U file from your device. The app will automatically parse and import all channels.',
  },
  {
    question: 'Why is my stream not playing?',
    answer:
      'This could be due to several reasons: the stream URL might be expired, your internet connection might be unstable, or the stream format might not be supported. Try refreshing the page or checking the stream URL in your playlist.',
  },
  {
    question: 'How do I record a channel?',
    answer:
      'While watching a channel, click the record button (red circle) in the video controls. The recording will be saved to your device. You can view all recordings in the Recordings section.',
  },
  {
    question: 'Can I use Picture-in-Picture mode?',
    answer:
      'Yes! When watching a channel, navigate to another page and the video will automatically switch to a mini player in the corner. You can drag it around, pause, or close it at any time.',
  },
  {
    question: 'How do I enable two-factor authentication?',
    answer:
      'Go to Settings > Security and click "Enable 2FA". You\'ll need an authenticator app like Google Authenticator or Authy to scan the QR code and generate verification codes.',
  },
  {
    question: 'What video formats are supported?',
    answer:
      'StreamVault supports HLS (m3u8), MPEG-TS, and most common streaming formats. If a stream doesn\'t play, it might be using an unsupported codec or DRM protection.',
  },
];

const shortcuts = [
  { keys: ['Space'], action: 'Play / Pause' },
  { keys: ['F'], action: 'Toggle fullscreen' },
  { keys: ['M'], action: 'Mute / Unmute' },
  { keys: ['←', '→'], action: 'Seek backward / forward' },
  { keys: ['↑', '↓'], action: 'Volume up / down' },
  { keys: ['Esc'], action: 'Exit fullscreen' },
];

export default function HelpSettingsPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
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
          <h1 className="text-2xl font-bold text-text-primary">Help & Support</h1>
          <p className="text-sm text-text-secondary">Get help and find answers</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <Card variant="bordered" padding="md" hover className="cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Book className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-text-primary">Documentation</h3>
              <p className="text-xs text-text-secondary">Read the guides</p>
            </div>
          </div>
        </Card>

        <Card variant="bordered" padding="md" hover className="cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="font-medium text-text-primary">Contact Support</h3>
              <p className="text-xs text-text-secondary">Get in touch</p>
            </div>
          </div>
        </Card>

        <Card variant="bordered" padding="md" hover className="cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Bug className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="font-medium text-text-primary">Report a Bug</h3>
              <p className="text-xs text-text-secondary">Help us improve</p>
            </div>
          </div>
        </Card>

        <Card variant="bordered" padding="md" hover className="cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-medium text-text-primary">Release Notes</h3>
              <p className="text-xs text-text-secondary">What's new</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Keyboard Shortcuts */}
      <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
        <Keyboard className="w-5 h-5" />
        Keyboard Shortcuts
      </h2>
      <Card variant="bordered" padding="md" className="mb-8">
        <div className="space-y-3">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <span className="text-text-secondary">{shortcut.action}</span>
              <div className="flex gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="px-2 py-1 text-xs font-mono bg-surface-hover border border-border rounded text-text-primary"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* FAQ */}
      <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
        <HelpCircle className="w-5 h-5" />
        Frequently Asked Questions
      </h2>
      <div className="space-y-2 mb-8">
        {faqs.map((faq, index) => (
          <Card key={index} variant="bordered" padding="none">
            <button
              onClick={() => toggleFaq(index)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="font-medium text-text-primary pr-4">{faq.question}</span>
              {expandedFaq === index ? (
                <ChevronUp className="w-5 h-5 text-text-muted flex-shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-text-muted flex-shrink-0" />
              )}
            </button>
            <div
              className={cn(
                'overflow-hidden transition-all duration-200',
                expandedFaq === index ? 'max-h-96' : 'max-h-0'
              )}
            >
              <p className="px-4 pb-4 text-text-secondary">{faq.answer}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Contact */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">Still need help?</h2>
      <Card variant="bordered" padding="lg">
        <div className="text-center">
          <p className="text-text-secondary mb-4">
            Can't find what you're looking for? Our support team is here to help.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" leftIcon={<Mail className="w-4 h-4" />}>
              Email Support
            </Button>
            <Button variant="secondary" leftIcon={<Github className="w-4 h-4" />}>
              GitHub Issues
            </Button>
          </div>
        </div>
      </Card>

      {/* Version */}
      <p className="text-center text-text-muted text-sm mt-8">
        StreamVault v1.0.0 • Made with love
      </p>
    </div>
  );
}
