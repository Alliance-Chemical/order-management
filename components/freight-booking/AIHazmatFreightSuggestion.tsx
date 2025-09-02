"use client";

// Telemetry integration placeholder - will be implemented in telemetry phase
import { Badge, Button, Card, Progress, Spinner, Alert } from "flowbite-react";
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
  HiExclamationCircle,
  HiShieldCheck,
  HiBeaker,
  HiFire,
  HiLightningBolt,
} from "react-icons/hi";

interface HazmatRequirement {
  type: string;
  required: boolean;
  description: string;
  regulatoryReference?: string;
}

interface HazmatFreightSuggestion {
  carrier: {
    name: string;
    hazmatCertified: boolean;
    hazmatExperience: string;
    confidence: number;
    reasoning: string;
  };
  service: {
    type: string;
    hazmatApproved: boolean;
    confidence: number;
    reasoning: string;
  };
  hazmatRequirements: HazmatRequirement[];
  segregationRequirements: Array<{
    chemical1: string;
    chemical2: string;
    requirement: string;
  }>;
  packaging: {
    unSpecification: string;
    packingGroup: string;
    packagingInstructions: string[];
  };
  placarding: {
    required: boolean;
    placards: Array<{
      hazardClass: string;
      unNumber: string;
      position: string;
    }>;
  };
  documentation: {
    shippingPaper: boolean;
    emergencyResponse: boolean;
    dangerousGoodsDeclaration: boolean;
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
    hazmatSurcharge: number;
  };
  estimatedTransitDays?: {
    min: number;
    max: number;
    typical: number;
  };
  overallConfidence: number;
  complianceScore: number;
  riskAssessment: {
    level: "low" | "medium" | "high";
    factors: string[];
    mitigations: string[];
  };
  aiInsights: string[];
  historicalIncidents?: Array<{
    date: string;
    chemical: string;
    incident: string;
    resolution: string;
  }>;
}

interface AIHazmatFreightSuggestionProps {
  orderNumber: string;
  orderData: Record<string, unknown>;
  classificationInfo: Record<string, any>;
  onAccept: (suggestion: HazmatFreightSuggestion) => void;
  onReject: () => void;
  onModify?: (modifiedSuggestion: HazmatFreightSuggestion) => void;
}

export default function AIHazmatFreightSuggestion({
  orderNumber,
  orderData,
  classificationInfo,
  onAccept,
  onReject,
}: AIHazmatFreightSuggestionProps) {
  const [suggestion, setSuggestion] = useState<HazmatFreightSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState<"recommendation" | "compliance" | "history">("recommendation");
  
  // Telemetry tracking placeholder
  const trackAISuggestionInteraction = (action: string, suggestion: any, feedback?: string) => {
    console.log(`AI Suggestion ${action}:`, { suggestion, feedback });
  };

  // Get hazard class styling
  const getHazardClassStyle = (hazardClass: string) => {
    const classNum = hazardClass?.match(/\d+/)?.[0];
    switch (classNum) {
      case "1": return { color: "orange", icon: HiLightningBolt, label: "Explosive" };
      case "2": return { color: "red", icon: HiExclamationCircle, label: "Gas" };
      case "3": return { color: "red", icon: HiFire, label: "Flammable Liquid" };
      case "4": return { color: "yellow", icon: HiFire, label: "Flammable Solid" };
      case "5": return { color: "yellow", icon: HiExclamationCircle, label: "Oxidizer" };
      case "6": return { color: "white", icon: HiExclamationCircle, label: "Toxic" };
      case "7": return { color: "yellow", icon: HiExclamationCircle, label: "Radioactive" };
      case "8": return { color: "white", icon: HiBeaker, label: "Corrosive" };
      case "9": return { color: "gray", icon: HiExclamationCircle, label: "Miscellaneous" };
      default: return { color: "gray", icon: HiInformationCircle, label: "Unknown" };
    }
  };

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Enhance order data with hazmat classifications
      const hazmatItems = (orderData.items as any[] || [])
        .filter((item: any) => classificationInfo[item.sku]?.hazardous)
        .map((item: any) => ({
          ...item,
          hazardClass: classificationInfo[item.sku]?.hazard_class,
          unNumber: classificationInfo[item.sku]?.hazard_id,
          packingGroup: classificationInfo[item.sku]?.packing_group,
          properShippingName: classificationInfo[item.sku]?.description,
        }));

      const response = await fetch("/api/freight/hazmat-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          orderId: orderNumber,
          items: orderData.items || [],
          hazmatItems,
          customer: orderData.customer || {},
          destination: orderData.destination || {},
          origin: orderData.origin || { city: "River Grove", state: "IL", zip: "60171" }
        }),
      });

      const data = await response.json();
      
      if (data.success && data.suggestion) {
        setSuggestion(data.suggestion);
      } else {
        // Create a comprehensive fallback suggestion
        setSuggestion(createFallbackSuggestion(hazmatItems));
      }

    } catch (err) {
      console.error("Hazmat AI suggestion error:", err);
      setSuggestion(createFallbackSuggestion([]));
    } finally {
      setLoading(false);
    }
  }, [orderData, orderNumber, classificationInfo]);

  const createFallbackSuggestion = (hazmatItems: any[]): HazmatFreightSuggestion => {
    const hasClass3 = hazmatItems.some(i => i.hazardClass?.includes("3"));
    const hasClass8 = hazmatItems.some(i => i.hazardClass?.includes("8"));
    
    return {
      carrier: {
        name: "SAIA",
        hazmatCertified: true,
        hazmatExperience: "15+ years handling hazmat shipments",
        confidence: 0.3,
        reasoning: "Default carrier with hazmat certification"
      },
      service: {
        type: "Hazmat Ground",
        hazmatApproved: true,
        confidence: 0.3,
        reasoning: "Standard hazmat ground service"
      },
      hazmatRequirements: [
        {
          type: "Proper Shipping Papers",
          required: true,
          description: "Complete dangerous goods declaration with 24-hour emergency contact",
          regulatoryReference: "49 CFR 172.200"
        },
        {
          type: "UN Specification Packaging",
          required: true,
          description: "UN-certified packaging appropriate for packing group",
          regulatoryReference: "49 CFR 173"
        },
        {
          type: "Hazmat Placards",
          required: hazmatItems.length > 0,
          description: "Vehicle placarding required for hazard classes present",
          regulatoryReference: "49 CFR 172.500"
        },
      ],
      segregationRequirements: hasClass3 && hasClass8 ? [{
        chemical1: "Class 3 (Flammable)",
        chemical2: "Class 8 (Corrosive)",
        requirement: "Separate by at least 3 meters"
      }] : [],
      packaging: {
        unSpecification: "UN 1H1",
        packingGroup: hazmatItems[0]?.packingGroup || "II",
        packagingInstructions: [
          "Use UN-approved drums",
          "Ensure proper sealing",
          "Apply appropriate labels"
        ]
      },
      placarding: {
        required: hazmatItems.length > 0,
        placards: hazmatItems.map(item => ({
          hazardClass: item.hazardClass,
          unNumber: item.unNumber,
          position: "All sides of transport vehicle"
        }))
      },
      documentation: {
        shippingPaper: true,
        emergencyResponse: true,
        dangerousGoodsDeclaration: true
      },
      accessorials: [
        {
          type: "Hazmat Fee",
          recommended: true,
          confidence: 1.0,
          reasoning: "Required for all hazmat shipments"
        }
      ],
      estimatedCost: {
        low: 600,
        high: 900,
        average: 750,
        hazmatSurcharge: 150
      },
      estimatedTransitDays: {
        min: 3,
        max: 5,
        typical: 4
      },
      overallConfidence: 0.3,
      complianceScore: 0.7,
      riskAssessment: {
        level: hazmatItems.length > 2 ? "medium" : "low",
        factors: ["Multiple hazard classes", "Segregation requirements"],
        mitigations: ["Proper packaging", "Experienced carrier", "Clear documentation"]
      },
      aiInsights: ["Using default hazmat configuration", "Manual review recommended"],
      historicalIncidents: []
    };
  };

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleAccept = () => {
    if (suggestion) {
      trackAISuggestionInteraction("accepted", suggestion as any);
      onAccept(suggestion);
    }
  };

  const handleReject = () => {
    setShowFeedback(true);
  };
  
  const submitRejection = () => {
    if (suggestion) {
      trackAISuggestionInteraction("rejected", suggestion as any, feedbackReason);
      onReject();
      setShowFeedback(false);
      setFeedbackReason("");
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "success";
    if (confidence >= 0.6) return "warning";
    return "failure";
  };

  const getComplianceColor = (score: number) => {
    if (score >= 0.9) return "success";
    if (score >= 0.7) return "warning";
    return "failure";
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low": return "success";
      case "medium": return "warning";
      case "high": return "failure";
      default: return "gray";
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <div className="flex items-center justify-center p-8">
          <Spinner size="xl" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Analyzing hazmat requirements and regulations...
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
        {/* Header with Compliance Score */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <HiBeaker className="h-6 w-6 text-red-600" />
            <h3 className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">
              Hazmat AI Freight Recommendation
            </h3>
          </div>
          <div className="flex gap-2">
            <Badge color={getComplianceColor(suggestion.complianceScore)}>
              Compliance: {Math.round(suggestion.complianceScore * 100)}%
            </Badge>
            <Badge color={getRiskColor(suggestion.riskAssessment.level)}>
              Risk: {suggestion.riskAssessment.level.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab("recommendation")}
            className={`px-4 py-2 font-medium ${
              activeTab === "recommendation"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600"
            }`}
          >
            Recommendation
          </button>
          <button
            onClick={() => setActiveTab("compliance")}
            className={`px-4 py-2 font-medium ${
              activeTab === "compliance"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600"
            }`}
          >
            Compliance & Safety
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 font-medium ${
              activeTab === "history"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600"
            }`}
          >
            Historical Data
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "recommendation" && (
          <div className="space-y-4">
            {/* Carrier Recommendation */}
            <div className="rounded-lg border p-4 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <HiTruck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="ml-2 font-medium">Hazmat Carrier & Service</span>
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
                {suggestion.carrier.hazmatCertified && (
                  <Badge color="success" size="xs" className="mt-1">
                    <HiShieldCheck className="mr-1 h-3 w-3" />
                    Hazmat Certified
                  </Badge>
                )}
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {suggestion.carrier.hazmatExperience}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {suggestion.carrier.reasoning}
                </p>
              </div>
            </div>

            {/* Cost & Transit */}
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
                    Includes ${suggestion.estimatedCost.hazmatSurcharge} hazmat fee
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
                    Ground transport only (hazmat restricted)
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "compliance" && (
          <div className="space-y-4">
            {/* Hazmat Requirements */}
            <div className="rounded-lg border p-4 dark:border-gray-600">
              <h4 className="mb-3 font-medium">Hazmat Requirements</h4>
              <div className="space-y-2">
                {suggestion.hazmatRequirements.map((req, idx) => (
                  <div
                    key={idx}
                    className="flex items-start space-x-2 rounded-lg bg-gray-50 p-2 dark:bg-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={req.required}
                      readOnly
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{req.type}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {req.description}
                      </div>
                      {req.regulatoryReference && (
                        <Badge size="xs" color="info" className="mt-1">
                          {req.regulatoryReference}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Segregation Requirements */}
            {suggestion.segregationRequirements.length > 0 && (
              <Alert color="warning" icon={HiExclamationCircle}>
                <span className="font-medium">Segregation Required</span>
                {suggestion.segregationRequirements.map((seg, idx) => (
                  <div key={idx} className="mt-2 text-sm">
                    {seg.chemical1} and {seg.chemical2}: {seg.requirement}
                  </div>
                ))}
              </Alert>
            )}

            {/* Packaging Requirements */}
            <div className="rounded-lg border p-4 dark:border-gray-600">
              <h4 className="mb-3 font-medium">Packaging Requirements</h4>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium">UN Specification:</span>
                  <Badge className="ml-2">{suggestion.packaging.unSpecification}</Badge>
                </div>
                <div>
                  <span className="text-sm font-medium">Packing Group:</span>
                  <Badge className="ml-2" color="warning">
                    {suggestion.packaging.packingGroup}
                  </Badge>
                </div>
                <div className="mt-2">
                  <span className="text-sm font-medium">Instructions:</span>
                  <ul className="mt-1 list-inside list-disc text-sm text-gray-600 dark:text-gray-400">
                    {suggestion.packaging.packagingInstructions.map((inst, idx) => (
                      <li key={idx}>{inst}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Documentation Requirements */}
            <div className="rounded-lg border p-4 dark:border-gray-600">
              <h4 className="mb-3 font-medium">Required Documentation</h4>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={suggestion.documentation.shippingPaper}
                    readOnly
                    className="mr-2"
                  />
                  <span className="text-sm">Shipping Paper</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={suggestion.documentation.emergencyResponse}
                    readOnly
                    className="mr-2"
                  />
                  <span className="text-sm">Emergency Info</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={suggestion.documentation.dangerousGoodsDeclaration}
                    readOnly
                    className="mr-2"
                  />
                  <span className="text-sm">DG Declaration</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            {/* Risk Assessment */}
            <div className="rounded-lg border p-4 dark:border-gray-600">
              <h4 className="mb-3 font-medium">Risk Assessment</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Risk Level:</span>
                  <Badge color={getRiskColor(suggestion.riskAssessment.level)}>
                    {suggestion.riskAssessment.level.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm font-medium">Risk Factors:</span>
                  <ul className="mt-1 list-inside list-disc text-sm text-gray-600 dark:text-gray-400">
                    {suggestion.riskAssessment.factors.map((factor, idx) => (
                      <li key={idx}>{factor}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-sm font-medium">Mitigations:</span>
                  <ul className="mt-1 list-inside list-disc text-sm text-green-600 dark:text-green-400">
                    {suggestion.riskAssessment.mitigations.map((mitigation, idx) => (
                      <li key={idx}>{mitigation}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Historical Incidents */}
            {suggestion.historicalIncidents && suggestion.historicalIncidents.length > 0 && (
              <div className="rounded-lg border p-4 dark:border-gray-600">
                <h4 className="mb-3 font-medium">Historical Incidents</h4>
                <div className="space-y-2">
                  {suggestion.historicalIncidents.map((incident, idx) => (
                    <div key={idx} className="rounded bg-red-50 p-2 dark:bg-red-900/20">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{incident.chemical}</span>
                        <span className="text-gray-500">{incident.date}</span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {incident.incident}
                      </div>
                      <div className="mt-1 text-sm text-green-600 dark:text-green-400">
                        Resolution: {incident.resolution}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Insights */}
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
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 border-t pt-4">
          <Button color="gray" onClick={handleReject}>
            <HiXCircle className="mr-2 h-5 w-5" />
            Use Manual Selection
          </Button>
          <Button color="success" onClick={handleAccept}>
            <HiCheckCircle className="mr-2 h-5 w-5" />
            Accept Hazmat Recommendation
          </Button>
        </div>

        {/* Feedback Modal */}
        {showFeedback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <Card className="w-96">
              <h3 className="text-lg font-semibold">Feedback</h3>
              <textarea
                className="mt-2 w-full rounded border p-2"
                rows={3}
                placeholder="Why are you rejecting this recommendation?"
                value={feedbackReason}
                onChange={(e) => setFeedbackReason(e.target.value)}
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button color="gray" onClick={() => setShowFeedback(false)}>
                  Cancel
                </Button>
                <Button color="failure" onClick={submitRejection}>
                  Submit & Reject
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Card>
  );
}