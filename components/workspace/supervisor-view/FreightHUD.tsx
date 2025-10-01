'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { warehouseFeedback, formatWarehouseText } from '@/lib/warehouse-ui-utils';

interface FreightOrder {
  id: string;
  orderId: number;
  orderNumber: string;
  status: string;
  workflowPhase: string;
  customerName: string;
  updatedAt: string;
  bookingStatus?: string | null;
  bookedAt?: string | null;
  carrierName?: string | null;
  trackingNumber?: string | null;
}

interface HUDData {
  unready: FreightOrder[];
  ready_to_book: FreightOrder[];
  booked: FreightOrder[];
}

interface HUDResponse {
  success: boolean;
  data: HUDData;
  counts: {
    unready: number;
    ready_to_book: number;
    booked: number;
  };
}

export default function FreightHUD() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HUDData>({
    unready: [],
    ready_to_book: [],
    booked: [],
  });
  const [counts, setCounts] = useState({ unready: 0, ready_to_book: 0, booked: 0 });

  const loadHUD = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/freight/hud', { cache: 'no-store' });
      const json = (await res.json()) as HUDResponse;

      if (!res.ok || !json.success) {
        throw new Error('Failed to load HUD data');
      }

      setData(json.data);
      setCounts(json.counts);
    } catch (error) {
      console.error('Error loading HUD:', error);
      toast({
        title: 'Error',
        description: 'Failed to load freight HUD',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHUD();
  }, []);

  const handleOpen = (orderId: number) => {
    warehouseFeedback.buttonPress();
    router.push(`/workspace/${orderId}`);
  };

  const handleReset = async (orderId: number, orderNumber: string) => {
    const confirmed = confirm(
      `Reset order ${orderNumber} back to active queue?\n\nThis will clear pre-ship completion and return it to "In Progress" status.`
    );

    if (!confirmed) return;

    warehouseFeedback.buttonPress();

    try {
      const res = await fetch(`/api/freight/reset/${orderId}`, {
        method: 'POST',
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to reset order');
      }

      toast({
        title: 'Success',
        description: `Order ${orderNumber} reset to queue`,
      });

      warehouseFeedback.success();
      await loadHUD(); // Refresh
    } catch (error) {
      console.error('Error resetting order:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reset order',
        variant: 'destructive',
      });
    }
  };

  const handleArchive = async (orderId: number, orderNumber: string) => {
    const reason = prompt(
      `Archive order ${orderNumber}?\n\nEnter reason (optional):`,
      'Completed/No longer needed'
    );

    if (reason === null) return; // User cancelled

    warehouseFeedback.buttonPress();

    try {
      const res = await fetch(`/api/freight/archive/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to archive order');
      }

      toast({
        title: 'Success',
        description: `Order ${orderNumber} archived`,
      });

      warehouseFeedback.success();
      await loadHUD(); // Refresh
    } catch (error) {
      console.error('Error archiving order:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to archive order',
        variant: 'destructive',
      });
    }
  };

  const handleBook = async (orderId: number, orderNumber: string) => {
    const confirmed = confirm(
      `Mark order ${orderNumber} as booked?\n\nThis is a stub action. In production, this will integrate with MyCarrier.`
    );

    if (!confirmed) return;

    warehouseFeedback.buttonPress();

    try {
      const res = await fetch(`/api/freight/book/${orderId}`, {
        method: 'POST',
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to book order');
      }

      toast({
        title: 'Success',
        description: `Order ${orderNumber} marked as booked`,
      });

      warehouseFeedback.success();
      await loadHUD(); // Refresh
    } catch (error) {
      console.error('Error booking order:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to book order',
        variant: 'destructive',
      });
    }
  };

  const renderOrderCard = (order: FreightOrder, lane: 'unready' | 'ready_to_book' | 'booked') => {
    return (
      <div
        key={order.id}
        className="bg-white border-2 border-gray-200 rounded-warehouse p-4 mb-3 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="mb-3">
          <div className="font-black text-lg text-gray-900">#{order.orderNumber}</div>
          <div className="text-sm text-gray-600">{order.customerName}</div>
          <div className="text-xs text-gray-500 mt-1">
            Phase: {order.workflowPhase} • Updated:{' '}
            {new Date(order.updatedAt).toLocaleDateString()}
          </div>
          {order.carrierName && (
            <div className="text-xs text-blue-600 mt-1">
              Carrier: {order.carrierName}
              {order.trackingNumber && ` • ${order.trackingNumber}`}
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleOpen(order.orderId)}
            className="px-4 py-2 bg-warehouse-info text-white rounded-warehouse text-sm font-black hover:bg-blue-700 transition-colors shadow-warehouse border-b-2 border-blue-800 active:scale-95"
          >
            📂 OPEN
          </button>

          {lane === 'unready' && (
            <button
              onClick={() => handleArchive(order.orderId, order.orderNumber)}
              className="px-4 py-2 bg-gray-500 text-white rounded-warehouse text-sm font-black hover:bg-gray-600 transition-colors shadow-warehouse border-b-2 border-gray-700 active:scale-95"
            >
              🗄️ ARCHIVE
            </button>
          )}

          {lane === 'ready_to_book' && (
            <>
              <button
                onClick={() => handleBook(order.orderId, order.orderNumber)}
                className="px-4 py-2 bg-warehouse-go text-white rounded-warehouse text-sm font-black hover:bg-green-700 transition-colors shadow-warehouse border-b-2 border-green-800 active:scale-95"
              >
                📦 BOOK
              </button>
              <button
                onClick={() => handleReset(order.orderId, order.orderNumber)}
                className="px-4 py-2 bg-warehouse-caution text-white rounded-warehouse text-sm font-black hover:bg-amber-600 transition-colors shadow-warehouse border-b-2 border-amber-700 active:scale-95"
              >
                🔄 RESET
              </button>
              <button
                onClick={() => handleArchive(order.orderId, order.orderNumber)}
                className="px-4 py-2 bg-gray-500 text-white rounded-warehouse text-sm font-black hover:bg-gray-600 transition-colors shadow-warehouse border-b-2 border-gray-700 active:scale-95"
              >
                🗄️ ARCHIVE
              </button>
            </>
          )}

          {lane === 'booked' && (
            <button
              onClick={() => handleArchive(order.orderId, order.orderNumber)}
              className="px-4 py-2 bg-gray-500 text-white rounded-warehouse text-sm font-black hover:bg-gray-600 transition-colors shadow-warehouse border-b-2 border-gray-700 active:scale-95"
            >
              🗄️ ARCHIVE
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-pulse text-warehouse-xl font-black text-gray-600">
          ⏳ LOADING FREIGHT HUD...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-warehouse-2xl font-black text-gray-900 uppercase">
          {formatWarehouseText('Supervisor Freight HUD', 'critical')}
        </h2>
        <button
          onClick={() => {
            warehouseFeedback.buttonPress();
            loadHUD();
          }}
          className="px-6 py-3 bg-warehouse-info text-white rounded-warehouse text-warehouse-lg font-black hover:bg-blue-700 transition-colors shadow-warehouse border-b-4 border-blue-800 active:scale-95"
        >
          🔄 REFRESH
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Unready Lane */}
        <div className="bg-gray-50 rounded-warehouse p-4 border-2 border-gray-300">
          <div className="mb-4 pb-2 border-b-2 border-gray-400">
            <h3 className="text-warehouse-xl font-black text-gray-700 uppercase">
              ⏸️ UNREADY ({counts.unready})
            </h3>
            <p className="text-xs text-gray-600 mt-1">Active but not ready to ship</p>
          </div>
          {data.unready.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">No unready orders</div>
          ) : (
            data.unready.map((order) => renderOrderCard(order, 'unready'))
          )}
        </div>

        {/* Ready to Book Lane */}
        <div className="bg-green-50 rounded-warehouse p-4 border-2 border-green-400">
          <div className="mb-4 pb-2 border-b-2 border-green-500">
            <h3 className="text-warehouse-xl font-black text-green-800 uppercase">
              ✅ READY TO BOOK ({counts.ready_to_book})
            </h3>
            <p className="text-xs text-green-700 mt-1">Pre-ship complete, ready for booking</p>
          </div>
          {data.ready_to_book.length === 0 ? (
            <div className="text-center py-6 text-green-700 text-sm">No orders ready to book</div>
          ) : (
            data.ready_to_book.map((order) => renderOrderCard(order, 'ready_to_book'))
          )}
        </div>

        {/* Booked Lane */}
        <div className="bg-blue-50 rounded-warehouse p-4 border-2 border-blue-400">
          <div className="mb-4 pb-2 border-b-2 border-blue-500">
            <h3 className="text-warehouse-xl font-black text-blue-800 uppercase">
              📦 BOOKED ({counts.booked})
            </h3>
            <p className="text-xs text-blue-700 mt-1">Freight booked, awaiting shipment</p>
          </div>
          {data.booked.length === 0 ? (
            <div className="text-center py-6 text-blue-700 text-sm">No booked orders</div>
          ) : (
            data.booked.map((order) => renderOrderCard(order, 'booked'))
          )}
        </div>
      </div>
    </div>
  );
}
