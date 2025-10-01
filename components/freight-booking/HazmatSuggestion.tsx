import React from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HiCheckCircle, HiExclamation, HiLightBulb, HiX } from 'react-icons/hi';

interface HazmatSuggestionData {
  un_number: string | null;
  proper_shipping_name: string | null;
  hazard_class: string | null;
  packing_group: string | null;
  confidence: number;
  source: 'database' | 'rag' | 'rules';
  exemption_reason?: string;
}

interface HazmatSuggestionProps {
  sku: string;
  productName: string;
  suggestion: HazmatSuggestionData;
  onAccept: (sku: string, classification: HazmatSuggestionData) => void;
  onReject: (sku: string) => void;
}

export function HazmatSuggestion({
  sku,
  productName,
  suggestion,
  onAccept,
  onReject,
}: HazmatSuggestionProps) {
  const confidenceColor = suggestion.confidence >= 0.95 ? 'success' : 
                          suggestion.confidence >= 0.85 ? 'warning' : 'failure';
  
  const confidencePercent = Math.round(suggestion.confidence * 100);
  
  const sourceLabel = {
    database: 'Verified',
    rules: 'CFR 49 Rules',
    rag: `AI (${confidencePercent}%)`
  }[suggestion.source];

  if (!suggestion.un_number && suggestion.exemption_reason) {
    // Non-regulated item
    return (
      <Alert 
        color="info" 
        icon={HiLightBulb}
        additionalContent={
          <div className="flex gap-2 mt-3">
            <Button 
              size="xs" 
              color="success"
              onClick={() => onAccept(sku, suggestion)}
            >
              <HiCheckCircle className="mr-1 h-4 w-4" />
              Accept Non-Regulated Status
            </Button>
            <Button 
              size="xs" 
              color="gray" 
              onClick={() => onReject(sku)}
            >
              <HiX className="mr-1 h-4 w-4" />
              Reject
            </Button>
          </div>
        }
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="font-medium">{productName}</span>
            <span className="ml-2 text-sm text-gray-600">SKU: {sku}</span>
          </div>
          <Badge color={confidenceColor} size="sm">
            {sourceLabel}
          </Badge>
        </div>
        <div className="mt-2 text-sm">
          <span className="font-semibold">Not Regulated: </span>
          {suggestion.exemption_reason}
        </div>
      </Alert>
    );
  }

  return (
    <Alert 
      color="warning" 
      icon={HiExclamation}
      additionalContent={
        <div className="flex gap-2 mt-3">
          <Button 
            size="xs" 
            color="success"
            onClick={() => onAccept(sku, suggestion)}
          >
            <HiCheckCircle className="mr-1 h-4 w-4" />
            Accept Classification
          </Button>
          <Button 
            size="xs" 
            color="gray" 
            onClick={() => onReject(sku)}
          >
            <HiX className="mr-1 h-4 w-4" />
            Reject
          </Button>
        </div>
      }
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="font-medium">{productName}</span>
          <span className="ml-2 text-sm text-gray-600">SKU: {sku}</span>
        </div>
        <Badge color={confidenceColor} size="sm">
          {sourceLabel}
        </Badge>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="font-semibold">UN Number: </span>
          <span className="text-orange-600 font-mono">{suggestion.un_number}</span>
        </div>
        <div>
          <span className="font-semibold">Class: </span>
          {suggestion.hazard_class}
        </div>
        <div>
          <span className="font-semibold">Packing Group: </span>
          {suggestion.packing_group}
        </div>
        <div className="col-span-2">
          <span className="font-semibold">Shipping Name: </span>
          {suggestion.proper_shipping_name}
        </div>
      </div>
    </Alert>
  );
}
