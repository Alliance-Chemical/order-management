'use client';

import { useRouter } from 'next/navigation';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';
import type { FreightBookingData } from '@/types/freight-booking';

interface BookingSuccessProps {
  bookingData: FreightBookingData;
  workspaceLink: string;
}

export default function BookingSuccess({ bookingData, workspaceLink }: BookingSuccessProps) {
  const router = useRouter();
  
  return (
    <div className="flex items-center justify-center py-16">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <CheckCircleIcon className="h-16 w-16 text-warehouse-go mx-auto mb-4" />
        <h1 className="text-warehouse-3xl font-black text-gray-900 mb-4 uppercase">Freight Booked!</h1>
        <p className="text-gray-600 mb-6">
          Order <strong>{bookingData.selectedOrder?.orderNumber}</strong> booked with {bookingData.carrierName}
        </p>
        <div className="space-y-3">
          <button
            onClick={() => {
              warehouseFeedback.complete();
              router.push(workspaceLink);
            }}
            className="w-full bg-warehouse-go text-white py-8 px-6 rounded-warehouse text-warehouse-2xl font-black hover:bg-green-700 transition-colors shadow-warehouse border-b-8 border-green-800 active:scale-95"
            style={{ minHeight: '100px' }}
          >
            ✅ OPEN WORKSPACE
          </button>
          <button
            onClick={() => {
              warehouseFeedback.buttonPress();
              router.push('/');
            }}
            className="w-full bg-warehouse-neutral text-white py-8 px-6 rounded-warehouse text-warehouse-xl font-black hover:bg-gray-600 transition-colors shadow-warehouse border-b-8 border-gray-700 active:scale-95"
            style={{ minHeight: '100px' }}
          >
            ← DASHBOARD
          </button>
        </div>
      </div>
    </div>
  );
}