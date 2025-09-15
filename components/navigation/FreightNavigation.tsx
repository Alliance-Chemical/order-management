'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  TruckIcon,
  BeakerIcon,
  LinkIcon,
  CubeIcon,
  HomeIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentCheckIcon,
  ArchiveBoxIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/solid';

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  color: string;
  bgColor: string;
  description?: string;
  external?: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: HomeIcon,
    color: 'text-gray-600 hover:text-gray-900',
    bgColor: 'hover:bg-gray-100'
  },
  {
    name: 'Book Freight',
    href: '/freight-booking',
    icon: TruckIcon,
    color: 'text-blue-600 hover:text-blue-700',
    bgColor: 'hover:bg-blue-50'
  },
  {
    name: 'Dilution Calculator',
    href: '/dilution-calculator',
    icon: BeakerIcon,
    color: 'text-cyan-600 hover:text-cyan-700',
    bgColor: 'hover:bg-cyan-50',
    description: 'Chemical dilution with safety protocols'
  },
  {
    name: 'Classifications',
    href: '/chemicals',
    icon: BeakerIcon,
    color: 'text-green-600 hover:text-green-700',
    bgColor: 'hover:bg-green-50'
  },
  {
    name: 'Products',
    href: '/products',
    icon: CubeIcon,
    color: 'text-purple-600 hover:text-purple-700',
    bgColor: 'hover:bg-purple-50'
  },
  {
    name: 'Containers',
    href: '/containers',
    icon: ArchiveBoxIcon,
    color: 'text-amber-600 hover:text-amber-700',
    bgColor: 'hover:bg-amber-50',
    description: 'Manage container types and materials'
  },
  {
    name: 'Link Products',
    href: '/link',
    icon: LinkIcon,
    color: 'text-orange-600 hover:text-orange-700',
    bgColor: 'hover:bg-orange-50',
    description: 'Critical for DOT compliance'
  },
  {
    name: 'Hazmat Chat',
    href: '/hazmat-chat',
    icon: ChatBubbleLeftRightIcon,
    color: 'text-indigo-600 hover:text-indigo-700',
    bgColor: 'hover:bg-indigo-50',
    description: 'AI-powered hazmat assistant'
  },
  {
    name: 'Hazmat Chatworld',
    href: '/hazmat-chatworld',
    icon: ChatBubbleLeftRightIcon,
    color: 'text-purple-600 hover:text-purple-700',
    bgColor: 'hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50',
    description: 'Premium GPT-5 nano assistant'
  },
  {
    name: 'Hazmat Orders',
    href: 'https://hazmat-three.vercel.app',
    icon: TruckIcon,
    color: 'text-red-600 hover:text-red-700',
    bgColor: 'hover:bg-red-50',
    description: 'Hazmat order management',
    external: true
  },
  {
    name: 'Warehouse Guide',
    href: '/warehouse-guide',
    icon: ClipboardDocumentCheckIcon,
    color: 'text-red-600 hover:text-red-700',
    bgColor: 'hover:bg-red-50',
    description: 'Quick reference for workers'
  }
];

interface FreightNavigationProps {
  className?: string;
  variant?: 'horizontal' | 'vertical';
}

export default function FreightNavigation({ 
  className = '', 
  variant = 'horizontal' 
}: FreightNavigationProps) {
  const pathname = usePathname();

  if (variant === 'vertical') {
    return (
      <nav aria-label="Primary" className={`space-y-2 ${className}`}>
        {navigationItems.map((item) => {
          const isActive = !item.external && (pathname === item.href || pathname?.startsWith(`${item.href}/`));
          const Icon = item.icon;
          
          return (
            <div key={item.name}>
              {item.external ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-blue-700' : 'text-gray-500'}`} />
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    {item.description && !isActive && (
                      <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                    )}
                  </div>
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400" />
                </a>
              ) : (
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-blue-700' : 'text-gray-500'}`} />
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    {item.description && !isActive && (
                      <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                    )}
                  </div>
                </Link>
              )}
            </div>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Primary" className={`flex items-center gap-1 overflow-x-auto ${className}`}>
      {navigationItems.map((item) => {
        const isActive = !item.external && (pathname === item.href || pathname?.startsWith(`${item.href}/`));
        const Icon = item.icon;

        const baseClasses = 'group inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white';
        const inactiveClasses = 'text-gray-600 hover:text-gray-900 hover:bg-gray-100';
        const activeClasses = 'bg-blue-600 text-white shadow-sm hover:bg-blue-600';

        return item.external ? (
          <a
            key={item.name}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            title={item.description}
            className={`${baseClasses} ${inactiveClasses}`}
          >
            <Icon className="h-4 w-4 opacity-80 group-hover:opacity-100" />
            <span className="font-medium">{item.name}</span>
            <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400" />
          </a>
        ) : (
          <Link
            key={item.name}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            title={item.description}
            className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
          >
            <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'opacity-80 group-hover:opacity-100'}`} />
            <span className="font-medium">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
