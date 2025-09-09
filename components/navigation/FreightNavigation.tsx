'use client';

import { useRouter, usePathname } from 'next/navigation';
import { 
  TruckIcon, 
  BeakerIcon, 
  LinkIcon,
  CubeIcon,
  HomeIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentCheckIcon,
  ArchiveBoxIcon 
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
  const router = useRouter();
  const pathname = usePathname();

  if (variant === 'vertical') {
    return (
      <nav className={`space-y-2 ${className}`}>
        {navigationItems.map((item) => {
          const isActive = !item.external && pathname === item.href;
          const Icon = item.icon;
          
          return (
            <button
              key={item.name}
              onClick={() => {
                if (item.external) {
                  window.open(item.href, '_blank', 'noopener,noreferrer');
                } else {
                  router.push(item.href);
                }
              }}
              className={`w-full flex items-center px-4 py-3 text-left text-sm font-medium rounded-lg transition-colors ${
                isActive 
                  ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-700' 
                  : `text-gray-700 ${item.bgColor}`
              }`}
            >
              <Icon className={`h-5 w-5 mr-3 ${isActive ? 'text-blue-700' : item.color}`} />
              <div className="flex-1">
                <div>{item.name}</div>
                {item.description && !isActive && (
                  <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                )}
              </div>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className={`flex items-center space-x-1 ${className}`}>
      {navigationItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        
        return (
          <button
            key={item.name}
            onClick={() => {
              if (item.external) {
                window.open(item.href, '_blank', 'noopener,noreferrer');
              } else {
                router.push(item.href);
              }
            }}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              isActive 
                ? 'bg-blue-100 text-blue-700' 
                : `text-gray-700 ${item.bgColor}`
            }`}
            title={item.description}
          >
            <Icon className={`h-4 w-4 mr-2 ${isActive ? 'text-blue-700' : item.color}`} />
            {item.name}
          </button>
        );
      })}
    </nav>
  );
}