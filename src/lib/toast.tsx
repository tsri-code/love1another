'use client';

import { createContext, useContext, useState, useCallback } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type']) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ 
  toasts, 
  onDismiss 
}: { 
  toasts: Toast[]; 
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center pointer-events-none"
      style={{ padding: 'var(--space-lg)', paddingBottom: 'var(--space-xl)', gap: 'var(--space-sm)' }}
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            pointer-events-auto cursor-pointer
            flex items-center shadow-xl animate-slide-in
            ${toast.type === 'success' ? 'bg-[var(--success)]' : ''}
            ${toast.type === 'error' ? 'bg-[var(--error)]' : ''}
            ${toast.type === 'info' ? 'bg-[var(--surface-primary)] border border-[var(--border-light)]' : ''}
          `}
          style={{
            padding: 'var(--space-md) var(--space-lg)',
            borderRadius: 'var(--radius-lg)',
            gap: 'var(--space-sm)',
            minWidth: '200px',
            maxWidth: '400px',
          }}
          onClick={() => onDismiss(toast.id)}
        >
          {toast.type === 'success' && (
            <div 
              className="flex items-center justify-center rounded-full bg-white bg-opacity-20"
              style={{ width: '24px', height: '24px', flexShrink: 0 }}
            >
              <svg className="text-white" style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {toast.type === 'error' && (
            <div 
              className="flex items-center justify-center rounded-full bg-white bg-opacity-20"
              style={{ width: '24px', height: '24px', flexShrink: 0 }}
            >
              <svg className="text-white" style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
          {toast.type === 'info' && (
            <div 
              className="flex items-center justify-center rounded-full bg-[var(--accent-primary-light)]"
              style={{ width: '24px', height: '24px', flexShrink: 0 }}
            >
              <svg className="text-[var(--accent-primary)]" style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
          <span 
            className={`font-medium ${toast.type === 'info' ? 'text-[var(--text-primary)]' : 'text-white'}`}
            style={{ fontSize: 'var(--text-base)', lineHeight: '1.4' }}
          >
            {toast.message}
          </span>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
