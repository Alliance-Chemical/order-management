'use client';

import { useEffect } from 'react';

interface AutoCloseToastProps {
  children: React.ReactNode;
  onClose?: () => void;
  duration?: number;
}

export default function AutoCloseToast({
  children,
  onClose,
  duration = 3000,
}: AutoCloseToastProps) {
  useEffect(() => {
    if (!onClose) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      onClose();
    }, duration);

    return () => window.clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50">
      {children}
    </div>
  );
}
