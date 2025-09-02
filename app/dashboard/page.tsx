'use client';

import { useRouter } from 'next/navigation';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';
import FreightNavigation from '@/components/navigation/FreightNavigation';

export default function DashboardPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-100">
      <FreightNavigation className="bg-white shadow-sm border-b px-6 py-4" />
      
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-warehouse-3xl font-black text-gray-900 uppercase">DASHBOARD</h1>
              <p className="mt-1 text-warehouse-lg text-gray-600">
                QR Workspace Management System
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  warehouseFeedback.buttonPress();
                  router.push('/freight-booking');
                }}
                className="inline-flex items-center px-8 py-6 bg-warehouse-info text-white rounded-warehouse shadow-warehouse text-warehouse-xl font-black hover:bg-blue-700 transition-colors border-b-4 border-blue-800 active:scale-95"
                style={{ minHeight: '80px' }}
              >
                🚛 BOOK FREIGHT
              </button>
              <button
                onClick={() => {
                  warehouseFeedback.buttonPress();
                  router.push('/');
                }}
                className="inline-flex items-center px-8 py-6 bg-warehouse-neutral text-white rounded-warehouse shadow-warehouse text-warehouse-xl font-black hover:bg-gray-600 transition-colors border-b-4 border-gray-700 active:scale-95"
                style={{ minHeight: '80px' }}
              >
                📋 WORK QUEUE
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-warehouse shadow-warehouse">
            <h2 className="text-warehouse-xl font-black text-gray-900 uppercase mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => {
                  warehouseFeedback.buttonPress();
                  router.push('/');
                }}
                className="w-full text-left px-6 py-6 bg-warehouse-info text-white rounded-warehouse hover:bg-blue-700 transition-colors shadow-warehouse border-b-4 border-blue-800 text-warehouse-lg font-black uppercase active:scale-95"
                style={{ minHeight: '80px' }}
              >
                📋 VIEW WORK QUEUE
              </button>
              <button
                onClick={() => {
                  warehouseFeedback.buttonPress();
                  router.push('/workspace/new');
                }}
                className="w-full text-left px-6 py-6 bg-warehouse-go text-white rounded-warehouse hover:bg-green-700 transition-colors shadow-warehouse border-b-4 border-green-800 text-warehouse-lg font-black uppercase active:scale-95"
                style={{ minHeight: '80px' }}
              >
                ➕ CREATE WORKSPACE
              </button>
              <button
                onClick={() => {
                  warehouseFeedback.buttonPress();
                  router.push('/freight-booking');
                }}
                className="w-full text-left px-6 py-6 bg-warehouse-caution text-white rounded-warehouse hover:bg-amber-600 transition-colors shadow-warehouse border-b-4 border-amber-700 text-warehouse-lg font-black uppercase active:scale-95 animate-pulse"
                style={{ minHeight: '80px' }}
              >
                🚛 BOOK FREIGHT NOW
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">Recent Activity</h2>
            <p className="text-gray-600">No recent activity</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">Statistics</h2>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Orders Today: 0</p>
              <p className="text-sm text-gray-600">Pending Inspections: 0</p>
              <p className="text-sm text-gray-600">Completed Today: 0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}