'use client';

import { HelpCircle } from 'lucide-react';

interface HelpButtonProps {
  onClick: () => void;
  label?: string;
}

export function HelpButton({ onClick, label = 'Need Help?' }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 bg-orange-500 hover:bg-orange-600 text-white rounded-full p-4 shadow-2xl flex items-center gap-3 transition-all hover:scale-105 z-40"
    >
      <HelpCircle className="w-8 h-8" />
      <span className="text-lg font-bold pr-2">{label}</span>
    </button>
  );
}