import { NextRequest, NextResponse } from 'next/server';
import { classifyWithRAG } from '@/lib/hazmat/classify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HazmatItem {
  sku: string;
  name: string;
  quantity: number;
  hazardClass?: string;
  unNumber?: string;
  packingGroup?: string;
  properShippingName?: string;
}

interface HazmatSuggestionRequest {
  orderId: string;
  items: any[];
  hazmatItems: HazmatItem[];
  customer: any;
  destination: any;
  origin: any;
}

export async function POST(request: NextRequest) {
  try {
    const body: HazmatSuggestionRequest = await request.json();
    const { orderId, items, hazmatItems, customer, destination, origin } = body;

    // Enrich hazmat items with classification if missing
    const enrichedHazmatItems: HazmatItem[] = await Promise.all(
      (hazmatItems || []).map(async (item) => {
        if (item.unNumber && item.hazardClass && item.properShippingName) return item;
        const cls = await classifyWithRAG(item.sku, item.name || item.properShippingName || '');
        return {
          ...item,
          unNumber: item.unNumber || cls.un_number || undefined,
          hazardClass: item.hazardClass || cls.hazard_class || undefined,
          packingGroup: item.packingGroup || (cls.packing_group || undefined) as any,
          properShippingName: item.properShippingName || cls.proper_shipping_name || undefined,
        };
      })
    );
    const hazItems = enrichedHazmatItems;

    // Analyze hazmat items for compliance requirements
    const hasClass3 = hazItems.some(item => item.hazardClass?.includes('3'));
    const hasClass8 = hazItems.some(item => item.hazardClass?.includes('8'));
    const hasMultipleClasses = new Set(hazItems.map(item => item.hazardClass)).size > 1;
    const totalHazmatWeight = hazItems.reduce((sum, item) => sum + (item.quantity * 50), 0); // Estimate 50lbs per item

    // Calculate risk level based on hazmat characteristics
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const riskFactors: string[] = [];
    const mitigations: string[] = [];

    if (hasMultipleClasses) {
      riskLevel = 'medium';
      riskFactors.push('Multiple hazard classes present');
      mitigations.push('Proper segregation required');
    }

    if (totalHazmatWeight > 1000) {
      riskLevel = riskLevel === 'low' ? 'medium' : 'high';
      riskFactors.push('High volume hazmat shipment');
      mitigations.push('Enhanced packaging requirements');
    }

    if (hasClass3 && hasClass8) {
      riskLevel = 'high';
      riskFactors.push('Incompatible chemical classes');
      mitigations.push('Minimum 3-meter separation');
    }

    // Determine carrier based on hazmat requirements
    const carrierName = hazItems.length > 0 ? 'SAIA' : 'FedEx Freight';
    const isHazmatCertified = hazItems.length > 0;
    const serviceType = hazItems.length > 0 ? 'Hazmat Ground' : 'Standard LTL';

    // Calculate estimated costs with hazmat surcharges
    const baseRate = 400 + (totalHazmatWeight * 0.5);
    const hazmatSurcharge = hazmatItems.length * 75; // $75 per hazmat item
    const totalCost = baseRate + hazmatSurcharge;

    // Generate compliance score
    let complianceScore = 0.7; // Base score
    if (isHazmatCertified) complianceScore += 0.1;
    if (riskLevel === 'low') complianceScore += 0.1;
    if (hazItems.every(item => item.unNumber && item.hazardClass)) complianceScore += 0.1;

    // Create comprehensive hazmat suggestion
    const suggestion = {
      carrier: {
        name: carrierName,
        hazmatCertified: isHazmatCertified,
        hazmatExperience: isHazmatCertified ? '15+ years handling hazmat shipments' : 'Standard freight experience',
        confidence: isHazmatCertified ? 0.85 : 0.70,
        reasoning: isHazmatCertified 
          ? 'SAIA has extensive hazmat certification and regulatory compliance experience'
          : 'Standard carrier suitable for non-hazmat freight'
      },
      service: {
        type: serviceType,
        hazmatApproved: isHazmatCertified,
        confidence: 0.90,
        reasoning: 'Ground service required for hazmat materials - air transport restricted'
      },
      hazmatRequirements: hazItems.length > 0 ? [
        {
          type: 'Proper Shipping Papers',
          required: true,
          description: 'Complete dangerous goods declaration with 24-hour emergency contact number',
          regulatoryReference: '49 CFR 172.200'
        },
        {
          type: 'UN Specification Packaging',
          required: true,
          description: 'UN-certified packaging appropriate for hazard class and packing group',
          regulatoryReference: '49 CFR 173'
        },
        {
          type: 'Hazmat Placards',
          required: true,
          description: 'Vehicle placarding required for all hazard classes present in shipment',
          regulatoryReference: '49 CFR 172.500'
        },
        {
          type: 'Driver Certification',
          required: true,
          description: 'Driver must hold valid hazmat endorsement on commercial license',
          regulatoryReference: '49 CFR 172.700'
        }
      ] : [
        {
          type: 'Standard Bill of Lading',
          required: true,
          description: 'Standard freight documentation required',
          regulatoryReference: '49 CFR 373'
        }
      ],
      segregationRequirements: hasClass3 && hasClass8 ? [
        {
          chemical1: 'Class 3 (Flammable Liquid)',
          chemical2: 'Class 8 (Corrosive)',
          requirement: 'Separate by at least 3 meters or use approved separation barrier'
        }
      ] : [],
      packaging: {
        unSpecification: hazItems.length > 0 ? 'UN 1H1' : 'Standard',
        packingGroup: hazItems[0]?.packingGroup || 'N/A',
        packagingInstructions: hazItems.length > 0 ? [
          'Use UN-approved drums or containers',
          'Ensure proper sealing and closure verification',
          'Apply appropriate hazmat labels and markings',
          'Include emergency response information'
        ] : [
          'Use appropriate packaging for freight class',
          'Secure all items to prevent shifting'
        ]
      },
      placarding: {
        required: hazItems.length > 0,
        placards: hazItems.map(item => ({
          hazardClass: item.hazardClass || 'Unknown',
          unNumber: item.unNumber || 'Unknown',
          position: 'All four sides of transport vehicle'
        }))
      },
      documentation: {
        shippingPaper: true,
        emergencyResponse: hazItems.length > 0,
        dangerousGoodsDeclaration: hazItems.length > 0
      },
      accessorials: [
        ...(hazItems.length > 0 ? [
          {
            type: 'Hazmat Fee',
            recommended: true,
            confidence: 1.0,
            reasoning: 'Required surcharge for all hazmat shipments'
          },
          {
            type: 'Inside Delivery',
            recommended: riskLevel === 'high',
            confidence: 0.8,
            reasoning: 'Recommended for high-risk chemical shipments'
          }
        ] : []),
        {
          type: 'Liftgate Service',
          recommended: totalHazmatWeight > 500,
          confidence: 0.7,
          reasoning: 'Heavy shipments may require liftgate for safe delivery'
        }
      ],
      estimatedCost: {
        low: Math.round(totalCost * 0.8),
        high: Math.round(totalCost * 1.2),
        average: Math.round(totalCost),
        hazmatSurcharge: hazmatSurcharge
      },
      estimatedTransitDays: {
        min: hazItems.length > 0 ? 3 : 2,
        max: hazItems.length > 0 ? 5 : 4,
        typical: hazItems.length > 0 ? 4 : 3
      },
      overallConfidence: complianceScore,
      complianceScore: Math.min(complianceScore, 1.0),
      riskAssessment: {
        level: riskLevel,
        factors: riskFactors.length > 0 ? riskFactors : ['Standard freight shipment'],
        mitigations: mitigations.length > 0 ? mitigations : ['Standard handling procedures']
      },
      aiInsights: [
        `Analyzed ${hazItems.length} hazmat item${hazItems.length !== 1 ? 's' : ''} for DOT compliance`,
        hazItems.length > 0 
          ? 'Ground transport only - hazmat restrictions apply to air freight'
          : 'Standard freight - no hazmat restrictions',
        `Risk level: ${riskLevel.toUpperCase()} - ${riskFactors.length > 0 ? riskFactors.join(', ') : 'standard procedures apply'}`,
        `Compliance score: ${Math.round(complianceScore * 100)}% - ${complianceScore > 0.8 ? 'excellent' : complianceScore > 0.6 ? 'good' : 'needs improvement'}`
      ],
      historicalIncidents: [], // Would be populated from historical data in production
      items: hazItems,
    };

    return NextResponse.json({
      success: true,
      suggestion,
      metadata: {
        orderId,
        hazmatItemCount: hazmatItems.length,
        totalWeight: totalHazmatWeight,
        riskLevel,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Hazmat suggestion API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate hazmat suggestion',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
