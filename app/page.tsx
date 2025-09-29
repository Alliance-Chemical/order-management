'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PrinterIcon,
  ClipboardDocumentCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowRightIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/solid';
import PrintPreparationModalSimplified from '@/components/desktop/PrintPreparationModalSimplified';
import FreightNavigation from '@/components/navigation/FreightNavigation';
import { filterOutDiscounts } from '@/lib/services/orders/normalize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { INSPECTORS } from '@/lib/inspection/inspectors';

interface OrderItem {
  name: string;
  quantity: number;
  sku: string;
  [key: string]: unknown;
}

interface FinalMeasurementsSummary {
  weight?: { value?: number; units?: string };
  dimensions?: { length?: number; width?: number; height?: number; units?: string };
  measuredBy?: string;
  measuredAt?: string;
}

interface FreightOrder {
  orderId: number;
  orderNumber: string;
  workspaceId?: string;
  customerName?: string;
  orderDate?: string;
  orderTotal?: number;
  items?: OrderItem[];
  freightStatus?: string;
  carrierName?: string;
  trackingNumber?: string;
  workflowPhase?: string;
  status?: string;
  finalMeasurements?: FinalMeasurementsSummary | null;
}

interface MeasurementDraft {
  length: string;
  width: string;
  height: string;
  dimensionUnit: string;
  weightValue: string;
  weightUnit: string;
  measuredBy: string;
}

export default function WorkQueueDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [orders, setOrders] = useState<FreightOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<FreightOrder | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const [measurementExpanded, setMeasurementExpanded] = useState<Set<number>>(new Set());
  const [measurementDrafts, setMeasurementDrafts] = useState<Record<number, MeasurementDraft>>({});
  const [savingMeasurements, setSavingMeasurements] = useState<Set<number>>(new Set());
  const [activeFilter, setActiveFilter] = useState<'all' | 'under24' | '24to48' | '48to72' | 'over72' | 'ready'>('all');
  const [search, setSearch] = useState('');
  const dimensionUnits = ['in', 'cm'];
  const weightUnits = ['lbs', 'kg'];

  const fetchFreightOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/freight-orders/poll');
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        return;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response received:', text);
        return;
      }

      const data = await response.json();
      if (data.success) {
        const ordersWithWorkspaces: FreightOrder[] = [...data.created, ...data.existing]
          .filter((order: FreightOrder) => order.workspaceId)
          .map((order: FreightOrder) => ({
            ...order,
            finalMeasurements: order.finalMeasurements ?? null,
          }));
        setOrders(ordersWithWorkspaces);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFreightOrders();
    const interval = setInterval(fetchFreightOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setMeasurementDrafts((prev) => {
      const next = { ...prev };
      orders.forEach((order) => {
        if (measurementExpanded.has(order.orderId)) {
          return;
        }
        const fm = order.finalMeasurements;
        const desired: MeasurementDraft = {
          length: fm?.dimensions?.length != null ? String(fm.dimensions.length) : '',
          width: fm?.dimensions?.width != null ? String(fm.dimensions.width) : '',
          height: fm?.dimensions?.height != null ? String(fm.dimensions.height) : '',
          dimensionUnit: fm?.dimensions?.units || 'in',
          weightValue: fm?.weight?.value != null ? String(fm.weight.value) : '',
          weightUnit: fm?.weight?.units || 'lbs',
          measuredBy: fm?.measuredBy || '',
        };

        const existing = next[order.orderId];
        if (!existing) {
          next[order.orderId] = desired;
          return;
        }

        const hasChanged =
          existing.length !== desired.length ||
          existing.width !== desired.width ||
          existing.height !== desired.height ||
          existing.dimensionUnit !== desired.dimensionUnit ||
          existing.weightValue !== desired.weightValue ||
          existing.weightUnit !== desired.weightUnit ||
          existing.measuredBy !== desired.measuredBy;

        if (hasChanged) {
          next[order.orderId] = { ...existing, ...desired };
        }
      });
      return next;
    });
  }, [orders, measurementExpanded]);

  const handlePrepareAndPrint = (order: FreightOrder) => {
    setSelectedOrder(order);
    setShowPrintModal(true);
  };

  const handlePrintComplete = () => {
    setShowPrintModal(false);
    setSelectedOrder(null);
    fetchFreightOrders();
  };

  const toggleOrderExpanded = (orderId: number) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const toggleMeasurementSection = (orderId: number) => {
    setMeasurementExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const updateMeasurementDraft = (
    orderId: number,
    field: keyof MeasurementDraft,
    value: string,
  ) => {
    setMeasurementDrafts((prev) => {
      const existing = prev[orderId] || {
        length: '',
        width: '',
        height: '',
        dimensionUnit: 'in',
        weightValue: '',
        weightUnit: 'lbs',
        measuredBy: '',
      };

      return {
        ...prev,
        [orderId]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  const handleSaveMeasurements = async (order: FreightOrder) => {
    const draft = measurementDrafts[order.orderId];
    if (!draft) {
      toast({ title: 'Enter measurements first', variant: 'destructive' });
      return;
    }

    const requiredFields = [draft.length, draft.width, draft.height, draft.weightValue, draft.measuredBy];
    if (requiredFields.some((value) => !value || value.trim() === '')) {
      toast({ title: 'Missing fields', description: 'Please complete dimensions, weight, and who recorded them.', variant: 'destructive' });
      return;
    }

    const length = parseFloat(draft.length);
    const width = parseFloat(draft.width);
    const height = parseFloat(draft.height);
    const weightValue = parseFloat(draft.weightValue);

    if ([length, width, height, weightValue].some((value) => Number.isNaN(value) || value <= 0)) {
      toast({ title: 'Invalid measurements', description: 'Values must be positive numbers.', variant: 'destructive' });
      return;
    }

    const measuredAt = new Date().toISOString();
    const payload = {
      weight: {
        value: weightValue,
        units: draft.weightUnit || 'lbs',
      },
      dimensions: {
        length,
        width,
        height,
        units: draft.dimensionUnit || 'in',
      },
      measuredBy: draft.measuredBy,
      measuredAt,
      mode: 'single',
    };

    setSavingMeasurements((prev) => new Set(prev).add(order.orderId));

    try {
      const response = await fetch(`/api/workspace/${order.orderId}/measurements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || 'Failed to save measurements');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save measurements');
      }

      setOrders((prev) =>
        prev.map((item) =>
          item.orderId === order.orderId
            ? {
                ...item,
                finalMeasurements: {
                  ...payload,
                },
              }
            : item,
        ),
      );

      setMeasurementDrafts((prev) => ({
        ...prev,
        [order.orderId]: {
          ...prev[order.orderId],
          measuredBy: payload.measuredBy,
          dimensionUnit: payload.dimensions.units,
          weightUnit: payload.weight.units,
          length: String(payload.dimensions.length),
          width: String(payload.dimensions.width),
          height: String(payload.dimensions.height),
          weightValue: String(payload.weight.value),
        },
      }));

      setMeasurementExpanded((prev) => {
        const next = new Set(prev);
        next.delete(order.orderId);
        return next;
      });

      toast({ title: 'Measurements saved', description: `Recorded for order ${order.orderNumber}.` });
    } catch (error) {
      console.error('Failed to save measurements', error);
      toast({ title: 'Save failed', description: error instanceof Error ? error.message : 'Unable to save measurements.', variant: 'destructive' });
    } finally {
      setSavingMeasurements((prev) => {
        const next = new Set(prev);
        next.delete(order.orderId);
        return next;
      });
    }
  };

  const navigateToWorkspace = (orderId: number, view: 'worker' | 'supervisor' = 'worker') => {
    if (view === 'supervisor') {
      router.push(`/workspace/${orderId}?view=supervisor`);
      return;
    }

    router.push(`/workspace/${orderId}?view=worker`);
  };

  const enrichedOrders = orders
    .map((order) => {
      const orderItems = filterOutDiscounts<OrderItem>(order.items ?? []);
      const orderDateValue = order.orderDate ? new Date(order.orderDate) : null;
      const ageHours = orderDateValue ? (Date.now() - orderDateValue.getTime()) / (1000 * 60 * 60) : null;
      const agingBadge = ageHours == null
        ? null
        : ageHours >= 72
          ? { label: '72+ hrs', className: 'bg-rose-100 text-rose-600' }
          : ageHours >= 48
            ? { label: '48 hrs', className: 'bg-amber-100 text-amber-700' }
            : ageHours >= 24
              ? { label: '24 hrs', className: 'bg-slate-100 text-slate-600' }
              : null;

      return {
        order,
        orderItems,
        orderDateValue,
        ageHours,
        agingBadge,
      };
    })
    .sort((a, b) => {
      if (a.orderDateValue && b.orderDateValue) {
        return a.orderDateValue.getTime() - b.orderDateValue.getTime();
      }
      if (a.orderDateValue) return -1;
      if (b.orderDateValue) return 1;
      return 0;
    });

  const totalOrders = enrichedOrders.length;
  const under24Count = enrichedOrders.filter(({ ageHours }) => ageHours != null && ageHours < 24).length;
  const between24And48Count = enrichedOrders.filter(({ ageHours }) => ageHours != null && ageHours >= 24 && ageHours < 48).length;
  const between48And72Count = enrichedOrders.filter(({ ageHours }) => ageHours != null && ageHours >= 48 && ageHours < 72).length;
  const over72Count = enrichedOrders.filter(({ ageHours }) => ageHours != null && ageHours >= 72).length;
  const readyCount = enrichedOrders.filter(({ order }) => {
    const dims = order.finalMeasurements?.dimensions;
    const weight = order.finalMeasurements?.weight;
    return Boolean(
      dims?.length &&
      dims?.width &&
      dims?.height &&
      weight?.value,
    );
  }).length;

  const normalizedSearch = search.trim().toLowerCase();

  const filteredOrders = enrichedOrders.filter(({ order, orderItems, ageHours }) => {
    if (activeFilter === 'ready') {
      const dims = order.finalMeasurements?.dimensions;
      const weight = order.finalMeasurements?.weight;
      const hasMeasurements = Boolean(
        dims?.length &&
        dims?.width &&
        dims?.height &&
        weight?.value,
      );
      if (!hasMeasurements) {
        return false;
      }
    }

    const matchesAge = (() => {
      if (activeFilter === 'under24') {
        return ageHours != null && ageHours < 24;
      }
      if (activeFilter === '24to48') {
        return ageHours != null && ageHours >= 24 && ageHours < 48;
      }
      if (activeFilter === '48to72') {
        return ageHours != null && ageHours >= 48 && ageHours < 72;
      }
      if (activeFilter === 'over72') {
        return ageHours != null && ageHours >= 72;
      }
      if (activeFilter === 'ready') {
        return true;
      }
      return true;
    })();

    if (!matchesAge) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [
      order.orderNumber,
      order.orderId?.toString(),
      order.customerName,
      ...orderItems.map((item) => `${item.name} ${item.sku}`)
    ]
      .filter(Boolean)
      .some((value) =>
        value!
          .toString()
          .toLowerCase()
          .includes(normalizedSearch)
      );
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Work Queue</h1>
              <p className="text-sm text-slate-500">Freight orders awaiting labels or inspection</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <FreightNavigation />
              <Button
                variant="outline"
                onClick={fetchFreightOrders}
                className="h-10 px-4"
              >
                Refresh
              </Button>
            </div>
          </div>
          {loading && (
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-blue-100">
              <div className="h-full w-full animate-pulse rounded-full bg-blue-500" />
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {totalOrders > 0 && (
          <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white shadow-lg">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-semibold">{totalOrders}</span>
                <span className="text-xs uppercase tracking-wide text-white/70">Total Freight Orders</span>
              </div>
            </div>
          </section>
        )}

        {!loading && totalOrders > 0 && (
          <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {([
                { id: 'all', label: 'All Orders', count: totalOrders },
                { id: 'under24', label: '< 24 hrs', count: under24Count },
                { id: '24to48', label: '24 - 48 hrs', count: between24And48Count },
                { id: '48to72', label: '48 - 72 hrs', count: between48And72Count },
                { id: 'over72', label: '72+ hrs', count: over72Count },
                { id: 'ready', label: 'Ready for Inspection', count: readyCount },
              ] as const).map((option) => (
                <Button
                  key={option.id}
                  variant={activeFilter === option.id ? 'default' : 'outline'}
                  className={`${activeFilter === option.id ? 'bg-blue-600 text-white hover:bg-blue-500' : 'border-slate-300 text-slate-600 hover:bg-slate-100'} h-9 rounded-full px-4 text-sm`}
                  onClick={() => setActiveFilter(option.id)}
                >
                  {option.label}
                  <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs font-semibold">
                    {option.count}
                  </span>
                </Button>
              ))}
            </div>
            <div className="relative w-full md:w-72">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search order #, customer, SKU"
                className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 right-3 inline-flex items-center text-xs font-semibold text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>
          </section>
        )}

        {loading ? (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-52 rounded-2xl border border-slate-200 bg-white shadow-sm animate-pulse"
              />
            ))}
          </section>
        ) : totalOrders === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
            <ClipboardDocumentCheckIcon className="mx-auto h-12 w-12 text-slate-300" />
            <h2 className="mt-4 text-lg font-semibold text-slate-800">All clear</h2>
            <p className="mt-2 text-sm text-slate-500">Tag an order for freight processing to see it here.</p>
          </section>
        ) : filteredOrders.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
            <ClipboardDocumentCheckIcon className="mx-auto h-12 w-12 text-slate-300" />
            <h2 className="mt-4 text-lg font-semibold text-slate-800">No matches</h2>
            <p className="mt-2 text-sm text-slate-500">Adjust your filters to see additional orders.</p>
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredOrders.map(({ order, orderItems, agingBadge }) => {
              const previewItems = orderItems.slice(0, 2);
              const isExpanded = expandedOrders.has(order.orderId);
              const measurementDraft = measurementDrafts[order.orderId];
              const isMeasurementExpanded = measurementExpanded.has(order.orderId);
              const hasMeasurements = Boolean(
                order.finalMeasurements?.dimensions?.length &&
                  order.finalMeasurements?.dimensions?.width &&
                  order.finalMeasurements?.dimensions?.height &&
                  order.finalMeasurements?.weight?.value,
              );
              const measurementRecordedBy = order.finalMeasurements?.measuredBy;
              const measurementRecordedAt = order.finalMeasurements?.measuredAt
                ? new Date(order.finalMeasurements.measuredAt).toLocaleString()
                : null;
              const measurementDims = order.finalMeasurements?.dimensions;
              const measurementWeight = order.finalMeasurements?.weight;
              const measurementDimensionsDisplay = measurementDims
                ? `${measurementDims.length ?? '—'} × ${measurementDims.width ?? '—'} × ${measurementDims.height ?? '—'} ${measurementDims.units ?? 'in'}`
                : null;
              const measurementWeightDisplay = measurementWeight
                ? `${measurementWeight.value ?? '—'} ${measurementWeight.units ?? 'lbs'}`
                : null;

              return (
                <article
                  key={order.orderId}
                  className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm transition-transform hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Order</span>
                        <h2 className="text-lg font-semibold text-slate-900">{order.orderNumber || `Order ${order.orderId}`}</h2>
                        <p className="text-xs text-slate-500">ID: {order.orderId}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {hasMeasurements && (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                            <CheckCircleIcon className="mr-1 h-4 w-4" />
                            Ready for Inspection
                          </span>
                        )}
                        {order.freightStatus ? (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            {order.freightStatus.toUpperCase()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            AWAITING FREIGHT
                          </span>
                        )}
                        {orderItems.length > 6 && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            HIGH VOLUME
                          </span>
                        )}
                        {agingBadge && (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${agingBadge.className}`}>
                            {agingBadge.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-4 text-sm text-slate-600">
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs uppercase tracking-wide text-slate-400">Customer</span>
                        <p className="text-sm font-medium text-slate-800">
                          {order.customerName || 'Unknown Customer'}
                        </p>
                      </div>
                      <div className="flex gap-6 text-xs">
                        <div>
                          <span className="block text-[11px] uppercase tracking-wide text-slate-400">Order Date</span>
                          <span className="text-sm text-slate-700">
                            {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] uppercase tracking-wide text-slate-400">Items</span>
                          <span className="text-sm text-slate-700">{orderItems.length}</span>
                        </div>
                        {order.carrierName && (
                          <div>
                            <span className="block text-[11px] uppercase tracking-wide text-slate-400">Carrier</span>
                            <span className="text-sm text-slate-700">{order.carrierName}</span>
                          </div>
                        )}
                        {order.trackingNumber && (
                          <div>
                            <span className="block text-[11px] uppercase tracking-wide text-slate-400">Tracking #</span>
                            <span className="text-sm text-slate-700">{order.trackingNumber}</span>
                          </div>
                        )}
                      </div>
                      {orderItems.length > 0 && (
                        <div>
                          <span className="text-xs uppercase tracking-wide text-slate-400">Line Items</span>
                          <ul className="mt-1 space-y-1">
                            {previewItems.map((item, idx) => (
                              <li key={idx} className="text-sm text-slate-700">
                                {item.quantity}× {item.name}
                              </li>
                            ))}
                          </ul>
                          {orderItems.length > previewItems.length && (
                            <button
                              onClick={() => toggleOrderExpanded(order.orderId)}
                              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500"
                            >
                              {isExpanded ? 'Hide all items' : `View all ${orderItems.length} items`}
                              {isExpanded ? (
                                <ChevronDownIcon className="h-4 w-4" />
                              ) : (
                                <ChevronRightIcon className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <span className="text-xs uppercase tracking-wide text-slate-400">Dimensions &amp; Weight</span>
                            <p className="text-sm font-medium text-slate-800">
                              {hasMeasurements && measurementDimensionsDisplay && measurementWeightDisplay
                                ? `${measurementDimensionsDisplay} • ${measurementWeightDisplay}`
                                : 'Not recorded yet'}
                            </p>
                            {hasMeasurements && (
                              <p className="text-xs text-slate-500">
                                Recorded by {measurementRecordedBy || 'Unknown'}
                                {measurementRecordedAt ? ` on ${measurementRecordedAt}` : ''}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleMeasurementSection(order.orderId)}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            {isMeasurementExpanded
                              ? 'Hide entry form'
                              : hasMeasurements
                                ? 'Edit measurements'
                                : 'Record measurements'}
                            <ChevronDownIcon
                              className={`h-4 w-4 transition-transform ${isMeasurementExpanded ? 'rotate-180' : ''}`}
                            />
                          </button>
                        </div>
                      </div>
                      {isMeasurementExpanded && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
                              Length
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={measurementDraft?.length ?? ''}
                                onChange={(event) => updateMeasurementDraft(order.orderId, 'length', event.target.value)}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
                              Width
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={measurementDraft?.width ?? ''}
                                onChange={(event) => updateMeasurementDraft(order.orderId, 'width', event.target.value)}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
                              Height
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={measurementDraft?.height ?? ''}
                                onChange={(event) => updateMeasurementDraft(order.orderId, 'height', event.target.value)}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
                              Dimension Units
                              <select
                                value={measurementDraft?.dimensionUnit || 'in'}
                                onChange={(event) => updateMeasurementDraft(order.orderId, 'dimensionUnit', event.target.value)}
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                {dimensionUnits.map((unit) => (
                                  <option key={unit} value={unit}>
                                    {unit.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
                              Weight
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={measurementDraft?.weightValue ?? ''}
                                onChange={(event) => updateMeasurementDraft(order.orderId, 'weightValue', event.target.value)}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
                              Weight Units
                              <select
                                value={measurementDraft?.weightUnit || 'lbs'}
                                onChange={(event) => updateMeasurementDraft(order.orderId, 'weightUnit', event.target.value)}
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                {weightUnits.map((unit) => (
                                  <option key={unit} value={unit}>
                                    {unit.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500 sm:col-span-2">
                              Recorded By
                              <select
                                value={(() => {
                                  const current = measurementDraft?.measuredBy || '';
                                  if (!current) return '';
                                  return INSPECTORS.includes(current) ? current : 'custom';
                                })()}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  updateMeasurementDraft(order.orderId, 'measuredBy', value === 'custom' ? '' : value);
                                }}
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="" disabled>
                                  Select team member
                                </option>
                                {INSPECTORS.map((name) => (
                                  <option key={name} value={name}>
                                    {name}
                                  </option>
                                ))}
                                <option value="custom">Other / Not Listed</option>
                              </select>
                              {(!measurementDraft?.measuredBy || !INSPECTORS.includes(measurementDraft.measuredBy)) && (
                                <Input
                                  placeholder="Enter team member name"
                                  value={measurementDraft?.measuredBy ?? ''}
                                  onChange={(event) => updateMeasurementDraft(order.orderId, 'measuredBy', event.target.value)}
                                />
                              )}
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => toggleMeasurementSection(order.orderId)}
                              className="h-9 px-4 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => handleSaveMeasurements(order)}
                              className="h-9 bg-green-600 px-4 text-xs font-semibold text-white hover:bg-green-500"
                              disabled={savingMeasurements.has(order.orderId)}
                            >
                              {savingMeasurements.has(order.orderId) ? 'Saving…' : 'Save Measurements'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && orderItems.length > 0 && (
                    <div className="px-4 pb-4">
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-3 py-2 text-left">SKU</th>
                              <th className="px-3 py-2 text-left">Product</th>
                              <th className="px-3 py-2 text-center">Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {orderItems.map((item, idx) => (
                              <tr key={`${item.sku || item.name}-${idx}`} className="bg-white">
                                <td className="px-3 py-2 text-slate-700">{item.sku || 'N/A'}</td>
                                <td className="px-3 py-2 text-slate-700">{item.name}</td>
                                <td className="px-3 py-2 text-center text-slate-700">{item.quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="mt-auto px-4 pb-4">
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => navigateToWorkspace(order.orderId, 'worker')}
                        className="h-11 justify-center gap-2 bg-blue-600 text-white hover:bg-blue-500"
                        fullWidth
                      >
                        Worker View
                      </Button>
                      <Button
                        onClick={() => navigateToWorkspace(order.orderId, 'supervisor')}
                        variant="outline"
                        className="h-11 justify-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-100"
                        fullWidth
                      >
                        <ArrowRightIcon className="h-4 w-4" />
                        Supervisor View
                      </Button>
                      <Button
                        onClick={() => handlePrepareAndPrint(order)}
                        className="h-11 justify-center gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
                        fullWidth
                      >
                        <PrinterIcon className="h-4 w-4" />
                        Print Labels
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      {showPrintModal && selectedOrder && (
        <PrintPreparationModalSimplified
          order={selectedOrder}
          onClose={() => setShowPrintModal(false)}
          onPrintComplete={handlePrintComplete}
        />
      )}
    </div>
  );
}
