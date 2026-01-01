'use client';

import { Toaster, toast as hotToast } from 'react-hot-toast';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      gutter={12}
      containerStyle={{
        top: 80,
      }}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1F1F1F',
          color: '#FFFFFF',
          border: '1px solid #333333',
          borderRadius: '8px',
          padding: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.8)',
        },
      }}
    />
  );
}

interface ToastOptions {
  duration?: number;
  id?: string;
}

export const toast = {
  success: (message: string, options?: ToastOptions) => {
    return hotToast.custom(
      (t) => (
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-3 bg-background-secondary border border-border rounded-lg shadow-card max-w-md',
            t.visible ? 'animate-slide-left' : 'animate-fade-out'
          )}
        >
          <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
          <p className="text-sm text-text-primary flex-1">{message}</p>
          <button
            onClick={() => hotToast.dismiss(t.id)}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ),
      options
    );
  },

  error: (message: string, options?: ToastOptions) => {
    return hotToast.custom(
      (t) => (
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-3 bg-background-secondary border border-error/50 rounded-lg shadow-card max-w-md',
            t.visible ? 'animate-slide-left' : 'animate-fade-out'
          )}
        >
          <XCircle className="w-5 h-5 text-error flex-shrink-0" />
          <p className="text-sm text-text-primary flex-1">{message}</p>
          <button
            onClick={() => hotToast.dismiss(t.id)}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ),
      { duration: 5000, ...options }
    );
  },

  warning: (message: string, options?: ToastOptions) => {
    return hotToast.custom(
      (t) => (
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-3 bg-background-secondary border border-warning/50 rounded-lg shadow-card max-w-md',
            t.visible ? 'animate-slide-left' : 'animate-fade-out'
          )}
        >
          <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
          <p className="text-sm text-text-primary flex-1">{message}</p>
          <button
            onClick={() => hotToast.dismiss(t.id)}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ),
      options
    );
  },

  info: (message: string, options?: ToastOptions) => {
    return hotToast.custom(
      (t) => (
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-3 bg-background-secondary border border-info/50 rounded-lg shadow-card max-w-md',
            t.visible ? 'animate-slide-left' : 'animate-fade-out'
          )}
        >
          <Info className="w-5 h-5 text-info flex-shrink-0" />
          <p className="text-sm text-text-primary flex-1">{message}</p>
          <button
            onClick={() => hotToast.dismiss(t.id)}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ),
      options
    );
  },

  loading: (message: string, options?: ToastOptions) => {
    return hotToast.loading(message, {
      style: {
        background: '#1F1F1F',
        color: '#FFFFFF',
        border: '1px solid #333333',
      },
      ...options,
    });
  },

  dismiss: (id?: string) => {
    hotToast.dismiss(id);
  },

  promise: <T,>(
    promise: Promise<T>,
    msgs: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: Error) => string);
    }
  ) => {
    return hotToast.promise(promise, msgs, {
      style: {
        background: '#1F1F1F',
        color: '#FFFFFF',
        border: '1px solid #333333',
      },
    });
  },
};
