'use client';

// Re-export freight-specific hooks to match migration plan path
export {
  useFreightOrder,
  useFreightQuotes,
  useFreightSuggestions,
  useCreateFreightBooking,
  useHazmatSuggestions,
  useFreightOrderHistory,
} from './hooks';

