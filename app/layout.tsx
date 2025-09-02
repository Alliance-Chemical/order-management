import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { MonitoringStatus } from '@/components/MonitoringStatus';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Toaster } from '@/components/ui/toaster';
import { FreightAlertProvider } from '@/providers/FreightAlertProvider';
import { FreightAlertBadge } from '@/components/ui/freight-alert-badge';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Alliance Chemical - QR Workspace System',
  description: 'Digital workspace management for freight orders',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'QR Workspace',
  },
};

export const viewport: Viewport = {
  themeColor: '#3B82F6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          <FreightAlertProvider>
            {children}
            <MonitoringStatus />
            <FreightAlertBadge />
            <Toaster />
          </FreightAlertProvider>
        </QueryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}