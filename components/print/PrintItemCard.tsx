'use client';

import { Button } from '@/components/ui/button';
import { useGloveMode } from '@/contexts/GloveModeProvider';

interface PrintItemCardProps {
  item: {
    name: string;
    sku?: string;
    quantity: number;
  };
  labelQuantity: number;
  isRegenerating: boolean;
  onQuantityChange: (itemName: string, newQuantity: number) => void;
}

export default function PrintItemCard({
  item,
  labelQuantity,
  isRegenerating,
  onQuantityChange
}: PrintItemCardProps) {
  const { touchSize } = useGloveMode();

  return (
    <div className="warehouse-card">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Item Info */}
        <div className="flex-1">
          <h3 className="text-warehouse-xl font-black text-warehouse-text-primary mb-2">
            {item.name}
          </h3>
          {item.sku && (
            <p className="text-warehouse-lg text-warehouse-text-secondary">
              SKU: {item.sku}
            </p>
          )}
          <p className="text-warehouse-lg text-warehouse-text-secondary">
            Quantity: {item.quantity}
          </p>
        </div>
        
        {/* Label Quantity Selector */}
        <div className="flex items-center gap-4">
          <span className="text-warehouse-lg font-bold uppercase">
            Labels:
          </span>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onQuantityChange(item.name, labelQuantity - 1)}
              disabled={labelQuantity <= 1 || isRegenerating}
              variant="neutral"
              size="large"
            >
              <span className="text-2xl">−</span>
            </Button>
            
            <input
              type="number"
              value={labelQuantity}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                onQuantityChange(item.name, val);
              }}
              className="w-20 text-center text-warehouse-2xl font-black border-4 border-warehouse-border-heavy rounded-warehouse"
              style={{ minHeight: touchSize }}
              min="1"
            />
            
            <Button
              onClick={() => onQuantityChange(item.name, labelQuantity + 1)}
              disabled={isRegenerating}
              variant="go"
              size="large"
            >
              <span className="text-2xl">+</span>
            </Button>
          </div>
          
          {isRegenerating && (
            <div className="animate-spin h-8 w-8 border-4 border-warehouse-info border-t-transparent rounded-full" />
          )}
        </div>
      </div>
    </div>
  );
}