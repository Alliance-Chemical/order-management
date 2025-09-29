'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  DocumentDuplicateIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline';

interface LotRecord {
  id: number;
  productId: string;
  productTitle: string;
  sku: string | null;
  month: string;
  year: number;
  lotNumber: string | null;
  createdAt: string;
}

interface LabelRequest {
  id: number;
  productName: string | null;
  lotNumber: string | null;
  quantity: number | null;
  status: string | null;
  requestedAt: string;
  printedAt: string | null;
  requestedBy: string | null;
  printedBy: string | null;
}

export default function LOTManagementPage() {
  const { toast } = useToast();
  const [lots, setLots] = useState<LotRecord[]>([]);
  const [labelRequests, setLabelRequests] = useState<LabelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'lots' | 'labels'>('lots');

  // Fetch LOT data from legacy database
  useEffect(() => {
    fetchLOTData();
  }, []);

  const fetchLOTData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/lots/legacy');
      const data = await response.json();

      if (data.success) {
        setLots(data.lots || []);
        setLabelRequests(data.labelRequests || []);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to fetch LOT data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load LOT data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const generateNewLOT = async (productId: string) => {
    try {
      const response = await fetch('/api/lots/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: `Generated LOT: ${data.lotNumber}`
        });
        await fetchLOTData();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate LOT number',
        variant: 'destructive'
      });
    }
  };

  const exportLOTData = () => {
    const csvContent = [
      ['Product ID', 'Product Title', 'SKU', 'LOT Number', 'Month', 'Year', 'Created At'],
      ...filteredLots.map(lot => [
        lot.productId,
        lot.productTitle,
        lot.sku || '',
        lot.lotNumber || '',
        lot.month,
        lot.year,
        new Date(lot.createdAt).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lot-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Filter LOTs based on search and filters
  const filteredLots = lots.filter(lot => {
    const matchesSearch = searchTerm === '' ||
      lot.productTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lot.lotNumber?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesYear = selectedYear === 'all' || lot.year.toString() === selectedYear;
    const matchesMonth = selectedMonth === 'all' || lot.month === selectedMonth;

    return matchesSearch && matchesYear && matchesMonth;
  });

  const filteredLabels = labelRequests.filter(label => {
    return searchTerm === '' ||
      label.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      label.lotNumber?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const years = Array.from(new Set(lots.map(lot => lot.year))).sort((a, b) => b - a);
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">LOT Management System</h1>
        <p className="text-gray-600">
          Manage LOT numbers, track batch history, and handle label requests
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total LOTs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lots.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(lots.map(l => l.productId)).size}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Pending Labels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {labelRequests.filter(l => l.status === 'pending').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lots.filter(l =>
                l.year === new Date().getFullYear() &&
                l.month === months[new Date().getMonth()]
              ).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <Button
          variant={activeTab === 'lots' ? 'default' : 'outline'}
          onClick={() => setActiveTab('lots')}
        >
          <ClipboardDocumentCheckIcon className="h-4 w-4 mr-2" />
          LOT Numbers
        </Button>
        <Button
          variant={activeTab === 'labels' ? 'default' : 'outline'}
          onClick={() => setActiveTab('labels')}
        >
          <PrinterIcon className="h-4 w-4 mr-2" />
          Label Requests
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search by product, SKU, or LOT..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {activeTab === 'lots' && (
              <>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {months.map(month => (
                      <SelectItem key={month} value={month}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            <Button onClick={exportLOTData} variant="outline">
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">Loading...</div>
          ) : activeTab === 'lots' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>LOT Number</TableHead>
                  <TableHead>Month/Year</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell className="font-medium">
                      {lot.productTitle}
                    </TableCell>
                    <TableCell>
                      <code className="text-sm">{lot.sku || '-'}</code>
                    </TableCell>
                    <TableCell>
                      {lot.lotNumber ? (
                        <Badge variant="outline">{lot.lotNumber}</Badge>
                      ) : (
                        <span className="text-gray-400">Not generated</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {lot.month} {lot.year}
                    </TableCell>
                    <TableCell>
                      {new Date(lot.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {!lot.lotNumber && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generateNewLOT(lot.productId)}
                          >
                            <PlusIcon className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline">
                          <DocumentDuplicateIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>LOT Number</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Printed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLabels.map((label) => (
                  <TableRow key={label.id}>
                    <TableCell className="font-medium">
                      {label.productName || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {label.lotNumber ? (
                        <Badge variant="outline">{label.lotNumber}</Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{label.quantity || 0}</TableCell>
                    <TableCell>
                      <Badge
                        variant={label.status === 'printed' ? 'default' : 'secondary'}
                      >
                        {label.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm">
                          {new Date(label.requestedAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {label.requestedBy || 'Unknown'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {label.printedAt ? (
                        <div>
                          <div className="text-sm">
                            {new Date(label.printedAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {label.printedBy || 'Unknown'}
                          </div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}