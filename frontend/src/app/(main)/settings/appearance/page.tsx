'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sun, Moon, Monitor, Palette, Type, Layout, Check } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';
type AccentColor = 'red' | 'blue' | 'green' | 'purple' | 'orange';

const themes: { id: Theme; label: string; icon: React.ElementType }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

const accentColors: { id: AccentColor; label: string; color: string }[] = [
  { id: 'red', label: 'Red', color: 'bg-red-500' },
  { id: 'blue', label: 'Blue', color: 'bg-blue-500' },
  { id: 'green', label: 'Green', color: 'bg-green-500' },
  { id: 'purple', label: 'Purple', color: 'bg-purple-500' },
  { id: 'orange', label: 'Orange', color: 'bg-orange-500' },
];

const fontSizes = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
];

export default function AppearanceSettingsPage() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [accentColor, setAccentColor] = useState<AccentColor>('red');
  const [fontSize, setFontSize] = useState('medium');
  const [compactMode, setCompactMode] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

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
          <h1 className="text-2xl font-bold text-text-primary">Appearance</h1>
          <p className="text-sm text-text-secondary">Customize the app appearance</p>
        </div>
      </div>

      {/* Theme Selection */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">Theme</h2>
      <div className="grid grid-cols-3 gap-3 mb-8">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
              theme === t.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 bg-surface'
            )}
          >
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                theme === t.id ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary'
              )}
            >
              <t.icon className="w-6 h-6" />
            </div>
            <span
              className={cn(
                'text-sm font-medium',
                theme === t.id ? 'text-primary' : 'text-text-secondary'
              )}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>

      {/* Accent Color */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">Accent Color</h2>
      <Card variant="bordered" padding="md" className="mb-8">
        <div className="flex items-center gap-3">
          <Palette className="w-5 h-5 text-text-secondary" />
          <span className="text-text-primary flex-1">Primary color</span>
          <div className="flex gap-2">
            {accentColors.map((color) => (
              <button
                key={color.id}
                onClick={() => setAccentColor(color.id)}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-transform',
                  color.color,
                  accentColor === color.id ? 'scale-110 ring-2 ring-offset-2 ring-offset-background ring-white/50' : 'hover:scale-105'
                )}
                title={color.label}
              >
                {accentColor === color.id && <Check className="w-4 h-4 text-white" />}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Font Size */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">Font Size</h2>
      <Card variant="bordered" padding="md" className="mb-8">
        <div className="flex items-center gap-3">
          <Type className="w-5 h-5 text-text-secondary" />
          <span className="text-text-primary flex-1">Text size</span>
          <div className="flex bg-surface-hover rounded-lg p-1">
            {fontSizes.map((size) => (
              <button
                key={size.id}
                onClick={() => setFontSize(size.id)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  fontSize === size.id
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Layout Options */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">Layout</h2>
      <div className="space-y-3">
        <Card variant="bordered" padding="md">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center">
              <Layout className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-medium text-text-primary">Compact mode</h3>
              <p className="text-sm text-text-secondary">Use smaller spacing and elements</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={compactMode}
                onChange={() => setCompactMode(!compactMode)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-hover peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </Card>

        <Card variant="bordered" padding="md">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center">
              <svg className="w-5 h-5 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v18M3 12h18" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-medium text-text-primary">Animations</h3>
              <p className="text-sm text-text-secondary">Enable smooth transitions and animations</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={animationsEnabled}
                onChange={() => setAnimationsEnabled(!animationsEnabled)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-hover peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </Card>
      </div>

      {/* Preview notice */}
      <p className="text-sm text-text-muted mt-6 text-center">
        Theme changes will be applied immediately. Some settings may require a page refresh.
      </p>
    </div>
  );
}
