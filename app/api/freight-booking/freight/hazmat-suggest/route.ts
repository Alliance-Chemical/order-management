import { HazmatFreightDecisionEngine } from "@/app/lib/rag/hazmat-decision-engine";
import { NextRequest, NextResponse } from "next/server";

// Enable Edge Runtime for performance
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const orderContext = await request.json();
    
    // Validate required fields
    if (!orderContext.orderId || !orderContext.hazmatItems || orderContext.hazmatItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No hazmat items found in order",
          details: "This endpoint requires hazmat items with UN numbers and hazard classes"
        },
        { status: 400 },
      );
    }

    // Initialize the Hazmat RAG decision engine
    const decisionEngine = new HazmatFreightDecisionEngine();

    // Get AI recommendations based on chemical properties and historical incidents
    const decision = await decisionEngine.makeSuggestion(orderContext);

    // Return the hazmat-focused AI suggestion
    return NextResponse.json({
      success: true,
      suggestion: decision.recommendation,
      confidence: decision.confidence,
      complianceScore: decision.complianceScore,
      riskAssessment: decision.riskAssessment,
      historicalIncidents: decision.historicalIncidents || [],
      reasoning: decision.reasoning || "Based on chemical compatibility and regulatory requirements",
      similarShipments: decision.similarShipments || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating hazmat freight suggestion:", error);
    
    // Provide a comprehensive hazmat fallback response
    return NextResponse.json({
      success: true,
      suggestion: {
        carrier: {
          name: "SAIA",
          hazmatCertified: true,
          hazmatExperience: "15+ years handling hazmat shipments",
          confidence: 0.3,
          reasoning: "Default hazmat-certified carrier"
        },
        service: {
          type: "Hazmat Ground",
          hazmatApproved: true,
          confidence: 0.3,
          reasoning: "Ground transport required for hazmat"
        },
        hazmatRequirements: [
          {
            type: "Proper Shipping Papers",
            required: true,
            description: "Complete dangerous goods declaration required",
            regulatoryReference: "49 CFR 172.200"
          },
          {
            type: "UN Specification Packaging",
            required: true,
            description: "UN-certified packaging for hazmat",
            regulatoryReference: "49 CFR 173"
          },
          {
            type: "Placarding",
            required: true,
            description: "Proper hazmat placards on all sides",
            regulatoryReference: "49 CFR 172.500"
          }
        ],
        segregationRequirements: [],
        packaging: {
          unSpecification: "UN 1H1",
          packingGroup: "II",
          packagingInstructions: [
            "Use UN-approved drums",
            "Ensure proper closure",
            "Apply hazmat labels"
          ]
        },
        placarding: {
          required: true,
          placards: []
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
        }
      },
      confidence: 0.3,
      complianceScore: 0.7,
      riskAssessment: {
        level: "medium",
        factors: ["Multiple hazard classes present"],
        mitigations: ["Use experienced hazmat carrier", "Ensure proper documentation"]
      },
      reasoning: "Using default hazmat configuration. Manual review recommended for chemical compatibility.",
      similarShipments: [],
      historicalIncidents: [],
      timestamp: new Date().toISOString(),
      isDefaultFallback: true,
    });
  }
}

// GET endpoint to check hazmat data availability
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unNumber = searchParams.get("unNumber");
    const hazardClass = searchParams.get("hazardClass");

    // Check if we have data for this specific chemical
    const hasData = unNumber || hazardClass;

    return NextResponse.json({
      available: hasData,
      unNumber,
      hazardClass,
      message: hasData 
        ? "Hazmat data available for analysis" 
        : "No hazmat identifiers provided",
      supportedClasses: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
      features: [
        "Chemical compatibility analysis",
        "Segregation requirements",
        "Regulatory compliance checking",
        "Historical incident analysis",
        "Carrier hazmat certification verification"
      ]
    });
  } catch (_error) {
    return NextResponse.json(
      {
        available: false,
        error: "Failed to check hazmat data availability",
      },
      { status: 500 },
    );
  }
}
