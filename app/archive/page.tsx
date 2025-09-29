'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon, ArchiveBoxIcon, CalendarIcon } from '@heroicons/react/24/solid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FreightNavigation from '@/components/navigation/FreightNavigation';

interface Workspace {
  id: string;
  orderId: number;
  orderNumber: string;
  status: string;
  workflowPhase: string;
  createdAt: string;
  updatedAt: string;
  shippedAt?: string | null;
  archivedAt?: string | null;
  shipstationData?: {
    customerEmail?: string;
    shipTo?: {
      name?: string;
    };
    orderTotal?: number;
  };
}

type StatusFilter = 'all' | 'active' | 'shipped' | 'archived';
type DateRangeFilter = 'all' | '7days' | '30days' | '90days' | 'custom';

export default function ArchivePage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const fetchWorkspaces = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim());
      }

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      // Handle date ranges
      if (dateRange !== 'all') {
        const now = new Date();
        let startDate: Date | null = null;

        switch (dateRange) {
          case '7days':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30days':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90days':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          case 'custom':
            if (customStartDate) {
              startDate = new Date(customStartDate);
            }
            break;
        }

        if (startDate) {
          params.set('startDate', startDate.toISOString());
        }

        if (dateRange === 'custom' && customEndDate) {
          params.set('endDate', new Date(customEndDate).toISOString());
        }
      }

      const response = await fetch(`/api/workspaces/search?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setWorkspaces(data.workspaces);
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [statusFilter, dateRange]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWorkspaces();
  };

  const navigateToWorkspace = (orderId: number) => {
    router.push(`/workspace/${orderId}`);
  };

  const getCustomerName = (workspace: Workspace) => {
    return workspace.shipstationData?.shipTo?.name || 'Unknown Customer';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-700';
      case 'shipped':
        return 'bg-green-100 text-green-700';
      case 'archived':
        return 'bg-slate-100 text-slate-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
                <ArchiveBoxIcon className="h-7 w-7 text-slate-600" />
                Workspace Archive
              </h1>
              <p className="text-sm text-slate-500">Search and browse past orders and workspaces</p>
            </div>
            <FreightNavigation />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Search and Filters */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <form onSubmit={handleSearch} className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by order number, order ID, or customer name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-base"
              />
            </div>

            <div className="flex flex-wrap gap-4">
              {/* Status Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="shipped">Shipped</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Date Range Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Date Range
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="90days">Last 90 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Custom Date Inputs */}
              {dateRange === 'custom' && (
                <>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="h-10 px-6 bg-blue-600 hover:bg-blue-500">
                <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                Search
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setDateRange('all');
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="h-10 px-6"
              >
                Clear Filters
              </Button>
            </div>
          </form>
        </section>

        {/* Results Summary */}
        {!loading && workspaces.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Found <span className="font-semibold">{workspaces.length}</span> workspace{workspaces.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Results Grid */}
        {loading ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-48 rounded-2xl border border-slate-200 bg-white shadow-sm animate-pulse"
              />
            ))}
          </section>
        ) : workspaces.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
            <ArchiveBoxIcon className="mx-auto h-12 w-12 text-slate-300" />
            <h2 className="mt-4 text-lg font-semibold text-slate-800">No workspaces found</h2>
            <p className="mt-2 text-sm text-slate-500">
              {searchQuery || statusFilter !== 'all' || dateRange !== 'all'
                ? 'Try adjusting your search filters'
                : 'No workspaces have been created yet'}
            </p>
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
              <article
                key={workspace.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm transition-transform hover:-translate-y-1 hover:shadow-lg cursor-pointer"
                onClick={() => navigateToWorkspace(workspace.orderId)}
              >
                <div className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Order
                      </span>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {workspace.orderNumber}
                      </h2>
                      <p className="text-xs text-slate-500">ID: {workspace.orderId}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(workspace.status)}`}
                    >
                      {workspace.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-xs uppercase tracking-wide text-slate-400">Customer</span>
                      <p className="font-medium text-slate-800">{getCustomerName(workspace)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">
                          Created
                        </span>
                        <div className="flex items-center gap-1 text-slate-700">
                          <CalendarIcon className="h-3 w-3" />
                          {formatDate(workspace.createdAt)}
                        </div>
                      </div>

                      {workspace.shippedAt && (
                        <div>
                          <span className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">
                            Shipped
                          </span>
                          <div className="flex items-center gap-1 text-slate-700">
                            <CalendarIcon className="h-3 w-3" />
                            {formatDate(workspace.shippedAt)}
                          </div>
                        </div>
                      )}

                      {workspace.archivedAt && (
                        <div>
                          <span className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">
                            Archived
                          </span>
                          <div className="flex items-center gap-1 text-slate-700">
                            <CalendarIcon className="h-3 w-3" />
                            {formatDate(workspace.archivedAt)}
                          </div>
                        </div>
                      )}

                      {workspace.shipstationData?.orderTotal && (
                        <div>
                          <span className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">
                            Total
                          </span>
                          <span className="text-slate-700">
                            ${workspace.shipstationData.orderTotal.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        Workflow Phase
                      </span>
                      <p className="font-medium text-slate-800">
                        {workspace.workflowPhase.replace(/_/g, ' ').toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-auto px-4 pb-4">
                  <Button
                    className="w-full h-10 bg-blue-600 hover:bg-blue-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToWorkspace(workspace.orderId);
                    }}
                  >
                    View Workspace
                  </Button>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}