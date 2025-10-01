'use client';

import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InfoTooltipProps {
  content: React.ReactNode;
  title?: string;
  example?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

/**
 * InfoTooltip - Contextual help component
 *
 * Displays a help icon (?) that shows detailed information on hover/click.
 * Perfect for explaining complex fields like UN Rating, NMFC codes, etc.
 *
 * @example
 * ```tsx
 * <InfoTooltip
 *   title="UN Rating"
 *   content="UN performance rating for hazmat containers"
 *   example="UN/1A1/X1.4/150/19"
 * />
 * ```
 */
export function InfoTooltip({
  content,
  title,
  example,
  side = 'right',
  className = '',
}: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors ${className}`}
            onClick={(e) => e.preventDefault()} // Prevent form submission
          >
            <HelpCircle className="h-4 w-4" />
            <span className="sr-only">Help</span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-xs p-4 bg-gray-900 text-white text-sm"
          sideOffset={5}
        >
          <div className="space-y-2">
            {title && (
              <div className="font-semibold text-base border-b border-gray-700 pb-2">
                {title}
              </div>
            )}
            <div className="text-gray-200">{content}</div>
            {example && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Example:</div>
                <code className="text-xs bg-gray-800 px-2 py-1 rounded text-green-400">
                  {example}
                </code>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
