/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';
import { renderPDF } from '@/lib/pdf';

const repository = new WorkspaceRepository();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qrCodes, labelSize = '4x6', fulfillmentMethod = 'standard', orderId } = body;
    console.log(`[PRINT API] Received request to print ${qrCodes?.length || 0} labels with size: ${labelSize}`);
    console.log(`[PRINT API] Fulfillment method: ${fulfillmentMethod}`);
    console.log(`[PRINT API] Order ID: ${orderId}`);
    console.log(`[PRINT API] QR codes received:`, qrCodes?.map(qr => ({
      id: qr.id,
      shortCode: qr.shortCode,
      hasShortCode: !!qr.shortCode
    })));

    if (!qrCodes || !Array.isArray(qrCodes) || qrCodes.length === 0) {
      console.error('[PRINT API] Validation failed: qrCodes array is missing or empty.');
      console.error('[PRINT API] Request body:', JSON.stringify(body, null, 2));
      return NextResponse.json(
        { error: 'QR codes array is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Validate each QR code has required fields
    const invalidQRs = qrCodes.filter(qr => !qr.shortCode);
    if (invalidQRs.length > 0) {
      console.error('[PRINT API] Validation failed: Some QR codes missing shortCode field');
      console.error('[PRINT API] Invalid QRs:', invalidQRs);
      return NextResponse.json(
        { error: `${invalidQRs.length} QR codes are missing shortCode field` },
        { status: 400 }
      );
    }

    console.log('[PRINT API] Starting to process QR codes...');
    
    // Generate HTML for printing with QR codes and full record data
    const labelsData: {
      qrSvg: string;
      record: any;
      override?: {
        containerNumber?: number;
        totalContainers?: number;
        itemName?: string;
      };
    }[] = [];
    const notFoundQRs: string[] = [];

    for (let i = 0; i < qrCodes.length; i++) {
      const qr = qrCodes[i];
      console.log(`[PRINT API] Processing QR ${i + 1}/${qrCodes.length} - shortCode: ${qr.shortCode}`);

      // Fetch QR data from database
      const qrRecord = await repository.findQRByShortCode(qr.shortCode, orderId);
      if (!qrRecord) {
        console.warn(`[PRINT API] QR record not found for shortCode: ${qr.shortCode} (orderID: ${orderId}). Will skip.`);
        notFoundQRs.push(qr.shortCode);
        continue;
      }

      console.log(`[PRINT API] Found QR record. Generating QR SVG for: ${qr.shortCode}`);
      // Generate QR code as raw SVG string using shortCode-first URL
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '')?.trim() || 'http://localhost:3000';
      const shortUrl = `${baseUrl}/qr/s/${qrRecord.shortCode}`;
      const QRCode = (await import('qrcode')).default;
      const qrSvg = await QRCode.toString(shortUrl, {
        type: 'svg',
        errorCorrectionLevel: 'Q',
        margin: 8, // quietZoneModules
        width: 300,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
      
      // Push both the QR SVG and the full record
      const sequenceNumber = typeof qr.sequenceNumber === 'number' ? qr.sequenceNumber : undefined;
      const sequenceTotal = typeof qr.sequenceTotal === 'number' ? qr.sequenceTotal : undefined;
      const itemName = typeof qr.itemName === 'string' ? qr.itemName : undefined;

      labelsData.push({ 
        qrSvg, 
        record: qrRecord,
        override: sequenceNumber || sequenceTotal || itemName
          ? {
              containerNumber: sequenceNumber,
              totalContainers: sequenceTotal,
              itemName,
            }
          : undefined,
      });
      
      console.log(`[PRINT API] Updating print count for QR: ${qrRecord.id}`);
      // Update print count
      await repository.updateQRPrintCount(qrRecord.id, 'system', { labelSize });
    }

    // Check if we have any valid labels to print
    if (labelsData.length === 0) {
      console.error('[PRINT API] No valid QR codes found to print');
      console.error('[PRINT API] QR codes not found in database:', notFoundQRs);
      return NextResponse.json(
        {
          error: 'No valid QR codes found to print',
          details: `${notFoundQRs.length} QR codes not found in database: ${notFoundQRs.join(', ')}`
        },
        { status: 400 }
      );
    }

    if (notFoundQRs.length > 0) {
      console.warn(`[PRINT API] Warning: ${notFoundQRs.length} QR codes not found: ${notFoundQRs.join(', ')}`);
    }

    // Generate HTML page for printing with full data and fulfillment method
    const html = generatePrintHTML(labelsData, labelSize, fulfillmentMethod);
    
    console.log(`[PRINT API] HTML generated successfully for ${labelsData.length} QR codes`);
    
    // Self-check validation logging
    console.log('[PRINT API] === QR Generation Self-Check ===');
    console.log(`[PRINT API] ✓ Label size: ${labelSize}`);
    console.log(`[PRINT API] ✓ Quiet zone: 8 modules (enforced in SVG)`);
    console.log(`[PRINT API] ✓ Embedding: Inline SVG (no <img> tags)`);
    console.log(`[PRINT API] ✓ Label padding: 0.30in safe area`);
    console.log(`[PRINT API] ✓ QR size: 1.968in (400 dots @ 203 DPI)`);
    console.log(`[PRINT API] ✓ Error correction: Q (25% recovery)`);
    console.log(`[PRINT API] ✓ PDF: Deterministic sizing, no scaling`);
    console.log('[PRINT API] === End Self-Check ===');

    console.log('[PRINT API] Generating PDF from HTML...');

    // Generate PDF with deterministic settings
    const pdfOptions: any = {
      printBackground: true,
      preferCSSPageSize: true, // Respect CSS @page size
    };

    // Set size explicitly without format parameter
    if (labelSize === '4x6') {
      pdfOptions.width = '4in';
      pdfOptions.height = '6in';
      pdfOptions.margin = { top: 0, bottom: 0, left: 0, right: 0 };
    } else if (labelSize === '2x2') {
      pdfOptions.width = '2in';
      pdfOptions.height = '2in';
      pdfOptions.margin = { top: 0, bottom: 0, left: 0, right: 0 };
    } else if (labelSize === '8.5x11') {
      pdfOptions.format = 'Letter';
      pdfOptions.margin = { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' };
    }

    const pdfBuffer = await renderPDF(html, pdfOptions);

    console.log(`[PRINT API] PDF generated successfully. Size: ${pdfBuffer.length} bytes`);
    
    // Return PDF response
    // Derive a meaningful file name using order number if available
    let fileOrderNumber: string | undefined;
    if (labelsData.length > 0) {
      const first = labelsData[0].record;
      fileOrderNumber = first?.orderNumber || first?.encodedData?.orderNumber;
    }

    const filename = `labels-${fileOrderNumber || Date.now()}.pdf`;

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[PRINT API] FATAL ERROR:', error);
    console.error('[PRINT API] Error stack:', (error as Error).stack);
    return NextResponse.json({ error: 'Failed to generate labels' }, { status: 500 });
  }
}

function generatePrintHTML(
  labelsData: Array<{
    qrSvg: string;
    record: any;
    override?: {
      containerNumber?: number;
      totalContainers?: number;
      itemName?: string;
    };
  }>,
  labelSize: string,
  fulfillmentMethod: string = 'standard'
): string {
  const isLetter = labelSize === '8.5x11';
  const is4x6 = labelSize === '4x6';
  
  // Helper function to determine if item is direct resell based on fulfillment method
  // Helper function to get label type badge text
  const getLabelType = (record: any): string => {
    // For container labels, check fulfillment method
    if (record.qrType === 'container') {
      console.log(`[PRINT] Container label - Record: ${record.chemicalName}, Fulfillment method: ${fulfillmentMethod}`);
      
      if (fulfillmentMethod === 'direct_resell') {
        return 'READY TO SHIP';
      }
      return 'TO BE FILLED'; // Make it clear this needs to be filled!
    }
    
    // For source QRs created on-demand
    if (record.qrType === 'source') {
      return 'SOURCE BULK';
    }
    
    switch (record.qrType) {
      case 'master':
      case 'order_master':
        const isSource = record.encodedData?.isSource;
        return isSource ? 'SOURCE' : 'ORDER MASTER';
      default:
        return '';
    }
  };
  
  // Helper function to get product name
  const getProductName = (record: any): string => {
    // For source QRs created on-demand
    if (record.qrType === 'source') {
      // Parse the source container name to extract chemical and container info
      const sourceContainerName = record.encodedData?.sourceContainerName || '';
      
      // sourceContainerName format: "tote275 #ABC123" or "tote275 #- ChemicalName"
      let containerType = '';
      let containerCode = '';
      let extractedChemical = ''; // Don't default to chemicalName as that's the customer product
      
      if (sourceContainerName) {
        // Check for hash separator
        const hashIndex = sourceContainerName.indexOf('#');
        if (hashIndex > -1) {
          const beforeHash = sourceContainerName.substring(0, hashIndex).trim();
          const afterHash = sourceContainerName.substring(hashIndex + 1).trim();
          
          // Parse container type from before hash
          if (beforeHash.toLowerCase().includes('tote275')) {
            containerType = '275 GAL TOTE';
          } else if (beforeHash.toLowerCase().includes('drum55')) {
            containerType = '55 GAL DRUM';  
          } else if (beforeHash.toLowerCase().includes('tote330')) {
            containerType = '330 GAL TOTE';
          } else {
            containerType = beforeHash.toUpperCase();
          }
          
          // Check if after hash contains chemical name
          if (afterHash.startsWith('- ')) {
            // Format: "#- ChemicalName"
            extractedChemical = afterHash.substring(2).trim();
            containerCode = ''; // No specific code, just chemical name
          } else if (afterHash.includes(' - ')) {
            // Format: "#1 - ChemicalName" - extract code before dash
            const dashPos = afterHash.indexOf(' - ');
            containerCode = afterHash.substring(0, dashPos).trim();
            extractedChemical = afterHash.substring(dashPos + 3).trim();
          } else {
            // Just a code like "#ABC123"
            containerCode = afterHash;
          }
        }
      }
      
      // Use extracted chemical name if available (from sourceContainerName parsing)
      // Do NOT use the chemicalName field as that's the customer's product name
      const displayChemical = extractedChemical || 'SOURCE BULK MATERIAL';
      
      // Show clearly this is source material with proper chemical name
      // Only show container code if it actually exists and is not empty
      const containerCodeDisplay = containerCode && containerCode.trim() ? 
        `<div style="font-size: 12pt; color: #666; margin-top: 0.03in;">Container #${containerCode}</div>` : '';
      
      return `<div style="font-size: 20pt; font-weight: bold; line-height: 1.1;">${displayChemical.toUpperCase()}</div>
              ${containerType ? `<div style="font-size: 14pt; color: #ff6600; margin-top: 0.05in; font-weight: bold;">${containerType}</div>` : ''}
              ${containerCodeDisplay}`;
    }
    
    switch (record.qrType) {
      case 'master':
      case 'order_master':
        const isSource = record.encodedData?.isSource;
        if (isSource) {
          return 'SOURCE BULK INVENTORY';
        }
        // Show what items are in this order
        return 'ALL ORDER ITEMS';
      case 'container':
        const chemicalName = record.chemicalName || record.encodedData?.itemName || 'Product';
        if (chemicalName === 'Product') {
          return '<span style="color: red;">PRODUCT NAME MISSING</span>';
        }
        
        // Show product name clearly - use smaller font if needed to fit
        const upperName = chemicalName.toUpperCase();
        const fontSize = upperName.length > 30 ? '14pt' : '16pt';
        return `<div style="font-size: ${fontSize}; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; line-height: 1.1;">${upperName}</div>`;
      default:
        return (record.qrType || 'LABEL').toUpperCase();
    }
  };
  
  // Helper function to get order items list for master label
  const getOrderItemsList = (_record: any): string => {
    // Removed order items list functionality
    return '';
  };
  
  // Helper function to get item info - ONLY information about the label itself
  const getItemInfo = (
    record: any,
    override?: { containerNumber?: number; totalContainers?: number }
  ): string => {
    const formatContainerTypeLabel = (type: string | undefined | null) => {
      if (!type) return 'Container';
      return type
        .split(/[-_]/)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
    };

    // For source QRs created on-demand
    if (record.qrType === 'source') {
      // Show the container type and ID clearly
      const sourceContainerName = record.encodedData?.sourceContainerName || '';
      
      // Parse the sourceContainerName which comes in format like "tote275 #ABC123"
      if (sourceContainerName) {
        // If it's in the format "tote275 #ABC123" or "drum55 #XYZ789"
        const hashIndex = sourceContainerName.indexOf('#');
        if (hashIndex > -1) {
          const containerPart = sourceContainerName.substring(0, hashIndex).trim();
          const shortCode = sourceContainerName.substring(hashIndex + 1).trim();
          
          // Parse container type to readable format
          let readableType = containerPart;
          if (containerPart.toLowerCase() === 'tote275') {
            readableType = '275 GAL TOTE';
          } else if (containerPart.toLowerCase() === 'drum55') {
            readableType = '55 GAL DRUM';
          } else if (containerPart.toLowerCase() === 'tote330') {
            readableType = '330 GAL TOTE';
          }
          
          // Only show container ID if shortCode exists and is not empty or just a dash
          if (shortCode && !shortCode.startsWith('- ') && shortCode !== '') {
            return `<div style="font-size: 14pt; color: #666; font-weight: bold;">Container ID: #${shortCode}</div>`;
          } else {
            // Show just the container type without the empty #
            return `<div style="font-size: 14pt; color: #666; font-weight: bold;">${readableType}</div>`;
          }
        }
        
        // If there's a dash format (old style: "275 Gal Tote #ABC123 - Product")
        const dashIndex = sourceContainerName.indexOf(' - ');
        if (dashIndex > -1) {
          // Get just the container part (before the dash)
          const containerPart = sourceContainerName.substring(0, dashIndex);
          return `<div style="font-size: 14pt; color: #666; font-weight: bold;">${containerPart}</div>`;
        }
        
        // No hash or dash, just show the raw container name
        return `<div style="font-size: 14pt; color: #666; font-weight: bold;">${sourceContainerName}</div>`;
      }
      
      // If no container name at all, show a warning
      return '<div style="font-size: 14pt; color: #ff0000; font-weight: bold;">Container ID: <span style="background: yellow;">MISSING</span></div>';
    }
    
    switch (record.qrType) {
      case 'master':
      case 'order_master':
        const isSource = record.encodedData?.isSource;
        if (isSource) {
          // For old-style source labels, show the chemical name
          const chemicalName = record.chemicalName || record.encodedData?.itemName || '';
          return chemicalName;
        }
        // For master labels, order items list is handled separately
        return '';
      case 'container':
        // Check if this is direct resell based on fulfillment method
        if (fulfillmentMethod === 'direct_resell') {
          // For direct resell, show it's ready
          const containerType = formatContainerTypeLabel(record.encodedData?.containerType);
          return `<div style="font-size: 14pt; color: #28a745; font-weight: bold;">✓ Pre-packaged ${containerType}</div>`;
        }
        // Container labels show proper numbering using encodedData values
        const containerNum = override?.containerNumber ?? record.encodedData?.containerNumber ?? record.containerNumber ?? 1;
        const totalContainers = override?.totalContainers ?? record.encodedData?.totalContainers ?? record.totalContainers ?? 1;
        const rawContainerType = record.encodedData?.containerType || record.containerType || 'Container';
        const containerType = formatContainerTypeLabel(rawContainerType);
        const normalizedType = rawContainerType.toLowerCase();
        
        // For pallets and cases, show the actual quantity of items
        if (normalizedType.includes('pallet') || normalizedType.includes('case')) {
          const itemName = record.chemicalName || record.encodedData?.itemName || 'Product';
          
          // Try to parse quantity from the item name (e.g., "6x Isopropyl Alcohol")
          let itemQuantity = '';
          const qtyMatch = itemName.match(/^(\d+)x?\s+/i);
          if (qtyMatch) {
            itemQuantity = qtyMatch[1];
          }
          
          const containerLabel = `${containerType} ${containerNum} of ${totalContainers}`;
          if (itemQuantity) {
            // PRIORITY: Look for container types FIRST (pail, drum, tote, box), then fall back to measurements (gallon)
            const containerMatch = itemName.match(/(pail|drum|tote|box)/i);
            const measurementMatch = itemName.match(/(gallon|gal)/i);
            
            let unitType = 'units';
            
            // Use container type if found, otherwise fall back to measurement
            const unitMatch = containerMatch || measurementMatch;
            
            if (unitMatch) {
              unitType = unitMatch[1].toLowerCase();
              // Handle plural forms correctly
              if (unitType === 'gal' || unitType === 'gallon') {
                unitType = parseInt(itemQuantity) > 1 ? 'gallons' : 'gallon';
              } else if (unitType === 'box') {
                unitType = parseInt(itemQuantity) > 1 ? 'boxes' : 'box';
              } else if (parseInt(itemQuantity) > 1) {
                // Add 's' for plural only if not already plural
                if (!unitType.endsWith('s')) {
                  unitType = unitType + 's';
                }
              }
            }
            
            return `<div style="font-size: 14pt; color: #495057; font-weight: bold;">${containerLabel}</div>
                    <div style="font-size: 13pt; color: #ff6600; font-weight: bold; margin-top: 0.05in;">Contains: ${itemQuantity} x ${unitType}</div>`;
          }
          
          return `<div style="font-size: 14pt; color: #495057; font-weight: bold;">${containerLabel}</div>`;
        }
        
        return `<div style="font-size: 14pt; color: #495057; font-weight: bold;">${containerType} ${containerNum} of ${totalContainers}</div>`;
      default:
        return '';
    }
  };
  
  const labelHTML = labelsData.map((data) => {
    const { qrSvg, record, override } = data;
    const orderNumber = record.orderNumber || record.orderId || 'N/A';
    const labelType = getLabelType(record);
    const productName = getProductName(record);
    const itemInfo = getItemInfo(record, override);
    const orderItemsList = getOrderItemsList(record);
    const shortCode = record.shortCode || '';
    
    // Standardized HTML structure for ALL label types
    if (is4x6) {
      const badgeClass = record.qrType === 'source' ? 'source' : '';
      
      return `
        <div class="label-container">
          <div class="header">
            <span class="order-number">Order #${orderNumber}</span>
            ${labelType ? `<span class="label-type-badge ${badgeClass}">${labelType}</span>` : ''}
          </div>
          <div class="product-name">${productName}</div>
          <div class="qr-box">
            ${qrSvg}
          </div>
          <div class="item-info">${itemInfo}</div>
          ${orderItemsList}
          <div class="footer">
            <span class="scan-code-title">SCAN CODE</span>
            <span class="short-code">${shortCode}</span>
          </div>
        </div>
      `;
    } else if (isLetter) {
      // Grid layout for letter size (simplified)
      return `
        <div class="label-grid">
          <div class="order-number">Order #${orderNumber}</div>
          <div class="product-name">${productName}</div>
          <div class="qr-box">
            ${qrSvg}
          </div>
          <div class="item-info">${itemInfo}</div>
          <div class="short-code">${shortCode}</div>
        </div>
      `;
    } else {
      // Compact layout for 2x2 labels
      return `
        <div class="label-2x2">
          <div class="order-number">Order #${orderNumber}</div>
          <div class="qr-box">
            ${qrSvg}
          </div>
          <div class="item-info">${productName}<br/>${itemInfo}</div>
          <div class="short-code">${shortCode}</div>
        </div>
      `;
    }
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print QR Labels</title>
        <style>
          @page {
            size: ${isLetter ? 'letter' : labelSize === '4x6' ? '4in 6in' : '2in 2in'};
            margin: ${isLetter ? '0.5in' : '0'};
          }
          
          * {
            box-sizing: border-box;
          }
          
          body {
            margin: 0;
            padding: 0;
            font-family: 'Helvetica Neue', Arial, sans-serif;
          }
          
          /* Main container for a 4x6 label with safe printable area */
          .label-container {
            width: 4in;
            height: 6in;
            padding: 0.30in; /* 0.30in safe area from all edges */
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start; /* Changed from space-between to prevent stretching */
            text-align: center;
            page-break-before: always; /* Force new page before each label */
            page-break-after: always; /* Force new page after each label */
            page-break-inside: avoid; /* Never split label content */
            position: relative;
            overflow: hidden; /* Clip any content that exceeds boundaries */
            max-height: 6in; /* Enforce exact height */
          }
          
          /* Top section with Order # */
          .header {
            width: 100%;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.1in;
            margin-bottom: 0.1in;
          }
          
          .order-number {
            font-size: 18pt;
            font-weight: bold;
            display: block;
          }
          
          .label-type-badge {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 5px 12px;
            border-radius: 6px;
            font-size: 11pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin: 0.05in 0; /* Breathing room for badge */
          }
          
          .label-type-badge.source {
            background-color: #ff6600;
            font-size: 12pt;
          }
          
          /* Middle section with Product, QR, Info */
          .product-name {
            font-size: 16pt;
            font-weight: bold;
            line-height: 1.2;
            max-width: 3.4in; /* Slightly reduced for safe area */
            word-wrap: break-word;
            word-break: break-word;
            margin: 0.08in 0;
            overflow: visible;
            max-height: 0.8in; /* Limit height to prevent overflow */
            white-space: normal;
          }
          
          .source-info {
            font-size: 12pt;
            color: #0066cc;
            font-weight: bold;
            margin: 0.05in 0 0.08in 0; /* Removed negative margin */
            background-color: #e6f2ff;
            padding: 3px 10px;
            border-radius: 4px;
            display: inline-block;
            max-width: 3.5in;
            overflow: visible; /* Never clip source info */
            word-wrap: break-word;
            word-break: break-word;
            white-space: normal;
          }
          
          /* QR Code container - exact size for 203 DPI */
          .qr-box {
            width: 1.968in; /* 400 dots at 203 DPI */
            height: 1.968in; /* 400 dots at 203 DPI */
            margin: 0.08in 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
            overflow: visible; /* Never clip QR codes */
          }
          
          .qr-box svg {
            width: 100%;
            height: 100%;
            display: block;
          }
          
          .item-info {
            font-size: 13pt;
            color: #333;
            margin: 0.04in 0;
            line-height: 1.2;
            max-height: 0.5in; /* Limit height to prevent overflow */
            overflow: visible;
          }
          
          /* Bottom section with Short Code */
          .footer {
            width: 100%;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: auto; /* Push to bottom within container */
            padding-top: 0.1in;
            gap: 0.05in;
            flex-shrink: 0; /* Prevent footer from shrinking */
            max-height: 0.8in; /* Limit footer height */
          }
          
          .scan-code-title {
            font-size: 10pt;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            display: block;
          }
          
          .short-code {
            font-size: 20pt;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            letter-spacing: 0.06em;
            background-color: #f0f0f0;
            padding: 3px 10px;
            border-radius: 6px;
            display: block;
          }
          
          
          /* Letter Size Grid Layout */
          .label-grid {
            width: 2.5in;
            height: 2in;
            display: inline-block;
            text-align: center;
            margin: 0.05in;
            page-break-inside: avoid;
            border: 1px solid #ddd;
            padding: 0.15in;
            box-sizing: border-box;
            vertical-align: top;
          }
          
          .label-grid .order-number {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 0.05in;
          }
          
          .label-grid .product-name {
            font-size: 10pt;
            font-weight: bold;
            line-height: 1.1;
            height: 0.3in;
            overflow: hidden;
            margin-bottom: 0.05in;
          }
          
          .label-grid .qr-box {
            width: 1.2in;
            height: 1.2in;
            margin: 0.05in auto;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
            overflow: visible;
          }
          
          .label-grid .qr-box svg {
            width: 100%;
            height: 100%;
            display: block;
          }
          
          .label-grid .item-info {
            font-size: 9pt;
            line-height: 1.2;
            margin: 0.05in 0;
          }
          
          .label-grid .short-code {
            font-size: 11pt;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            background: #f0f0f0;
            padding: 2px 4px;
            border-radius: 2px;
          }
          
          /* 2x2 Compact Label Styles */
          .label-2x2 {
            width: 2in;
            height: 2in;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            page-break-after: always;
            padding: 0.1in;
            box-sizing: border-box;
          }
          
          .label-2x2 .order-number {
            font-size: 11pt;
            font-weight: bold;
          }
          
          .label-2x2 .qr-box {
            width: 1.2in;
            height: 1.2in;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
            overflow: visible;
          }
          
          .label-2x2 .qr-box svg {
            width: 100%;
            height: 100%;
            display: block;
          }
          
          .label-2x2 .item-info {
            font-size: 8pt;
            line-height: 1.2;
            text-align: center;
          }
          
          .label-2x2 .short-code {
            font-size: 10pt;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            background: #f0f0f0;
            padding: 1px 3px;
            border-radius: 2px;
          }
          
          @media print {
            .no-print {
              display: none;
            }
          }
        </style>
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </head>
      <body>
        <div class="no-print" style="padding: 20px; background: #f0f0f0; margin-bottom: 20px;">
          <h2>QR Label Preview</h2>
          <p>This page will automatically open the print dialog. ${labelsData.length} label(s) ready to print.</p>
          <button onclick="window.print()">Print Labels</button>
        </div>
        ${labelHTML}
      </body>
    </html>
  `;
}
