import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sourceContainers } from '@/lib/db/schema/qr-workspace';
import { QRGenerator } from '@/lib/services/qr/generator';
import { chromium } from 'playwright';
import { inArray } from 'drizzle-orm';

const qrGenerator = new QRGenerator();

export async function POST(request: NextRequest) {
  let browser = null;
  
  try {
    const body = await request.json();
    const { containerIds, labelSize = '4x6' } = body;
    
    if (!containerIds || !Array.isArray(containerIds) || containerIds.length === 0) {
      return NextResponse.json(
        { error: 'Container IDs array is required' },
        { status: 400 }
      );
    }
    
    console.log(`[SOURCE LABELS] Generating labels for ${containerIds.length} containers`);
    
    // Fetch container data from database
    const containers = await db.query.sourceContainers.findMany({
      where: inArray(sourceContainers.id, containerIds),
      with: {
        qrCode: true,
      },
    });
    
    if (containers.length === 0) {
      return NextResponse.json(
        { error: 'No containers found' },
        { status: 404 }
      );
    }
    
    // Generate QR codes and prepare label data
    const labelsData = await Promise.all(containers.map(async (container) => {
      const qrData = {
        type: 'source_container',
        id: container.id,
        shopifyVariantId: container.shopifyVariantId,
        productTitle: container.productTitle,
        variantTitle: container.variantTitle,
        sku: container.sku,
        containerType: container.containerType,
        capacity: container.capacity,
        shortCode: container.shortCode,
      };
      
      const qrDataUrl = await qrGenerator.generateQRCode(qrData as any);
      
      return {
        qrDataUrl,
        container,
      };
    }));
    
    // Generate HTML for labels
    const html = generateSourceLabelsHTML(labelsData, labelSize);
    
    console.log('[SOURCE LABELS] Launching browser for PDF generation...');
    
    // Launch headless browser
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // Set content
    await page.setContent(html, { waitUntil: 'networkidle' });
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: labelSize === '8.5x11' ? 'Letter' : undefined,
      width: labelSize === '4x6' ? '4in' : labelSize === '2x4' ? '2in' : undefined,
      height: labelSize === '4x6' ? '6in' : labelSize === '2x4' ? '4in' : undefined,
      printBackground: true,
      margin: labelSize === '8.5x11' ? { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' } : { top: 0, bottom: 0, left: 0, right: 0 }
    });
    
    console.log(`[SOURCE LABELS] PDF generated successfully. Size: ${pdfBuffer.length} bytes`);
    
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="source-labels-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[SOURCE LABELS] Error:', error);
    return NextResponse.json({ error: 'Failed to generate labels' }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function generateSourceLabelsHTML(labelsData: any[], labelSize: string): string {
  const isLetter = labelSize === '8.5x11';
  const is4x6 = labelSize === '4x6';
  
  const getContainerIcon = (type: string) => {
    switch (type) {
      case 'drum': return '🛢️';
      case 'tote': return '📦';
      case 'pail': return '🪣';
      default: return '📦';
    }
  };
  
  const labelHTML = labelsData.map((data) => {
    const { qrDataUrl, container } = data;
    const icon = getContainerIcon(container.containerType);
    
    if (isLetter) {
      // Grid layout for letter size (2 columns)
      return `
        <div class="label-grid">
          <div class="header">
            <span class="icon">${icon}</span>
            <span class="title">SOURCE CONTAINER</span>
          </div>
          <div class="product-name">${container.productTitle}</div>
          ${container.variantTitle ? `<div class="variant">${container.variantTitle}</div>` : ''}
          <img src="${qrDataUrl}" alt="QR Code">
          <div class="container-info">
            <div>${container.containerType.toUpperCase()} - ${container.capacity}</div>
            ${container.sku ? `<div>SKU: ${container.sku}</div>` : ''}
          </div>
          <div class="short-code">${container.shortCode}</div>
          <div class="footer">
            ${container.warehouseLocation || 'Location: TBD'}
          </div>
        </div>
      `;
    } else {
      // Single label per page for 4x6 or 2x4
      return `
        <div class="label-single">
          <div class="header">
            <div class="source-badge">SOURCE</div>
            <span class="title">Bulk Chemical Container</span>
          </div>
          <div class="chemical-name">${container.productTitle}</div>
          ${container.variantTitle ? `<div class="variant">${container.variantTitle}</div>` : ''}
          <div class="container-details">
            <span class="icon">${icon}</span>
            <span class="container-type">${container.containerType.toUpperCase()} - ${container.capacity}</span>
          </div>
          <img src="${qrDataUrl}" alt="QR Code">
          <div class="usage-info">
            <div class="usage-label">USE FOR FILLING:</div>
            <div class="usage-items">Customer Order Containers</div>
          </div>
          <div class="scan-section">
            <div class="scan-label">SCAN CODE</div>
            <div class="short-code">${container.shortCode}</div>
            <div class="scan-instruction">Scan QR or enter code manually</div>
          </div>
          <div class="footer">
            <div class="location">${container.warehouseLocation || 'Location: TBD'}</div>
            ${container.sku ? `<div class="sku">SKU: ${container.sku}</div>` : ''}
            <div class="hazmat-info">
              ${container.hazmatClass ? `<span class="hazmat">HAZ: ${container.hazmatClass}</span>` : ''}
              ${container.unNumber ? `<span class="un">UN: ${container.unNumber}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Source Container Labels</title>
        <style>
          @page {
            size: ${isLetter ? 'letter' : is4x6 ? '4in 6in' : '2in 4in'};
            margin: ${isLetter ? '0.5in' : '0'};
          }
          
          body {
            margin: 0;
            padding: 0;
            font-family: 'Arial', sans-serif;
          }
          
          .label-grid {
            width: ${is4x6 ? '3.8in' : '3.8in'};
            height: ${is4x6 ? '5.8in' : '5.3in'};
            display: inline-block;
            text-align: center;
            margin: 0.1in;
            page-break-inside: avoid;
            border: 2px solid #333;
            padding: 0.25in;
            box-sizing: border-box;
            background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 20%);
          }
          
          .label-single {
            width: ${is4x6 ? '4in' : '2in'};
            height: ${is4x6 ? '6in' : '4in'};
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            page-break-after: always;
            padding: ${is4x6 ? '0.4in 0.3in' : '0.2in 0.15in'};
            box-sizing: border-box;
            border: 2px solid #333;
            background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 20%);
          }
          
          .header {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.05in;
            margin-bottom: ${is4x6 ? '0.15in' : '0.1in'};
            padding-bottom: ${is4x6 ? '0.1in' : '0.05in'};
            border-bottom: 3px solid #ff6600;
            width: 100%;
          }
          
          .source-badge {
            background: #ff6600;
            color: white;
            font-size: ${is4x6 ? '20pt' : '14pt'};
            font-weight: bold;
            padding: 0.05in 0.3in;
            border-radius: 0.1in;
            letter-spacing: 0.1em;
          }
          
          .title {
            font-size: ${is4x6 ? '11pt' : '9pt'};
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          
          .icon {
            font-size: ${is4x6 ? '24pt' : '16pt'};
          }
          
          .chemical-name {
            font-size: ${is4x6 ? '20pt' : '14pt'};
            font-weight: bold;
            margin: ${is4x6 ? '0.15in 0 0.05in 0' : '0.08in 0 0.03in 0'};
            color: #000;
            text-align: center;
            line-height: 1.2;
          }
          
          .container-details {
            display: flex;
            align-items: center;
            gap: 0.1in;
            margin: ${is4x6 ? '0.1in 0' : '0.05in 0'};
            padding: 0.05in 0.1in;
            background: #f0f0f0;
            border-radius: 0.05in;
          }
          
          .variant {
            font-size: ${is4x6 ? '12pt' : '9pt'};
            color: #6c757d;
            margin-bottom: ${is4x6 ? '0.15in' : '0.1in'};
          }
          
          img {
            width: ${is4x6 ? '2.5in' : '1.5in'};
            height: ${is4x6 ? '2.5in' : '1.5in'};
            margin: ${is4x6 ? '0.2in 0' : '0.1in 0'};
          }
          
          .container-type {
            font-weight: bold;
            color: #333;
            font-size: ${is4x6 ? '12pt' : '9pt'};
          }
          
          .usage-info {
            margin: ${is4x6 ? '0.15in 0' : '0.1in 0'};
            padding: 0.1in;
            background: #e8f4fd;
            border: 2px solid #0066cc;
            border-radius: 0.05in;
            text-align: center;
          }
          
          .usage-label {
            font-size: ${is4x6 ? '10pt' : '8pt'};
            font-weight: bold;
            color: #0066cc;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.03in;
          }
          
          .usage-items {
            font-size: ${is4x6 ? '12pt' : '9pt'};
            color: #333;
            font-weight: bold;
          }
          
          .sku {
            font-family: 'Courier New', monospace;
            color: #6c757d;
            margin-top: 0.05in;
          }
          
          .scan-section {
            margin: ${is4x6 ? '0.15in 0' : '0.1in 0'};
            text-align: center;
          }
          
          .scan-label {
            font-size: ${is4x6 ? '10pt' : '8pt'};
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.03in;
          }
          
          .short-code {
            font-size: ${is4x6 ? '24pt' : '16pt'};
            font-weight: bold;
            font-family: 'Courier New', monospace;
            letter-spacing: 0.15em;
            margin: 0.05in 0;
            padding: ${is4x6 ? '0.1in 0.3in' : '0.05in 0.15in'};
            background: #ffc107;
            color: #000;
            border-radius: 0.1in;
            display: inline-block;
          }
          
          .scan-instruction {
            font-size: ${is4x6 ? '9pt' : '7pt'};
            color: #666;
            font-style: italic;
          }
          
          .footer {
            width: 100%;
            font-size: ${is4x6 ? '10pt' : '8pt'};
            color: #6c757d;
            border-top: 1px solid #dee2e6;
            padding-top: ${is4x6 ? '0.1in' : '0.05in'};
            margin-top: auto;
          }
          
          .location {
            font-weight: bold;
            color: #28a745;
          }
          
          .hazmat-info {
            margin-top: 0.05in;
            display: flex;
            gap: 0.2in;
            justify-content: center;
          }
          
          .hazmat, .un {
            padding: 0.02in 0.1in;
            background: #dc3545;
            color: white;
            border-radius: 0.05in;
            font-size: ${is4x6 ? '9pt' : '7pt'};
            font-weight: bold;
          }
          
          @media print {
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        ${labelHTML}
      </body>
    </html>
  `;
}