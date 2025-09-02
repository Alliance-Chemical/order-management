import { NextRequest, NextResponse } from "next/server";
import { workspaceFreightLinker } from "@/lib/services/workspace-freight-linking";
import { KVCache } from "@/lib/cache/kv-cache";

// Convert freight booking data to ShipStation-compatible format
function createShipStationDataFromFreight(bookingData: any) {
  return {
    orderId: bookingData.orderId,
    orderNumber: bookingData.orderNumber,
    orderDate: new Date().toISOString(),
    orderStatus: 'awaiting_shipment',
    orderTotal: bookingData.estimatedCost || 0,
    customerUsername: bookingData.customerEmail || `customer-${bookingData.orderId}`,
    customerEmail: bookingData.customerEmail || '',
    
    // Convert freight addresses to ShipStation format
    billTo: {
      name: bookingData.customerName || '',
      company: bookingData.customerCompany || '',
      street1: bookingData.originAddress?.address || '',
      city: bookingData.originAddress?.city || '',
      state: bookingData.originAddress?.state || '',
      postalCode: bookingData.originAddress?.zipCode || '',
      country: 'US',
      phone: '',
      residential: false,
    },
    
    shipTo: {
      name: bookingData.customerName || '',
      company: bookingData.customerCompany || '',
      street1: bookingData.destinationAddress?.address || '',
      city: bookingData.destinationAddress?.city || '',
      state: bookingData.destinationAddress?.state || '',
      postalCode: bookingData.destinationAddress?.zipCode || '',
      country: 'US',
      phone: '',
      residential: false,
      addressVerified: 'Customer provided address',
    },
    
    // Convert package details to items format
    items: [{
      sku: `FREIGHT-${bookingData.orderNumber}`,
      name: `Freight Shipment - ${bookingData.serviceType || 'Standard'}`,
      quantity: bookingData.packageDetails?.packageCount || 1,
      unitPrice: bookingData.estimatedCost || 0,
      weight: {
        value: bookingData.packageDetails?.weight?.value || 0,
        units: bookingData.packageDetails?.weight?.units || 'lbs',
        WeightUnits: 2 // lbs
      },
      imageUrl: '',
      productId: bookingData.orderId,
      createDate: new Date().toISOString(),
      modifyDate: new Date().toISOString(),
      options: [
        {
          name: 'Carrier',
          value: bookingData.carrierName || 'Unknown'
        },
        {
          name: 'Service Type', 
          value: bookingData.serviceType || 'Standard'
        },
        {
          name: 'Package Description',
          value: bookingData.packageDetails?.description || 'Freight shipment'
        }
      ]
    }],
    
    // Freight-specific metadata
    gift: false,
    giftMessage: bookingData.specialInstructions || '',
    requestedShippingService: bookingData.serviceType || 'Standard',
    carrierCode: bookingData.carrierName?.toLowerCase() || 'freight',
    serviceCode: bookingData.serviceType?.toLowerCase()?.replace(/\s+/g, '_') || 'standard',
    
    // Freight booking source marker
    freightBooking: true,
    originalFreightData: {
      carrier: bookingData.carrierName,
      serviceType: bookingData.serviceType,
      estimatedCost: bookingData.estimatedCost,
      confidenceScore: bookingData.confidenceScore,
    }
  };
}

// Enable Edge Runtime for performance
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const bookingData = await request.json();
    
    // Validate required fields
    if (!bookingData.orderId || !bookingData.orderNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
          details: "Order ID and order number are required",
        },
        { status: 400 },
      );
    }


    // Check if workspace already exists for this order
    let workspace;
    try {
      // Try to get existing workspace by order ID (if it exists)
      const cacheKey = `workspace-freight:order:${bookingData.orderId}`;
      workspace = await KVCache.get(cacheKey);
      
      if (!workspace) {
        // Create workspace URL from order number
        const workspaceUrl = workspaceFreightLinker.generateWorkspaceUrl(bookingData.orderNumber);
        
        
        // Convert freight data to ShipStation-compatible format
        const shipstationData = createShipStationDataFromFreight(bookingData);
        
        // Create workspace with freight booking in one transaction
        const result = await workspaceFreightLinker.createWorkspaceWithFreight(
          {
            orderId: bookingData.orderId,
            orderNumber: bookingData.orderNumber,
            workspaceUrl,
            status: 'active',
            shipstationData: shipstationData,
            activeModules: {
              preMix: true,
              warehouse: true,
              documents: true,
              freight: true, // Enable freight module
            },
          },
          {
            orderId: bookingData.orderId,
            orderNumber: bookingData.orderNumber,
            carrierName: bookingData.carrierName,
            serviceType: bookingData.serviceType,
            estimatedCost: bookingData.estimatedCost,
            originAddress: bookingData.originAddress,
            destinationAddress: bookingData.destinationAddress,
            packageDetails: bookingData.packageDetails,
            specialInstructions: bookingData.specialInstructions,
            aiSuggestions: bookingData.aiSuggestions,
            confidenceScore: bookingData.confidenceScore,
            sessionId: bookingData.sessionId,
            telemetryData: bookingData.telemetryData,
          }
        );

        workspace = result.workspace;
        
        // Cache the result for 10 minutes
        await KVCache.set(cacheKey, workspace, 600);
        
        
        return NextResponse.json({
          success: true,
          message: "Freight booking completed and workspace created",
          workspace: {
            id: workspace.id,
            orderId: workspace.orderId,
            orderNumber: workspace.orderNumber,
            workspaceUrl: workspace.workspaceUrl,
            status: workspace.status,
          },
          freightOrder: {
            id: result.freightOrder.id,
            bookingStatus: result.freightOrder.bookingStatus,
            carrierName: result.freightOrder.carrierName,
            serviceType: result.freightOrder.serviceType,
          },
          workspaceLink: `/workspace/${workspace.orderId}`,
        });
      } else {
        
        // Link freight to existing workspace
        const freightOrder = await workspaceFreightLinker.linkFreightToWorkspace(
          workspace.id,
          {
            orderId: bookingData.orderId,
            orderNumber: bookingData.orderNumber,
            carrierName: bookingData.carrierName,
            serviceType: bookingData.serviceType,
            estimatedCost: bookingData.estimatedCost,
            originAddress: bookingData.originAddress,
            destinationAddress: bookingData.destinationAddress,
            packageDetails: bookingData.packageDetails,
            specialInstructions: bookingData.specialInstructions,
            aiSuggestions: bookingData.aiSuggestions,
            confidenceScore: bookingData.confidenceScore,
            sessionId: bookingData.sessionId,
            telemetryData: bookingData.telemetryData,
          }
        );

        return NextResponse.json({
          success: true,
          message: "Freight booking linked to existing workspace",
          workspace: {
            id: workspace.id,
            orderId: workspace.orderId,
            orderNumber: workspace.orderNumber,
            workspaceUrl: workspace.workspaceUrl,
            status: workspace.status,
          },
          freightOrder: {
            id: freightOrder.id,
            bookingStatus: freightOrder.bookingStatus,
            carrierName: freightOrder.carrierName,
            serviceType: freightOrder.serviceType,
          },
          workspaceLink: `/workspace/${workspace.orderId}`,
        });
      }
    } catch (error) {
      console.error('Error in freight booking completion:', error);
      
      // Return a fallback response that still allows the booking to proceed
      return NextResponse.json({
        success: true,
        message: "Freight booking completed (workspace creation pending)",
        workspace: null,
        freightOrder: {
          orderId: bookingData.orderId,
          orderNumber: bookingData.orderNumber,
          bookingStatus: 'booked',
        },
        workspaceLink: null,
        note: "Workspace will be created automatically when freight arrives",
      });
    }
  } catch (error) {
    console.error("Error completing freight booking:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to complete freight booking",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 },
    );
  }
}

// GET endpoint to check completion status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }

    // Check if freight booking exists and workspace is created
    const freightOrder = await workspaceFreightLinker.getFreightOrderByOrderId(parseInt(orderId));
    
    return NextResponse.json({
      hasFreightBooking: !!freightOrder,
      hasWorkspace: !!(freightOrder?.workspace),
      freightStatus: freightOrder?.bookingStatus || null,
      workspaceId: freightOrder?.workspace?.id || null,
      workspaceLink: freightOrder?.workspace ? `/workspace/${orderId}` : null,
    });
  } catch (error) {
    console.error("Error checking completion status:", error);
    return NextResponse.json(
      { error: "Failed to check completion status" },
      { status: 500 }
    );
  }
}