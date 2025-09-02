"use client";

import { useFreightActionTracking } from "@/app/lib/telemetry/freight-telemetry";
import { Badge, Button, Card, Progress, Spinner } from "flowbite-react";
import { useCallback, useEffect, useState } from "react";
import {
  HiCheckCircle,
  HiClock,
  HiCurrencyDollar,
  HiInformationCircle,
  HiLightBulb,
  HiThumbDown,
  HiThumbUp,
  HiTruck,
  HiXCircle,
} from "react-icons/hi";

interface FreightSuggestion {
  carrier: {
    name: string;
    confidence: number;
    reasoning: string;
  };
  service: {
    type: string;
    confidence: number;
    reasoning: string;
  };
  accessorials: Array<{
    type: string;
    recommended: boolean;
    confidence: number;
    reasoning: string;
  }>;
  estimatedCost?: {
    low: number;
    high: number;
    average: number;
  };
  estimatedTransitDays?: {
    min: number;
    max: number;
    typical: number;
  };
  overallConfidence: number;
  aiInsights: string[];
}

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
  const [showDetails, setShowDetails] = useState(false);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  
  const { trackAISuggestionInteraction } = useFreightActionTracking();

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/freight/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          orderId: orderNumber,
          items: orderData.items || [],
          customer: orderData.customer || {},
          destination: orderData.destination || {},
          origin: orderData.origin || { city: "River Grove", state: "IL", zip: "60171" }
        }),
      });

      const data = await response.json();
      
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
      } else if (!response.ok && data.fallbackSuggestion) {
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
      // Don't show error to user - we have a fallback
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
    setShowFeedback(true);
  };
  
  const submitRejection = () => {
    if (suggestion) {
      trackAISuggestionInteraction("rejected", suggestion, feedbackReason);
      onReject();
      setShowFeedback(false);
      setFeedbackReason("");
    }
  };

  const handleAccessorialToggle = (accessorial: {
    type: string;
    recommended: boolean;
  }) => {
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
        <div className="flex items-center">
          <HiXCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <span className="ml-2 text-red-600 dark:text-red-400">{error}</span>
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
            <HiLightBulb className="h-6 w-6 text-yellow-400" />
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
        <div className="rounded-lg border p-4 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <HiTruck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="ml-2 font-medium">Carrier & Service</span>
            </div>
            <Progress
              progress={suggestion.carrier.confidence * 100}
              size="sm"
              color={getConfidenceColor(suggestion.carrier.confidence)}
              className="w-32"
            />
          </div>
          <div className="mt-2">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {suggestion.carrier.name} - {suggestion.service.type}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {suggestion.carrier.reasoning}
            </p>
          </div>
        </div>

        {/* Accessorials */}
        <div className="rounded-lg border p-4 dark:border-gray-600">
          <h4 className="mb-3 font-medium">Recommended Accessorials</h4>
          <div className="space-y-2">
            {suggestion.accessorials.map((accessorial) => (
              <div
                key={accessorial.type}
                className="flex items-center justify-between rounded-lg bg-gray-50 p-2 dark:bg-gray-700"
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={accessorial.recommended}
                    onChange={() => handleAccessorialToggle(accessorial)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className="ml-2 text-sm">{accessorial.type}</span>
                  {accessorial.confidence >= 0.8 && (
                    <Badge size="xs" color="success" className="ml-2">
                      Recommended
                    </Badge>
                  )}
                </div>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  Why?
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Cost & Transit Estimates */}
        <div className="grid grid-cols-2 gap-4">
          {suggestion.estimatedCost && (
            <div className="rounded-lg border p-3 dark:border-gray-600">
              <div className="flex items-center">
                <HiCurrencyDollar className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="ml-2 text-sm font-medium">Estimated Cost</span>
              </div>
              <div className="mt-1 text-lg font-semibold">
                ${suggestion.estimatedCost.average.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">
                Range: ${suggestion.estimatedCost.low.toFixed(2)} - $
                {suggestion.estimatedCost.high.toFixed(2)}
              </div>
            </div>
          )}

          {suggestion.estimatedTransitDays && (
            <div className="rounded-lg border p-3 dark:border-gray-600">
              <div className="flex items-center">
                <HiClock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="ml-2 text-sm font-medium">Transit Time</span>
              </div>
              <div className="mt-1 text-lg font-semibold">
                {suggestion.estimatedTransitDays.typical} days
              </div>
              <div className="text-xs text-gray-500">
                Range: {suggestion.estimatedTransitDays.min}-
                {suggestion.estimatedTransitDays.max} days
              </div>
            </div>
          )}
        </div>

        {/* AI Insights */}
        {suggestion.aiInsights.length > 0 && (
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
            <div className="flex items-center">
              <HiInformationCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="ml-2 text-sm font-medium text-blue-900 dark:text-blue-100">
                AI Insights
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {suggestion.aiInsights.map((insight, index) => (
                <li
                  key={index}
                  className="text-sm text-blue-800 dark:text-blue-200"
                >
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <Button color="gray" onClick={handleReject}>
            <HiXCircle className="mr-2 h-5 w-5" />
            Use Manual Selection
          </Button>
          <Button color="success" onClick={handleAccept}>
            <HiCheckCircle className="mr-2 h-5 w-5" />
            Accept Recommendation
          </Button>
        </div>
      </div>
    </Card>
  );
}
