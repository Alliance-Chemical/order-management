"use client";

import { HiExclamation, HiLink } from "react-icons/hi";
import { Alert, Button } from "flowbite-react";

interface MissingClassificationAlertProps {
  skusWithNoClassification: string[];
  products: Array<{ sku: string; name: string }>;
  onLinkClick: (sku: string, name: string) => void;
}

export default function MissingClassificationAlert({
  skusWithNoClassification,
  products,
  onLinkClick,
}: MissingClassificationAlertProps) {
  if (skusWithNoClassification.length === 0) return null;

  const missingProducts = products.filter(p => 
    skusWithNoClassification.includes(p.sku)
  );

  return (
    <Alert
      color="warning"
      icon={HiExclamation}
      className="mb-4"
    >
      <div className="flex flex-col gap-3">
        <div className="font-semibold text-orange-800 dark:text-orange-200">
          {skusWithNoClassification.length === 1
            ? "1 product needs freight classification before booking"
            : `${skusWithNoClassification.length} products need freight classification before booking`}
        </div>
        
        <div className="space-y-2">
          {missingProducts.map((product) => (
            <div
              key={product.sku}
              className="flex items-center justify-between rounded-lg bg-orange-50 dark:bg-orange-900/20 p-3"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">
                  {product.name}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  SKU: {product.sku}
                </div>
              </div>
              
              <Button
                size="sm"
                color="blue"
                onClick={() => onLinkClick(product.sku, product.name)}
                className="ml-4"
              >
                <HiLink className="mr-2 h-4 w-4" />
                Link Classification
              </Button>
            </div>
          ))}
        </div>
        
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Link freight classifications to enable the "Book Freight" button
        </div>
      </div>
    </Alert>
  );
}