'use client';

import React from 'react';

interface PreShipInspectionItemProps {
  icon: string;
  label: string;
  orderId: string;
}

export function PreShipInspectionItem({ icon, label, orderId }: PreShipInspectionItemProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="text-8xl mb-6 animate-bounce-subtle">{icon}</div>
      <h1 className="text-4xl font-bold text-white text-center mb-12">
        {label}
      </h1>
      <p className="text-xl text-gray-400">Order #{orderId}</p>
    </div>
  );
}