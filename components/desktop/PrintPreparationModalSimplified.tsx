'use client';

import { XMarkIcon } from '@heroicons/react/24/solid';
import { Button } from '@/components/ui/button';
import ProgressBar from '@/components/ui/ProgressBar';
import { usePrintPreparation } from '@/hooks/usePrintPreparation';
import PrintItemCard from '@/components/print/PrintItemCard';
import PrintSummary from '@/components/print/PrintSummary';
import PrintModalActions from '@/components/print/PrintModalActions';

interface FreightOrder {
  orderId: number;
  orderNumber: string;
  customerName?: string;
  items?: any[];
}

interface PrintPreparationModalSimplifiedProps {
  order: FreightOrder;
  onClose: () => void;
  onPrintComplete: () => void;
}

export default function PrintPreparationModalSimplified({ 
  order, 
  onClose, 
  onPrintComplete 
}: PrintPreparationModalSimplifiedProps) {
  const {
    loading,
    printing,
    labelQuantities,
    regenerating,
    filteredItems,
    totalLabels,
    mode,
    setMode,
    handleQuantityChange,
    handlePrint
  } = usePrintPreparation({ order, onPrintComplete });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-warehouse-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-warehouse-xl">
        {/* Header */}
        <div className="bg-warehouse-info text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-warehouse-2xl font-black">PRINT LABELS</h2>
            <p className="text-warehouse-lg opacity-90">Order #{order.orderNumber}</p>
          </div>
          <Button
            onClick={onClose}
            variant="neutral"
            size="base"
            icon={<XMarkIcon className="h-6 w-6" />}
          />
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {loading ? (
            <div className="py-12">
              <ProgressBar
                value={50}
                label="Loading QR codes"
                showPercentage={false}
                variant="default"
                animated={true}
                className="max-w-md mx-auto"
              />
            </div>
          ) : (
            <div className="space-y-6">
              {filteredItems.map((item, index) => (
                <PrintItemCard
                  key={`${item.name}-${index}`}
                  item={item}
                  labelQuantity={labelQuantities[item.name] || 1}
                  isRegenerating={regenerating[item.name] || false}
                  onQuantityChange={handleQuantityChange}
                />
              ))}
              
              <PrintSummary 
                itemCount={filteredItems.length}
                totalLabels={totalLabels}
              />
            </div>
          )}
        </div>
        
        {/* Footer Actions */}
        <PrintModalActions
          onClose={onClose}
          onPrint={handlePrint}
          printing={printing}
          loading={loading}
          mode={mode}
          onModeChange={setMode}
        />
      </div>
    </div>
  );
}
