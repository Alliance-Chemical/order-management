import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces, activityLog, qrCodes } from '@/lib/db/schema/qr-workspace';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const params = await context.params;
    const { 
      lineItemId, 
      productName,
      workflowType,
      sourceContainerId, 
      sourceContainerName, 
      mode = 'add' 
    } = await request.json();
    const orderId = Number(params.orderId);

    if (!lineItemId || !workflowType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: lineItemId and workflowType are required' },
        { status: 400 }
      );
    }

    // For pump_and_fill, source container is required
    if (workflowType === 'pump_and_fill' && !sourceContainerId) {
      return NextResponse.json(
        { success: false, error: 'Source container is required for pump_and_fill workflow' },
        { status: 400 }
      );
    }

    // Fetch the workspace
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderId))
      .limit(1);

    if (!workspace || workspace.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const workspaceRecord = workspace[0];
    
    // Get existing source assignments or initialize empty array
    const existingAssignments = (workspaceRecord.moduleStates as any)?.sourceAssignments || [];
    
    let updatedAssignments;
    
    // For direct_resell workflow, just store the workflow type
    if (workflowType === 'direct_resell') {
      // Remove any existing assignments for this lineItemId and add new workflow-only entry
      updatedAssignments = existingAssignments.filter((a: any) => a.lineItemId !== lineItemId);
      updatedAssignments.push({
        lineItemId,
        productName,
        workflowType: 'direct_resell',
        sourceContainers: [], // Empty for direct resell
        assignedAt: new Date().toISOString(),
        assignedBy: 'supervisor' // In production, get from auth context
      });
    } else {
      // For pump_and_fill workflow
      
      // Generate a unique source QR code for this specific source container if it doesn't exist
      const sourceQRId = `source-${sourceContainerId}`;
      
      // Check if we already have a source QR for this specific container
      const allSourceQRs = await db
        .select()
        .from(qrCodes)
        .where(
          and(
            eq(qrCodes.workspaceId, workspaceRecord.id),
            eq(qrCodes.qrType, 'source')
          )
        );
      
      // Check if this specific source container already has a QR
      const existingSourceQR = allSourceQRs.find(qr => 
        qr.encodedData && 
        typeof qr.encodedData === 'object' && 
        (qr.encodedData as any).sourceId === sourceQRId
      );
      
      if (!existingSourceQR) {
        // Create a new source QR code for this specific source container
        const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://order-management-kappa-seven.vercel.app').trim();
        const now = Date.now();
        const makeCode = (suffix: string) => `QR-${orderId}-${suffix}-${now}-${Math.floor(Math.random() * 1000)}`;
        const makeShort = () => Math.random().toString(36).slice(2, 8).toUpperCase();
        
        // Extract the chemical name from the source container name (e.g., "Isopropyl Alcohol - 275 Gal Tote" -> "Isopropyl Alcohol")
        const chemicalName = sourceContainerName ? sourceContainerName.split(' - ')[0] : productName || 'Chemical';
        
        await db.insert(qrCodes).values({
          workspaceId: workspaceRecord.id,
          qrType: 'source',
          qrCode: makeCode(`SOURCE-${sourceContainerId}`),
          shortCode: makeShort(),
          orderId,
          orderNumber: String(orderId),
          containerNumber: null,
          chemicalName: chemicalName,
          encodedData: { 
            type: 'source', 
            orderId, 
            orderNumber: String(orderId), 
            sourceId: sourceQRId,
            sourceContainerId,
            sourceContainerName,
            chemicalName,
            isSource: true 
          },
          qrUrl: `${baseUrl}/workspace/${orderId}`,
          scanCount: 0,
          isActive: true,
          createdAt: new Date(),
        });
        
        console.log(`[SOURCE ASSIGN] Created new source QR for ${chemicalName} (${sourceContainerId})`);
      }
      
      if (mode === 'replace') {
        // Replace all assignments for this lineItemId
        updatedAssignments = existingAssignments.filter((a: any) => a.lineItemId !== lineItemId);
        updatedAssignments.push({
          lineItemId,
          productName,
          workflowType: 'pump_and_fill',
          sourceContainers: [{
            id: sourceContainerId,
            name: sourceContainerName
          }],
          assignedAt: new Date().toISOString(),
          assignedBy: 'supervisor' // In production, get from auth context
        });
      } else {
        // Add mode - keep existing assignments and add new source container
        const existingAssignment = existingAssignments.find((a: any) => a.lineItemId === lineItemId);
        
        if (existingAssignment) {
          // Update existing assignment
          updatedAssignments = existingAssignments.map((a: any) => {
            if (a.lineItemId === lineItemId) {
              const sourceContainers = a.sourceContainers || [];
              // Don't add duplicate source containers
              const isDuplicate = sourceContainers.some((s: any) => s.id === sourceContainerId);
              
              if (!isDuplicate) {
                sourceContainers.push({ id: sourceContainerId, name: sourceContainerName });
              }
              
              return {
                ...a,
                workflowType: 'pump_and_fill',
                sourceContainers,
                productName,
                assignedAt: new Date().toISOString(),
                assignedBy: 'supervisor'
              };
            }
            return a;
          });
        } else {
          // Create new assignment
          updatedAssignments = [...existingAssignments, {
            lineItemId,
            productName,
            workflowType: 'pump_and_fill',
            sourceContainers: [{
              id: sourceContainerId,
              name: sourceContainerName
            }],
            assignedAt: new Date().toISOString(),
            assignedBy: 'supervisor'
          }];
        }
      }
    }

    // Update the workspace with new assignments
    await db
      .update(workspaces)
      .set({
        moduleStates: {
          ...(workspaceRecord.moduleStates as any || {}),
          sourceAssignments: updatedAssignments
        },
        updatedAt: new Date()
      })
      .where(eq(workspaces.id, workspaceRecord.id));

    // Log the activity
    await db.insert(activityLog).values({
      workspaceId: workspaceRecord.id,
      activityType: workflowType === 'direct_resell' ? 'workflow_assigned' : 'source_assigned',
      metadata: {
        lineItemId,
        productName,
        workflowType,
        sourceContainerId,
        sourceContainerName,
        mode
      },
      performedBy: 'supervisor', // In production, get from auth context
      performedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Source container assigned successfully'
    });

  } catch (error) {
    console.error('Error assigning source container:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to assign source container' },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const params = await context.params;
    const orderId = Number(params.orderId);

    // Fetch the workspace
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderId))
      .limit(1);

    if (!workspace || workspace.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const workspaceRecord = workspace[0];
    const sourceAssignments = (workspaceRecord.moduleStates as any)?.sourceAssignments || [];

    return NextResponse.json({
      success: true,
      sourceAssignments
    });

  } catch (error) {
    console.error('Error fetching source assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch source assignments' },
      { status: 500 }
    );
  }
}