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

  const badgeClass = {
    success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    failure: 'bg-rose-100 text-rose-800 border-rose-200',
  }[confidenceColor];

  const ActionButtons = ({ acceptLabel }: { acceptLabel: string }) => (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="go"
        onClick={() => onAccept(sku, suggestion)}
      >
        <HiCheckCircle className="mr-1 h-4 w-4" />
        {acceptLabel}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onReject(sku)}
      >
        <HiX className="mr-1 h-4 w-4" />
        Reject
      </Button>
    </div>
  );

  if (!suggestion.un_number && suggestion.exemption_reason) {
    // Non-regulated item
    return (
      <Alert className="border-sky-200 bg-sky-50 dark:border-sky-700/60 dark:bg-sky-900/30">
        <div className="flex items-start gap-3">
          <HiLightBulb className="mt-0.5 h-5 w-5 text-sky-600" />
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="font-medium text-slate-900 dark:text-slate-100">{productName}</span>
                <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">SKU: {sku}</span>
              </div>
              <Badge className={badgeClass}>
                {sourceLabel}
              </Badge>
            </div>
            <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              <span className="font-semibold">Not Regulated: </span>
              {suggestion.exemption_reason}
            </div>
            <ActionButtons acceptLabel="Accept Non-Regulated Status" />
          </div>
        </div>
      </Alert>
    );
  }

  return (
    <Alert className="border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/30">
      <div className="flex items-start gap-3">
        <HiExclamation className="mt-0.5 h-5 w-5 text-amber-600" />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="font-medium text-slate-900 dark:text-slate-100">{productName}</span>
              <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">SKU: {sku}</span>
            </div>
            <Badge className={badgeClass}>
              {sourceLabel}
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700 dark:text-slate-300">
            <div>
              <span className="font-semibold">UN Number: </span>
              <span className="font-mono text-amber-700 dark:text-amber-300">{suggestion.un_number}</span>
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
          <ActionButtons acceptLabel="Accept Classification" />
        </div>
      </div>
    </Alert>
  );
}
