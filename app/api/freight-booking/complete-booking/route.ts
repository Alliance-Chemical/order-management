import { NextRequest, NextResponse } from "next/server";
import { workspaceFreightLinker } from "@/lib/services/workspace-freight-linking";
import { KVCache } from "@/lib/cache/kv-cache";

type Address = {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
};

type WeightDetails = {
  value?: number;
  units?: string;
};

type DimensionDetails = {
  length?: number;
  width?: number;
  height?: number;
  units?: string;
};

type PackageDetails = {
  weight?: WeightDetails;
  dimensions?: DimensionDetails;
  packageCount?: number;
  description?: string;
};

type PalletItem = {
  name?: string;
  quantity?: number;
};

type PalletData = {
  type: string;
  items: PalletItem[];
  weight: WeightDetails;
  dimensions: DimensionDetails;
  stackable?: boolean;
};

type FreightBookingInput = {
  orderId: string | number;
  orderNumber: string;
  carrierName?: string;
  serviceType?: string;
  estimatedCost?: number;
  originAddress?: Address;
  destinationAddress?: Address;
  packageDetails?: PackageDetails;
  palletData?: PalletData[];
  specialInstructions?: string;
  aiSuggestions?: Record<string, unknown>[];
  confidenceScore?: number;
  sessionId?: string;
  telemetryData?: Record<string, unknown>;
  customerName?: string;
  customerCompany?: string;
  customerEmail?: string;
};

type WorkspaceSummary = {
  id: string;
  orderId: number;
  orderNumber: string;
  workspaceUrl: string;
  status: string;
  activeModules?: Record<string, unknown>;
 };

// Convert freight booking data to ShipStation-compatible format
function createShipStationDataFromFreight(bookingData: FreightBookingInput): Record<string, unknown> {
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
    
    // Convert package details to items format - use pallet data if available
    items: bookingData.palletData?.length ? 
      bookingData.palletData.map((pallet, index) => ({
        sku: `PALLET-${index + 1}`,
        name: `${pallet.type} Pallet - ${pallet.items.length} items`,
        quantity: 1,
        unitPrice: (bookingData.estimatedCost || 0) / bookingData.palletData!.length,
        weight: {
          value: pallet.weight?.value || 0,
          units: pallet.weight?.units || 'lbs',
          WeightUnits: 2 // lbs
        },
        dimensions: {
          length: pallet.dimensions?.length || 0,
          width: pallet.dimensions?.width || 0,
          height: pallet.dimensions?.height || 0,
          units: pallet.dimensions?.units || 'in'
        },
        imageUrl: '',
        productId: `${bookingData.orderId}-pallet-${index + 1}`,
        createDate: new Date().toISOString(),
        modifyDate: new Date().toISOString(),
        options: [
          {
            name: 'Stackable',
            value: pallet.stackable ? 'Yes' : 'No'
          },
          {
            name: 'Items',
            value: pallet.items.map((item) => `${item.name ?? 'Item'} (${item.quantity ?? 0})`).join(', ')
          }
        ]
      })) : [{
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
    const bookingData = await request.json() as FreightBookingInput;

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

    const cacheKey = `workspace-freight:order:${bookingData.orderId}`;
    let workspace = (await KVCache.get(cacheKey)) as WorkspaceSummary | null;

    if (!workspace) {
      const workspaceUrl = workspaceFreightLinker.generateWorkspaceUrl(bookingData.orderNumber);
      const shipstationData = createShipStationDataFromFreight(bookingData);

      const result = await workspaceFreightLinker.createWorkspaceWithFreight(
        {
          orderId: bookingData.orderId,
          orderNumber: bookingData.orderNumber,
          workspaceUrl,
          status: 'active',
          shipstationData,
          activeModules: {
            preMix: true,
            warehouse: true,
            documents: true,
            freight: true,
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
        },
      );

      workspace = {
        id: result.workspace.id,
        orderId: result.workspace.orderId,
        orderNumber: result.workspace.orderNumber,
        workspaceUrl: result.workspace.workspaceUrl,
        status: result.workspace.status,
        activeModules: result.workspace.activeModules,
      };

      await KVCache.set(cacheKey, workspace, 600);

      return NextResponse.json({
        success: true,
        message: "Freight booking completed and workspace created",
        workspace,
        freightOrder: {
          id: result.freightOrder.id,
          bookingStatus: result.freightOrder.bookingStatus,
          carrierName: result.freightOrder.carrierName,
          serviceType: result.freightOrder.serviceType,
        },
        workspaceLink: `/workspace/${workspace.orderId}`,
      });
    }

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
      },
    );

    return NextResponse.json({
      success: true,
      message: "Freight booking linked to existing workspace",
      workspace,
      freightOrder: {
        id: freightOrder.id,
        bookingStatus: freightOrder.bookingStatus,
        carrierName: freightOrder.carrierName,
        serviceType: freightOrder.serviceType,
      },
      workspaceLink: workspace ? `/workspace/${workspace.orderId}` : null,
    });
  } catch (error) {
    console.error("Error completing freight booking:", error);
    return NextResponse.json(
      { success: false, error: "Failed to complete freight booking" },
      { status: 500 },
    );
  }
}
