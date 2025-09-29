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

interface DropdownItem {
  name: string;
  href: string;
  description?: string;
  external?: boolean;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  color: string;
  bgColor: string;
  description?: string;
  external?: boolean;
  section: 'primary' | 'tools';
  isDropdown?: boolean;
  dropdownItems?: DropdownItem[];
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
    name: 'Archive',
    href: '/archive',
    icon: ArchiveBoxIcon,
    color: 'text-slate-600 hover:text-slate-900',
    bgColor: 'hover:bg-slate-100',
    description: 'Search past workspaces and orders',
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
    name: 'Chemical Tools',
    href: '#',
    icon: BeakerIcon,
    color: 'text-indigo-600 hover:text-indigo-700',
    bgColor: 'hover:bg-indigo-50',
    description: 'Lot numbers & dilution calculator',
    section: 'tools',
    isDropdown: true,
    dropdownItems: [
      {
        name: 'Lot Number Request',
        href: 'https://tool.alliancechemical.com/lot-number',
        description: 'Request and print lot numbers',
        external: true
      },
      {
        name: 'Lot Number Reference',
        href: 'https://tool.alliancechemical.com/warehouse-outgoing',
        description: 'Look up existing lot numbers',
        external: true
      },
      {
        name: 'Dilution Calculator',
        href: 'https://tool.alliancechemical.com/dilution',
        description: 'Calculate chemical dilutions',
        external: true
      }
    ]
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
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/90 px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <WrenchScrewdriverIcon className="h-4 w-4 text-slate-500" />
              Tools & Utilities
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-80 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur"
            >
              <DropdownMenuLabel className="px-3 text-[11px] uppercase tracking-wide text-slate-400">
                Secondary tools
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-200" />
              {toolItems.map((item) => {
                const Icon = item.icon;
                const isActive = !item.external && (pathname === item.href || pathname?.startsWith(`${item.href}/`));

                // Handle dropdown items
                if (item.isDropdown && item.dropdownItems) {
                  return (
                    <div key={item.name}>
                      <div className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-700">
                              {item.name}
                            </span>
                            {item.description && (
                              <span className="text-xs text-slate-500">{item.description}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="ml-12 space-y-1 mb-2">
                        {item.dropdownItems.map((subItem) => (
                          <DropdownMenuItem
                            key={subItem.name}
                            asChild
                            className="rounded-xl px-3 py-2 focus:bg-blue-50 focus:text-blue-700"
                          >
                            <a
                              href={subItem.href}
                              target={subItem.external ? "_blank" : undefined}
                              rel={subItem.external ? "noopener noreferrer" : undefined}
                              className="flex items-center gap-2"
                            >
                              <div className="flex flex-col">
                                <span className="text-sm text-slate-700">
                                  {subItem.name}
                                </span>
                                {subItem.description && (
                                  <span className="text-xs text-slate-500">{subItem.description}</span>
                                )}
                              </div>
                              {subItem.external && (
                                <ArrowTopRightOnSquareIcon className="ml-auto h-3 w-3 text-slate-400" />
                              )}
                            </a>
                          </DropdownMenuItem>
                        ))}
                      </div>
                      <DropdownMenuSeparator className="bg-slate-200" />
                    </div>
                  );
                }

                // Regular items
                const content = (
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <Icon className="h-4 w-4" />
                    </span>
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
                    <DropdownMenuItem
                      key={item.name}
                      asChild
                      className="rounded-xl px-3 py-2 focus:bg-blue-50 focus:text-blue-700"
                    >
                      <a href={item.href} target="_blank" rel="noopener noreferrer">
                        {content}
                      </a>
                    </DropdownMenuItem>
                  );
                }

                return (
                  <DropdownMenuItem
                    key={item.name}
                    asChild
                    className="rounded-xl px-3 py-2 focus:bg-blue-50 focus:text-blue-700"
                  >
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
