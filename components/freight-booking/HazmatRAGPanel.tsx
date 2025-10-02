'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { HiLightBulb, HiSparkles, HiCheckCircle, HiArrowRight, HiRefresh, HiExclamation } from 'react-icons/hi';
import Link from 'next/link';
import { classifyHazmat } from '@/app/actions/ai';

export interface RAGSuggestion {
  un_number: string | null;
  proper_shipping_name: string | null;
  hazard_class: string | null;
  packing_group: string | null;
  confidence: number;
  source: 'database' | 'rag' | 'rules';
  exemption_reason?: string;
}

interface HazmatRAGPanelProps {
  unclassifiedSKUs: string[];
  items: Array<{ sku: string; name: string }>;
  onSuggestionAccepted?: (sku: string, suggestion: RAGSuggestion) => void;
}

export function HazmatRAGPanel({ unclassifiedSKUs, items, onSuggestionAccepted }: HazmatRAGPanelProps) {
  const [suggestions, setSuggestions] = useState<Record<string, RAGSuggestion>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (unclassifiedSKUs.length > 0) {
      fetchSuggestionsForAll();
    }
  }, [unclassifiedSKUs]);

  const fetchSuggestionsForAll = async () => {
    setIsLoading(true);
    const newSuggestions: Record<string, RAGSuggestion> = {};
    
    for (const sku of unclassifiedSKUs.slice(0, 3)) { // Limit to first 3 for performance
      const item = items.find(i => i.sku === sku);
      if (item) {
        try {
          const data = await classifyHazmat({ 
            sku, 
            productName: item.name 
          });
          
          if (data.success && 'confidence' in data) {
            if ((data.confidence > 0.35 && data.un_number) || data.exemption_reason) {
              newSuggestions[sku] = {
                un_number: data.un_number,
                proper_shipping_name: data.proper_shipping_name,
                hazard_class: data.hazard_class,
                packing_group: data.packing_group,
                confidence: data.confidence,
                source: 'rag' as const,
                exemption_reason: data.exemption_reason
              };
            }
          }
        } catch (err) {
          console.error(`Failed to get suggestion for ${sku}:`, err);
        }
      }
    }
    
    setSuggestions(newSuggestions);
    setIsLoading(false);
  };

  const getConfidenceClass = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-emerald-500';
    if (confidence >= 0.6) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  if (unclassifiedSKUs.length === 0) {
    return null;
  }

  const currentSKU = unclassifiedSKUs[currentIndex];
  const currentItem = items.find(i => i.sku === currentSKU);
  const currentSuggestion = suggestions[currentSKU];
  const hasSuggestions = Object.keys(suggestions).length > 0;

  return (
    <Card className="bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 dark:from-amber-900/20 dark:via-orange-900/20 dark:to-red-900/20 border-2 border-orange-200 dark:border-orange-800">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <HiExclamation className="mr-2 h-6 w-6 text-red-500" />
              Hazmat Classification Required
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {unclassifiedSKUs.length} product{unclassifiedSKUs.length > 1 ? 's' : ''} need classification before shipping
            </p>
          </div>
          <Badge className="border-rose-200 bg-rose-100 px-3 py-1 text-rose-800">
            Action Required
          </Badge>
        </div>

        {/* Current Product */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-gray-900 dark:text-white">
              {currentItem?.name || currentSKU}
            </p>
          <Badge className="border-gray-200 bg-gray-100 text-gray-700">{currentSKU}</Badge>
          </div>
          
          {isLoading && !currentSuggestion ? (
            <div className="flex items-center justify-center py-4">
              <Spinner size="md" />
              <span className="ml-2 text-sm text-gray-500">Analyzing hazmat data...</span>
            </div>
          ) : currentSuggestion ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <HiSparkles className="h-5 w-5 text-yellow-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  RAG Assistant Found Match ({Math.round(currentSuggestion.confidence * 100)}% confidence)
                </span>
              </div>
              
              {currentSuggestion.exemption_reason ? (
                <Alert className="border-sky-200 bg-sky-50 py-3 dark:border-sky-700/60 dark:bg-sky-900/30">
                  <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                    <HiLightBulb className="mt-0.5 h-4 w-4 text-sky-600" />
                    <div>
                      <span className="font-semibold">Not Regulated</span>
                      <p className="mt-1 text-sm leading-snug">{currentSuggestion.exemption_reason}</p>
                    </div>
                  </div>
                </Alert>
              ) : (
                <div className="bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded p-3">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-gray-700 dark:text-gray-300 font-medium">UN:</span>
                      <span className="ml-1 font-mono font-bold text-orange-900 dark:text-orange-300">
                        {currentSuggestion.un_number}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-700 dark:text-gray-300 font-medium">Class:</span>
                      <span className="ml-1 font-bold text-gray-900 dark:text-white">{currentSuggestion.hazard_class}</span>
                    </div>
                    <div>
                      <span className="text-gray-700 dark:text-gray-300 font-medium">PG:</span>
                      <span className="ml-1 font-bold text-gray-900 dark:text-white">{currentSuggestion.packing_group || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">Shipping Name:</span>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{currentSuggestion.proper_shipping_name}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Alert className="border-amber-300 bg-amber-50 py-3 dark:border-amber-700/60 dark:bg-amber-900/30">
              <div className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                <HiExclamation className="mt-0.5 h-4 w-4 text-amber-600" />
                <div>
                  <span className="font-semibold">Manual Classification Needed</span>
                  <p className="mt-1 text-sm leading-snug">RAG couldn't determine classification automatically</p>
                </div>
              </div>
            </Alert>
          )}
        </div>

        {/* Navigation */}
        {unclassifiedSKUs.length > 1 && (
          <div className="flex items-center justify-center gap-2">
            {unclassifiedSKUs.slice(0, 5).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === currentIndex 
                    ? 'bg-orange-500' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
            {unclassifiedSKUs.length > 5 && (
              <span className="text-xs text-gray-500">+{unclassifiedSKUs.length - 5} more</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {currentSuggestion && currentSuggestion.confidence > 0.75 && !currentSuggestion.exemption_reason && (
            <Button
              variant="go"
              className="flex-1"
              onClick={() => {
                if (onSuggestionAccepted) {
                  onSuggestionAccepted(currentSKU, currentSuggestion);
                }
              }}
            >
              <HiCheckCircle className="mr-2 h-4 w-4" />
              Apply Classification
            </Button>
          )}
          <Link href={`/link?query=${currentSKU}`} className={currentSuggestion && currentSuggestion.confidence > 0.75 ? "" : "flex-1"}>
            <Button variant="stop" className="w-full">
              <HiArrowRight className="mr-2 h-4 w-4" />
              Go to Link Page
            </Button>
          </Link>
          {hasSuggestions && (
            <Button
              variant="secondary"
              onClick={fetchSuggestionsForAll}
              disabled={isLoading}
            >
              <HiRefresh className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Helper Text */}
        <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
          {hasSuggestions ? (
            <>
              <HiLightBulb className="inline mr-1 h-4 w-4 text-yellow-500" />
              RAG found {Object.keys(suggestions).length} automatic suggestion{Object.keys(suggestions).length > 1 ? 's' : ''}. 
              Click above to apply them on the link page.
            </>
          ) : (
            <>
              Products must have proper hazmat classifications for DOT compliance.
              Our RAG system can help identify most classifications automatically.
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
