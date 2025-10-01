"use client";

import { useFreightActionTracking } from "@/app/lib/telemetry/freight-telemetry";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useCallback, useEffect, useState } from "react";
import { suggestFreight } from '@/app/actions/freight';
import type { FreightSuggestion, FreightAccessorial } from '@/types/components';
import { FreightCarrierRecommendation } from './FreightCarrierRecommendation';
import { FreightAccessorials } from './FreightAccessorials';
import { FreightEstimates } from './FreightEstimates';
import { FreightAIInsights } from './FreightAIInsights';
import { HiCheckCircle, HiLightBulb, HiXCircle } from "react-icons/hi";

interface AIFreightSuggestionProps {
  orderNumber: string;
  orderData: Record<string, unknown>;
  onAccept: (suggestion: FreightSuggestion) => void;
  onReject: () => void;
  onModify?: (modifiedSuggestion: FreightSuggestion) => void;
}

export default function AIFreightSuggestion({
  orderNumber,
  orderData,
  onAccept,
  onReject,
}: AIFreightSuggestionProps) {
  const [suggestion, setSuggestion] = useState<FreightSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { trackAISuggestionInteraction } = useFreightActionTracking();

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await suggestFreight({
        orderId: orderNumber,
        items: orderData.items || [],
        customer: orderData.customer || {},
        destination: orderData.destination || {},
        origin: orderData.origin || { city: "River Grove", state: "IL", zip: "60171" }
      });

      if (!data) {
        throw new Error('No data received from freight suggestion service');
      }
      
      if (data.success && data.suggestion) {
        // Transform the response to match our expected format
        const transformedSuggestion: FreightSuggestion = {
          carrier: {
            name: data.suggestion.carrier || "SAIA",
            confidence: data.confidence || 0.5,
            reasoning: data.reasoning || "Based on standard shipping patterns"
          },
          service: {
            type: data.suggestion.carrierService || "Standard",
            confidence: data.confidence || 0.5,
            reasoning: "Service type recommendation"
          },
          accessorials: (data.suggestion.accessorials || []).map((acc: string) => ({
            type: acc,
            recommended: true,
            confidence: 0.7,
            reasoning: "Commonly used for this route"
          })),
          estimatedCost: data.suggestion.estimatedCost ? {
            low: data.suggestion.estimatedCost * 0.9,
            high: data.suggestion.estimatedCost * 1.1,
            average: data.suggestion.estimatedCost
          } : undefined,
          estimatedTransitDays: data.suggestion.estimatedTransitDays ? {
            min: Math.max(1, data.suggestion.estimatedTransitDays - 1),
            max: data.suggestion.estimatedTransitDays + 1,
            typical: data.suggestion.estimatedTransitDays
          } : undefined,
          overallConfidence: data.confidence || 0.5,
          aiInsights: data.isDefaultFallback ?
            ["Using default configuration", "Limited historical data available"] :
            [`Based on ${data.similarShipments?.length || 0} similar shipments`]
        };

        setSuggestion(transformedSuggestion);
      } else if (!data.success && data.fallbackSuggestion) {
        // Use fallback suggestion if provided
        const fallback = data.fallbackSuggestion;
        setSuggestion({
          carrier: { name: fallback.carrier, confidence: 0.3, reasoning: "Default carrier" },
          service: { type: fallback.carrierService, confidence: 0.3, reasoning: "Standard service" },
          accessorials: [],
          estimatedCost: { low: 400, high: 600, average: 500 },
          estimatedTransitDays: { min: 2, max: 4, typical: 3 },
          overallConfidence: 0.3,
          aiInsights: ["Using default configuration due to system limitations"]
        });
      } else {
        throw new Error(data.error || "Unable to generate suggestions");
      }

    } catch (err) {
      console.error("AI suggestion error:", err);

      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';

      // Check if it's a network error that we should retry
      const isNetworkError = errorMessage.toLowerCase().includes('fetch') ||
                            errorMessage.toLowerCase().includes('network');

      if (isNetworkError) {
        setError('Network error - Click retry to try again');
      } else {
        // Don't block the user - provide a basic suggestion
        setSuggestion({
          carrier: { name: "SAIA", confidence: 0.2, reasoning: "Default fallback carrier" },
          service: { type: "Standard", confidence: 0.2, reasoning: "Default service type" },
          accessorials: [],
          estimatedCost: { low: 400, high: 600, average: 500 },
          estimatedTransitDays: { min: 2, max: 5, typical: 3 },
          overallConfidence: 0.2,
          aiInsights: ["Manual review recommended - AI assistance temporarily unavailable"]
        });
      }
    } finally {
      setLoading(false);
    }
  }, [orderData, orderNumber]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleAccept = () => {
    if (suggestion) {
      trackAISuggestionInteraction("accepted", suggestion);
      onAccept(suggestion);
    }
  };

  const handleReject = () => {
    if (suggestion) {
      trackAISuggestionInteraction("rejected", suggestion);
    }
    onReject();
  };

  const handleAccessorialToggle = (accessorial: FreightAccessorial) => {
    if (!suggestion) return;

    const modifiedSuggestion = {
      ...suggestion,
      accessorials: suggestion.accessorials.map((a) =>
        a.type === accessorial.type ? { ...a, recommended: !a.recommended } : a,
      ),
    };

    setSuggestion(modifiedSuggestion);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "success";
    if (confidence >= 0.6) return "warning";
    return "failure";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return "High";
    if (confidence >= 0.6) return "Medium";
    return "Low";
  };

  if (loading) {
    return (
      <Card className="w-full">
        <div className="flex items-center justify-center p-8">
          <Spinner size="xl" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Analyzing shipment patterns...
          </span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
        <div className="p-4">
          <div className="flex items-center mb-3">
            <HiXCircle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
            <span className="ml-2 text-red-600 dark:text-red-400 font-semibold">{error}</span>
          </div>
          <Button
            onClick={() => {
              setError(null);
              fetchSuggestions();
            }}
            variant="destructive"
            size="sm"
            aria-label="Retry fetching freight suggestions"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!suggestion) return null;

  return (
    <Card className="w-full">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <HiLightBulb className="h-6 w-6 text-yellow-400" aria-hidden="true" />
            <h3 className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">
              AI Freight Recommendation
            </h3>
          </div>
          <Badge color={getConfidenceColor(suggestion.overallConfidence)}>
            {getConfidenceLabel(suggestion.overallConfidence)} Confidence (
            {Math.round(suggestion.overallConfidence * 100)}%)
          </Badge>
        </div>

        {/* Carrier Recommendation */}
        <FreightCarrierRecommendation
          carrier={suggestion.carrier}
          service={suggestion.service}
          getConfidenceColor={getConfidenceColor}
        />

        {/* Accessorials */}
        <FreightAccessorials
          accessorials={suggestion.accessorials}
          onToggle={handleAccessorialToggle}
        />

        {/* Cost & Transit Estimates */}
        <FreightEstimates
          estimatedCost={suggestion.estimatedCost}
          estimatedTransitDays={suggestion.estimatedTransitDays}
        />

        {/* AI Insights */}
        <FreightAIInsights insights={suggestion.aiInsights} />

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3" role="group" aria-label="Freight recommendation actions">
          <Button color="gray" onClick={handleReject} aria-label="Reject AI recommendation and use manual selection">
            <HiXCircle className="mr-2 h-5 w-5" aria-hidden="true" />
            Use Manual Selection
          </Button>
          <Button color="success" onClick={handleAccept} aria-label="Accept AI freight recommendation">
            <HiCheckCircle className="mr-2 h-5 w-5" aria-hidden="true" />
            Accept Recommendation
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default AIFreightSuggestion;
