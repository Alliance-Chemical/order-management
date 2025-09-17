import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { getEdgeSql, withEdgeRetry } from "@/lib/db/neon-edge";
import { workspaceFreightLinker } from "@/lib/services/workspace-freight-linking";

// Enable Edge Runtime for performance
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004",
});

type QuoteCommodity = {
  commodityPieces?: number;
  commodityDescription?: string;
  commodityWeight?: number;
  commodityClass?: string;
  commodityHazMat?: string;
};

type QuoteUnit = {
  quoteCommodities?: QuoteCommodity[];
};

type OrderStop = {
  city?: string;
  state?: string;
  locationType?: string;
};

type Accessorials = Record<string, unknown> | undefined;

type CapturedOrderData = {
  quoteReferenceID?: string;
  proNumber?: string;
  sessionId?: string;
  orderNumber?: string;
  carrier?: string;
  serviceType?: string;
  originStop?: OrderStop;
  destinationStop?: OrderStop;
  quoteUnits?: QuoteUnit[];
  originAccessorials?: Accessorials;
  destinationAccessorials?: Accessorials;
  paymentDirection?: string;
  specialInstructions?: string;
  readyToDispatch?: string;
};

// This endpoint captures orders as they're being placed through MyCarrier
export async function POST(request: NextRequest) {
  try {
    const sql = getEdgeSql();
    const orderData = await request.json() as CapturedOrderData;

    // Format the order for embedding
    const searchableText = formatOrderForEmbedding(orderData);

    // Generate embedding using Google's text-embedding-004
    const result = await embeddingModel.embedContent(searchableText);
    const embedding = result.embedding.values;

    // Store in intelligence schema with retry logic
    await withEdgeRetry(async () => {
      await sql`
        INSERT INTO intelligence.historical_embeddings (
          id,
          shipment_id,
          embedding,
          searchable_text,
          shipment_data,
          created_at
        ) VALUES (
          gen_random_uuid(),
          ${orderData.quoteReferenceID || orderData.proNumber || "pending"},
          ${JSON.stringify(embedding)}::vector(768),
          ${searchableText},
          ${JSON.stringify(orderData)}::jsonb,
          NOW()
        )
      `;
    });

    // Also store in event sourcing table for telemetry with retry logic
    await withEdgeRetry(async () => {
      await sql`
        INSERT INTO intelligence.freight_booking_events (
          id,
          session_id,
          event_type,
          order_context,
          decision,
          confidence,
          human_override,
          timestamp
        ) VALUES (
          gen_random_uuid(),
          ${orderData.sessionId || "manual"},
          'order_placed',
          ${JSON.stringify({
            origin: orderData.originStop,
            destination: orderData.destinationStop,
            items: orderData.quoteUnits,
          })}::jsonb,
          ${JSON.stringify({
            carrier: orderData.carrier,
            service: orderData.serviceType,
            accessorials: {
              origin: orderData.originAccessorials,
              destination: orderData.destinationAccessorials,
            },
          })}::jsonb,
          1.0,
          false,
          NOW()
        )
      `;
    });

    // After capturing order data, also create workspace if we have enough info
    let workspaceResult = null;
    if (orderData.quoteReferenceID && (orderData.orderNumber || orderData.quoteReferenceID)) {
      try {
        console.log('Creating workspace for captured freight order:', orderData.quoteReferenceID);
        
        const workspaceUrl = workspaceFreightLinker.generateWorkspaceUrl(
          orderData.orderNumber || orderData.quoteReferenceID
        );
        
        // Extract order ID from reference or use a generated one
        const orderId = parseInt(orderData.orderNumber?.replace(/\D/g, '') || 
                                 orderData.quoteReferenceID?.replace(/\D/g, '') || 
                                 Date.now().toString());
        
        workspaceResult = await workspaceFreightLinker.createWorkspaceWithFreight(
          {
            orderId,
            orderNumber: orderData.orderNumber || orderData.quoteReferenceID,
            workspaceUrl,
            status: 'active',
            shipstationData: {},
          },
          {
            orderId,
            orderNumber: orderData.orderNumber || orderData.quoteReferenceID,
            carrierName: orderData.carrier,
            serviceType: orderData.serviceType,
            originAddress: orderData.originStop,
            destinationAddress: orderData.destinationStop,
            packageDetails: {
              weight: { value: 0, units: 'lbs' },
              dimensions: { length: 0, width: 0, height: 0, units: 'in' },
              packageCount: orderData.quoteUnits?.length || 1,
              description: 'Freight shipment',
            },
            sessionId: orderData.sessionId,
            telemetryData: {},
          }
        );
        
        console.log('✅ Workspace created for freight order:', workspaceResult.workspace.id);
      } catch (workspaceError) {
        console.error('Error creating workspace (continuing with order capture):', workspaceError);
        // Don't fail the entire request if workspace creation fails
      }
    }

    return NextResponse.json({
      success: true,
      message: "Order captured for AI learning",
      referenceId: orderData.quoteReferenceID,
      ...(workspaceResult && {
        workspace: {
          id: workspaceResult.workspace.id,
          orderId: workspaceResult.workspace.orderId,
          orderNumber: workspaceResult.workspace.orderNumber,
          workspaceUrl: workspaceResult.workspace.workspaceUrl,
        },
        workspaceLink: `/workspace/${workspaceResult.workspace.orderId}`,
      }),
    });
  } catch (error) {
    console.error("Error capturing order:", error);
    return NextResponse.json(
      { error: "Failed to capture order" },
      { status: 500 },
    );
  }
}

function formatOrderForEmbedding(order: CapturedOrderData): string {
  const origin = order.originStop || {};
  const dest = order.destinationStop || {};
  const units = order.quoteUnits || [];

  // Extract commodity information
  const commodities = units
    .flatMap((unit) =>
      (unit.quoteCommodities || []).map(
        (c) =>
          `${c.commodityPieces}x ${c.commodityDescription || "Item"} (${c.commodityWeight}lbs, Class ${c.commodityClass}${c.commodityHazMat === "YES" ? ", HAZMAT" : ""})`,
      ),
    )
    .join("; ");

  // Extract accessorials
  const originAccessorials = Object.entries(order.originAccessorials || {})
    .filter(([, value]) => value === "YES" || value === true)
    .map(([key]) => key)
    .join(", ");

  const destAccessorials = Object.entries(order.destinationAccessorials || {})
    .filter(([, value]) => value === "YES" || value === true)
    .map(([key]) => key)
    .join(", ");

  return `
    Mode: ${order.serviceType}
    Carrier: ${order.carrier || "Any"}
    Service: ${order.carrierService || "Standard"}
    Route: ${origin.city}, ${origin.state} to ${dest.city}, ${dest.state}
    Origin Type: ${origin.locationType || "Business"}
    Destination Type: ${dest.locationType || "Business"}
    Items: ${commodities}
    Origin Accessorials: ${originAccessorials || "None"}
    Destination Accessorials: ${destAccessorials || "None"}
    Payment: ${order.paymentDirection || "Prepaid"}
    Special Instructions: ${order.specialInstructions || "None"}
    Ready to Dispatch: ${order.readyToDispatch || "NO"}
  `
    .trim()
    .replace(/\s+/g, " ");
}
