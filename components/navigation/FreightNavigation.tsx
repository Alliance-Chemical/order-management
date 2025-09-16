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
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/solid';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  color: string;
  bgColor: string;
  description?: string;
  external?: boolean;
  section: 'primary' | 'tools';
}

const navigationItems: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: HomeIcon,
    color: 'text-gray-600 hover:text-gray-900',
    bgColor: 'hover:bg-gray-100',
    section: 'primary'
  },
  {
    name: 'Book Freight',
    href: '/freight-booking',
    icon: TruckIcon,
    color: 'text-blue-600 hover:text-blue-700',
    bgColor: 'hover:bg-blue-50',
    section: 'primary'
  },
  {
    name: 'Dilution Calculator',
    href: '/dilution-calculator',
    icon: BeakerIcon,
    color: 'text-cyan-600 hover:text-cyan-700',
    bgColor: 'hover:bg-cyan-50',
    description: 'Chemical dilution with safety protocols',
    section: 'primary'
  },
  {
    name: 'Classifications',
    href: '/chemicals',
    icon: BeakerIcon,
    color: 'text-green-600 hover:text-green-700',
    bgColor: 'hover:bg-green-50',
    section: 'primary'
  },
  {
    name: 'Products',
    href: '/products',
    icon: CubeIcon,
    color: 'text-purple-600 hover:text-purple-700',
    bgColor: 'hover:bg-purple-50',
    section: 'primary'
  },
  {
    name: 'Containers',
    href: '/containers',
    icon: ArchiveBoxIcon,
    color: 'text-amber-600 hover:text-amber-700',
    bgColor: 'hover:bg-amber-50',
    description: 'Manage container types and materials',
    section: 'tools'
  },
  {
    name: 'Link Products',
    href: '/link',
    icon: LinkIcon,
    color: 'text-orange-600 hover:text-orange-700',
    bgColor: 'hover:bg-orange-50',
    description: 'Critical for DOT compliance',
    section: 'tools'
  },
  {
    name: 'Hazmat Chat',
    href: '/hazmat-chat',
    icon: ChatBubbleLeftRightIcon,
    color: 'text-indigo-600 hover:text-indigo-700',
    bgColor: 'hover:bg-indigo-50',
    description: 'AI-powered hazmat assistant',
    section: 'tools'
  },
  {
    name: 'Hazmat Chatworld',
    href: '/hazmat-chatworld',
    icon: ChatBubbleLeftRightIcon,
    color: 'text-purple-600 hover:text-purple-700',
    bgColor: 'hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50',
    description: 'Premium GPT-5 nano assistant',
    section: 'tools'
  },
  {
    name: 'Hazmat Orders',
    href: 'https://hazmat-three.vercel.app',
    icon: TruckIcon,
    color: 'text-red-600 hover:text-red-700',
    bgColor: 'hover:bg-red-50',
    description: 'Hazmat order management',
    external: true,
    section: 'tools'
  },
  {
    name: 'Warehouse Guide',
    href: '/warehouse-guide',
    icon: ClipboardDocumentCheckIcon,
    color: 'text-red-600 hover:text-red-700',
    bgColor: 'hover:bg-red-50',
    description: 'Quick reference for workers',
    section: 'tools'
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
  const primaryItems = navigationItems.filter((item) => item.section === 'primary');
  const toolItems = navigationItems.filter((item) => item.section === 'tools');

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
    <nav
      aria-label="Primary"
      className={`flex flex-wrap items-center gap-2 overflow-x-auto ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {primaryItems.map((item) => {
          const isActive = !item.external && (pathname === item.href || pathname?.startsWith(`${item.href}/`));
          const Icon = item.icon;

          const baseClasses = 'group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white shadow-sm';
          const inactiveClasses = 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:border-slate-300';
          const activeClasses = 'bg-blue-600 text-white border border-blue-600 hover:bg-blue-600';

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
              <span>{item.name}</span>
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
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      {toolItems.length > 0 && (
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <WrenchScrewdriverIcon className="h-4 w-4 text-slate-500" />
              Tools
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs uppercase text-slate-400">
                Secondary tools
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {toolItems.map((item) => {
                const Icon = item.icon;
                const isActive = !item.external && (pathname === item.href || pathname?.startsWith(`${item.href}/`));

                const content = (
                  <div className="flex items-start gap-3">
                    <Icon className={`mt-0.5 h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div className="flex flex-col">
                      <span className={`text-sm ${isActive ? 'text-blue-600 font-semibold' : 'text-slate-700'}`}>
                        {item.name}
                      </span>
                      {item.description && (
                        <span className="text-xs text-slate-500">{item.description}</span>
                      )}
                    </div>
                    {item.external ? (
                      <ArrowTopRightOnSquareIcon className="ml-auto h-4 w-4 text-slate-400" />
                    ) : null}
                  </div>
                );

                if (item.external) {
                  return (
                    <DropdownMenuItem key={item.name} asChild className="focus:bg-blue-50">
                      <a href={item.href} target="_blank" rel="noopener noreferrer">
                        {content}
                      </a>
                    </DropdownMenuItem>
                  );
                }

                return (
                  <DropdownMenuItem key={item.name} asChild className="focus:bg-blue-50">
                    <Link href={item.href}>{content}</Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </nav>
  );
}
