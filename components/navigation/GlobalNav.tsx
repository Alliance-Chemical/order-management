'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/', label: 'Work Queue' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/freight-orders', label: 'Freight Orders' },
  { href: '/archive', label: 'Archive' },
];

export function GlobalNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-sm font-semibold text-slate-900 tracking-wide">
          Alliance Chemical
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
          {links.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-2 transition-colors hover:bg-indigo-50 hover:text-indigo-700',
                  isActive ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600'
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
