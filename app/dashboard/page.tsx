'use client';

import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="mt-1 text-sm text-gray-600">
                QR Workspace Management System
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">Quick Actions</h2>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/')}
                className="w-full text-left px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded"
              >
                View Work Queue
              </button>
              <button
                onClick={() => router.push('/workspace/new')}
                className="w-full text-left px-4 py-2 bg-green-50 hover:bg-green-100 rounded"
              >
                Create Workspace
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