"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type FinalMeasurements = {
  weight: { value: number; units: string };
  dimensions: { length: number; width: number; height: number; units: string };
  measuredBy?: string;
  measuredAt?: string;
};

type BookingReadyOrder = {
  workspaceId: string;
  orderId: number;
  orderNumber: string;
  customerName?: string;
  updatedAt?: string;
  finalMeasurements: FinalMeasurements;
};

export default function BookingReadyPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<BookingReadyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/booking-ready', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load');
        setOrders(data.orders || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white border rounded-lg shadow-sm p-5 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Booking Ready</h1>
          <p className="text-gray-600 text-sm mt-1">Orders marked Ready to Ship with final dimensions and weight recorded.</p>
        </div>

        {loading && (
          <div className="bg-white border rounded-lg p-6 text-gray-600">Loading…</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
        )}

        {!loading && !error && (
          orders.length === 0 ? (
            <div className="bg-white border rounded-lg p-6 text-gray-600">No orders are ready right now.</div>
          ) : (
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-600 px-4 py-2">Order</th>
                    <th className="text-left text-xs font-semibold text-gray-600 px-4 py-2">Customer</th>
                    <th className="text-left text-xs font-semibold text-gray-600 px-4 py-2">Dimensions</th>
                    <th className="text-left text-xs font-semibold text-gray-600 px-4 py-2">Weight</th>
                    <th className="text-left text-xs font-semibold text-gray-600 px-4 py-2">Updated</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const d = o.finalMeasurements?.dimensions;
                    const w = o.finalMeasurements?.weight;
                    return (
                      <tr key={o.orderId} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">#{o.orderNumber}</div>
                          <div className="text-xs text-gray-500">ID: {o.orderId}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-800">{o.customerName || '—'}</td>
                        <td className="px-4 py-3 text-gray-800">
                          {d ? (
                            <span>{d.length} × {d.width} × {d.height} {d.units}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          {w ? (
                            <span>{w.value} {w.units}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">
                          {o.updatedAt ? new Date(o.updatedAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                              onClick={() => router.push(`/freight-booking?orderId=${o.orderId}`)}
                            >
                              Open in Booking
                            </button>
                            <button
                              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
                              onClick={() => router.push(`/workspace/${o.orderId}`)}
                            >
                              Open Workspace
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}

