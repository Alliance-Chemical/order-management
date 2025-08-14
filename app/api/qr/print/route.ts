import { NextRequest, NextResponse } from 'next/server';
import { QRGenerator } from '@/lib/services/qr/generator';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';

const qrGenerator = new QRGenerator();
const repository = new WorkspaceRepository();

export async function POST(request: NextRequest) {
  let browser = null;
  
  try {
    const body = await request.json();
    const { qrCodes, labelSize = '4x6', sourceAssignments = [] } = body;
    console.log(`[PRINT API] Received request to print ${qrCodes?.length || 0} labels with size: ${labelSize}`);
    console.log(`[PRINT API] Source assignments (with workflow types):`, sourceAssignments);

    if (!qrCodes || !Array.isArray(qrCodes) || qrCodes.length === 0) {
      console.error('[PRINT API] Validation failed: qrCodes array is missing or empty.');
      return NextResponse.json(
        { error: 'QR codes array is required' },
        { status: 400 }
      );
    }

    console.log('[PRINT API] Starting to process QR codes...');
    
    // Generate HTML for printing with QR codes and full record data
    const labelsData: { qrDataUrl: string; record: any }[] = [];
    
    for (let i = 0; i < qrCodes.length; i++) {
      const qr = qrCodes[i];
      console.log(`[PRINT API] Processing QR ${i + 1}/${qrCodes.length} - shortCode: ${qr.shortCode}`);
      
      // Fetch QR data from database
      const qrRecord = await repository.findQRByShortCode(qr.shortCode);
      if (!qrRecord) {
        console.warn(`[PRINT API] QR record not found for shortCode: ${qr.shortCode}. Skipping.`);
        continue;
      }

      console.log(`[PRINT API] Found QR record. Generating QR data URL for: ${qr.shortCode}`);
      // Generate QR code as data URL
      const qrDataUrl = await qrGenerator.generateQRCode(qrRecord.encodedData as any);
      
      // Push both the QR data URL and the full record
      labelsData.push({ 
        qrDataUrl, 
        record: qrRecord 
      });
      
      console.log(`[PRINT API] Updating print count for QR: ${qrRecord.id}`);
      // Update print count
      await repository.updateQRPrintCount(qrRecord.id, 'system');
    }

    // Generate HTML page for printing with full data and source assignments (including workflow types)
    const html = generatePrintHTML(labelsData, labelSize, sourceAssignments);
    
    console.log(`[PRINT API] HTML generated successfully for ${labelsData.length} QR codes`);
    
    // Check if we're running on Vercel
    const isVercel = process.env.VERCEL === '1';
    
    if (isVercel) {
      console.log('[PRINT API] Running on Vercel - using puppeteer-core with chromium');
      
      // Dynamic imports for Vercel environment
      const puppeteer = await import('puppeteer-core');
      const chromium = await import('@sparticuz/chromium');
      
      browser = await puppeteer.default.launch({
        args: chromium.default.args,
        defaultViewport: chromium.default.defaultViewport,
        executablePath: await chromium.default.executablePath(),
        headless: chromium.default.headless,
      });
    } else {
      console.log('[PRINT API] Running locally - using playwright');
      
      // Dynamic import for local development
      const { chromium } = await import('playwright');
      
      browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    
    const page = await browser.newPage();
    
    // Set content
    await page.setContent(html, { waitUntil: isVercel ? 'domcontentloaded' : 'networkidle' });
    
    console.log('[PRINT API] Generating PDF from HTML...');
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: labelSize === '8.5x11' ? 'Letter' : undefined,
      width: labelSize === '4x6' ? '4in' : labelSize === '2x2' ? '2in' : undefined,
      height: labelSize === '4x6' ? '6in' : labelSize === '2x2' ? '2in' : undefined,
      printBackground: true,
      margin: labelSize === '8.5x11' ? { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' } : { top: 0, bottom: 0, left: 0, right: 0 }
    });
    
    console.log(`[PRINT API] PDF generated successfully. Size: ${pdfBuffer.length} bytes`);
    
    // Return PDF response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="qr-labels-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[PRINT API] FATAL ERROR:', error);
    console.error('[PRINT API] Error stack:', (error as Error).stack);
    return NextResponse.json({ error: 'Failed to generate labels' }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function generatePrintHTML(labelsData: { qrDataUrl: string; record: any }[], labelSize: string, sourceAssignments: any[] = []): string {
  const isLetter = labelSize === '8.5x11';
  const is4x6 = labelSize === '4x6';
  
  // Helper function to find source assignment for an item
  const findSourceAssignment = (record: any): any => {
    if (!sourceAssignments || sourceAssignments.length === 0) return null;
    
    // Try multiple ways to match the record to a source assignment
    const itemId = record.encodedData?.itemId || record.encodedData?.lineItemId;
    const sku = record.encodedData?.sku;
    const productName = record.chemicalName || record.encodedData?.itemName;
    
    return sourceAssignments.find(sa => {
      // Match by line item ID (most reliable)
      if (itemId && sa.lineItemId === itemId) return true;
      
      // Match by SKU
      if (sku && sa.sku === sku) return true;
      
      // Match by product name (case-insensitive contains)
      if (productName && sa.productName) {
        const recordName = productName.toLowerCase().trim();
        const assignmentName = sa.productName.toLowerCase().trim();
        return recordName.includes(assignmentName) || assignmentName.includes(recordName);
      }
      
      return false;
    });
  };
  
  // Helper function to get label type badge text
  const getLabelType = (record: any): string => {
    // For container labels, check if this specific item is direct resell
    if (record.qrType === 'container') {
      const assignment = findSourceAssignment(record);
      console.log(`[PRINT] Container label - Record: ${record.chemicalName}, Assignment found: ${!!assignment}, WorkflowType: ${assignment?.workflowType}`);
      
      if (assignment?.workflowType === 'direct_resell') {
        return 'SCAN TO INSPECT';
      }
      return ''; // No badge for pump_and_fill containers
    }
    
    // For source QRs created on-demand
    if (record.qrType === 'source') {
      return 'SCAN AT SOURCE';
    }
    
    switch (record.qrType) {
      case 'master':
      case 'order_master':
        const isSource = record.encodedData?.isSource;
        return isSource ? 'SCAN AT SOURCE' : 'SCAN AT START';
      default:
        return '';
    }
  };
  
  // Helper function to get product name
  const getProductName = (record: any): string => {
    // For source QRs created on-demand
    if (record.qrType === 'source') {
      // Clear label for warehouse workers
      return 'SOURCE CONTAINER';
    }
    
    switch (record.qrType) {
      case 'master':
      case 'order_master':
        const isSource = record.encodedData?.isSource;
        return isSource ? 'SOURCE CONTAINER' : 'MASTER LABEL';
      case 'container':
        const chemicalName = record.chemicalName || record.encodedData?.itemName || 'Product';
        if (chemicalName === 'Product') {
          return '<span style="color: red;">PRODUCT NAME MISSING</span>';
        }
        return chemicalName.toUpperCase();
      default:
        return (record.qrType || 'LABEL').toUpperCase();
    }
  };
  
  // Helper function to get item info - ONLY information about the label itself
  const getItemInfo = (record: any): string => {
    // For source QRs created on-demand
    if (record.qrType === 'source') {
      // Show the actual source container name that was selected
      const sourceContainerName = record.encodedData?.sourceContainerName || record.chemicalName || '';
      return sourceContainerName.toUpperCase();
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
        // For master labels, show order number is already handled by label header
        return '';
      case 'container':
        // Check if this specific item is direct resell
        const assignment = findSourceAssignment(record);
        if (assignment?.workflowType === 'direct_resell') {
          return ''; // No numbering for direct resell containers
        }
        // Container labels show proper numbering using encodedData values
        const containerNum = record.encodedData?.containerNumber || 1;
        const totalContainers = record.encodedData?.totalContainers || 1;
        const containerType = record.encodedData?.containerType || 'Container';
        return `${containerType.charAt(0).toUpperCase() + containerType.slice(1)} ${containerNum} of ${totalContainers}`;
      default:
        return '';
    }
  };
  
  const labelHTML = labelsData.map((data) => {
    const { qrDataUrl, record } = data;
    const orderNumber = record.orderNumber || record.orderId || 'N/A';
    const labelType = getLabelType(record);
    const productName = getProductName(record);
    const itemInfo = getItemInfo(record);
    const shortCode = record.shortCode || '';
    
    // Standardized HTML structure for ALL label types
    if (is4x6) {
      return `
        <div class="label-container">
          <div class="header">
            <span class="order-number">Order #${orderNumber}</span>
            ${labelType ? `<span class="label-type-badge">${labelType}</span>` : ''}
          </div>
          <div class="product-name">${productName}</div>
          <img src="${qrDataUrl}" alt="QR Code">
          <div class="item-info">${itemInfo}</div>
          <div class="footer">
            <span class="scan-code-title">SCAN CODE</span>
            <span class="short-code">${shortCode}</span>
            <span class="instructions">Scan QR or enter code manually</span>
          </div>
        </div>
      `;
    } else if (isLetter) {
      // Grid layout for letter size (simplified)
      return `
        <div class="label-grid">
          <div class="order-number">Order #${orderNumber}</div>
          <div class="product-name">${productName}</div>
          <img src="${qrDataUrl}" alt="QR Code">
          <div class="item-info">${itemInfo}</div>
          <div class="short-code">${shortCode}</div>
        </div>
      `;
    } else {
      // Compact layout for 2x2 labels
      return `
        <div class="label-2x2">
          <div class="order-number">Order #${orderNumber}</div>
          <img src="${qrDataUrl}" alt="QR Code">
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
          
          body {
            margin: 0;
            padding: 0;
            font-family: 'Helvetica Neue', Arial, sans-serif;
          }
          
          /* Main container for a 4x6 label */
          .label-container {
            width: 4in;
            height: 6in;
            padding: 0.25in;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            text-align: center;
            page-break-after: always;
          }
          
          /* Top section with Order # */
          .header {
            width: 100%;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.1in;
          }
          
          .order-number {
            font-size: 18pt;
            font-weight: bold;
            display: block;
          }
          
          .label-type-badge {
            display: inline-block;
            background-color: #ff0000;
            color: white;
            padding: 3px 10px;
            border-radius: 6px;
            font-size: 10pt;
            font-weight: bold;
          }
          
          /* Middle section with Product, QR, Info */
          .product-name {
            font-size: 20pt;
            font-weight: bold;
            line-height: 1.1;
            max-width: 3.5in;
            word-wrap: break-word;
            margin: 0.1in 0;
          }
          
          img {
            width: 2.2in;
            height: 2.2in;
            margin: 0.1in 0;
          }
          
          .item-info {
            font-size: 14pt;
            color: #333;
            margin: 0.05in 0;
          }
          
          /* Bottom section with Short Code */
          .footer {
            width: 100%;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.05in;
          }
          
          .scan-code-title {
            font-size: 10pt;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            display: block;
          }
          
          .short-code {
            font-size: 24pt;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            letter-spacing: 0.08em;
            background-color: #f0f0f0;
            padding: 4px 12px;
            border-radius: 6px;
            display: block;
          }
          
          .instructions {
            font-size: 9pt;
            color: #666;
            font-style: italic;
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
          
          .label-grid img {
            width: 1in;
            height: 1in;
            margin: 0.05in 0;
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
          
          .label-2x2 img {
            width: 1in;
            height: 1in;
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