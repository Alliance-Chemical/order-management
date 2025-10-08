import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';
import { renderPDF } from '@/lib/pdf';

const repository = new WorkspaceRepository();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const { searchParams } = new URL(request.url);
    const size = searchParams.get('size') || '4x6'; // Default to 4x6, allow 'letter' for 8.5x11
    console.log(`[PACKING SLIP API] Generating packing slip for order: ${orderId} (size: ${size})`);

    // Fetch workspace data
    const workspace = await repository.findByOrderId(parseInt(orderId));
    if (!workspace) {
      console.error(`[PACKING SLIP API] Workspace not found for order: ${orderId}`);
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Extract ShipStation data
    const shipstationData = workspace.shipstationData as any || {};
    const orderNumber = workspace.orderNumber || orderId;

    console.log(`[PACKING SLIP API] Found workspace for order #${orderNumber}`);

    // Generate HTML for packing slip
    const html = generatePackingSlipHTML({
      orderNumber,
      orderId,
      shipTo: shipstationData.shipTo || {},
      billTo: shipstationData.billTo || {},
      items: shipstationData.items || [],
      customerEmail: shipstationData.customerEmail,
      customerNotes: shipstationData.customerNotes,
      internalNotes: shipstationData.internalNotes,
      orderDate: shipstationData.orderDate,
      shipByDate: shipstationData.shipByDate,
      size,
    });

    console.log('[PACKING SLIP API] HTML generated, generating PDF...');

    // Generate PDF with appropriate size
    const pdfOptions: any = {
      printBackground: true,
      preferCSSPageSize: true,
    };

    if (size === 'letter') {
      pdfOptions.format = 'Letter';
      pdfOptions.margin = {
        top: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
        right: '0.5in',
      };
    } else {
      // Default to 4x6
      pdfOptions.width = '4in';
      pdfOptions.height = '6in';
      pdfOptions.margin = {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      };
    }

    const pdfBuffer = await renderPDF(html, pdfOptions);

    console.log(`[PACKING SLIP API] PDF generated successfully. Size: ${pdfBuffer.length} bytes`);

    const filename = `packing-slip-${orderNumber}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[PACKING SLIP API] FATAL ERROR:', error);
    console.error('[PACKING SLIP API] Error stack:', (error as Error).stack);
    return NextResponse.json(
      { error: 'Failed to generate packing slip' },
      { status: 500 }
    );
  }
}

interface PackingSlipData {
  orderNumber: string;
  orderId: string;
  shipTo: any;
  billTo: any;
  items: any[];
  customerEmail?: string;
  customerNotes?: string;
  internalNotes?: string;
  orderDate?: string;
  shipByDate?: string;
  size: string;
}

function generatePackingSlipHTML(data: PackingSlipData): string {
  const {
    orderNumber,
    orderId,
    shipTo,
    billTo,
    items,
    customerEmail,
    customerNotes,
    orderDate,
    shipByDate,
    size,
  } = data;

  const isLetter = size === 'letter';

  // Format date helper
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Format address helper
  const formatAddress = (addr: any) => {
    if (!addr) return 'N/A';
    const parts = [
      addr.name,
      addr.company,
      addr.street1,
      addr.street2,
      addr.street3,
      [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', '),
      addr.country,
      addr.phone,
    ].filter(Boolean);
    return parts.join('<br/>');
  };

  // Generate barcode value using ShipStation order ID hex encoding
  // Format: ^#^{orderIdHex}^ (as discovered in ShipStation community)
  const generateBarcodeValue = (orderId: string) => {
    try {
      const orderIdNum = parseInt(orderId, 10);
      if (isNaN(orderIdNum)) return '';
      const hex = orderIdNum.toString(16).toUpperCase();
      return `^#^${hex}^`;
    } catch {
      return '';
    }
  };

  const barcodeValue = generateBarcodeValue(orderId);

  // Generate items HTML for letter size
  const itemsTableHTML = items
    .map((item, index) => {
      const itemName = item.name || 'Unknown Item';
      const sku = item.sku || 'N/A';
      const quantity = item.quantity || 0;

      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${index + 1}</td>
          <td style="padding: 12px; border-bottom: 1px solid #dee2e6; text-align: left;">
            <strong>${itemName}</strong><br/>
            <span style="color: #6c757d; font-size: 10pt;">SKU: ${sku}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #dee2e6; text-align: center;">${quantity}</td>
        </tr>
      `;
    })
    .join('');

  // Return letter-size template
  if (isLetter) {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Packing Slip - Order #${orderNumber}</title>
        <style>
          @page {
            size: letter;
            margin: 0.5in;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 0;
            font-family: 'Helvetica Neue', Arial, sans-serif;
            font-size: 11pt;
            color: #212529;
            line-height: 1.5;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #007bff;
          }

          .company-info {
            flex: 1;
          }

          .company-name {
            font-size: 24pt;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 5px;
          }

          .company-details {
            font-size: 10pt;
            color: #6c757d;
            line-height: 1.6;
          }

          .document-title {
            text-align: right;
            flex: 1;
          }

          .document-title h1 {
            font-size: 28pt;
            font-weight: bold;
            color: #212529;
            margin: 0 0 10px 0;
          }

          .document-title .order-info {
            font-size: 11pt;
            color: #495057;
            margin: 5px 0;
          }

          .addresses {
            display: flex;
            gap: 30px;
            margin-bottom: 30px;
          }

          .address-box {
            flex: 1;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #dee2e6;
          }

          .address-box h3 {
            font-size: 12pt;
            font-weight: bold;
            color: #007bff;
            margin: 0 0 10px 0;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .address-box p {
            margin: 0;
            font-size: 10pt;
            line-height: 1.6;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }

          thead {
            background: #007bff;
            color: white;
          }

          thead th {
            padding: 12px;
            text-align: left;
            font-weight: bold;
            font-size: 10pt;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .totals {
            margin-top: 20px;
            text-align: right;
          }

          .totals table {
            width: 300px;
            margin-left: auto;
          }

          .totals td {
            padding: 8px;
            border-bottom: 1px solid #dee2e6;
          }

          .totals .total-row {
            font-weight: bold;
            font-size: 14pt;
            color: #007bff;
            border-top: 2px solid #007bff;
          }

          .notes-section {
            margin-top: 30px;
            padding: 15px;
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            border-radius: 4px;
          }

          .notes-section h3 {
            font-size: 11pt;
            font-weight: bold;
            margin: 0 0 10px 0;
            color: #856404;
          }

          .notes-section p {
            margin: 5px 0;
            font-size: 10pt;
            color: #856404;
            white-space: pre-wrap;
          }

          .barcode-section {
            text-align: center;
            margin-top: 30px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
          }

          .barcode-value {
            font-family: 'Courier New', monospace;
            font-size: 18pt;
            font-weight: bold;
            letter-spacing: 0.1em;
            margin-top: 10px;
          }

          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #dee2e6;
            text-align: center;
            font-size: 9pt;
            color: #6c757d;
          }

          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            <div class="company-name">Alliance Chemical</div>
            <div class="company-details">
              www.alliancechemical.com<br/>
              sales@alliancechemical.com<br/>
              Phone: (512) 365-6838
            </div>
          </div>
          <div class="document-title">
            <h1>PACKING SLIP</h1>
            <div class="order-info"><strong>Order #:</strong> ${orderNumber}</div>
            <div class="order-info"><strong>Order Date:</strong> ${formatDate(orderDate)}</div>
            ${shipByDate ? `<div class="order-info"><strong>Ship By:</strong> ${formatDate(shipByDate)}</div>` : ''}
          </div>
        </div>

        <!-- Addresses -->
        <div class="addresses">
          ${billTo && Object.keys(billTo).length > 0 ? `
          <div class="address-box">
            <h3>Bill To</h3>
            <p>${formatAddress(billTo)}</p>
          </div>
          ` : ''}
          <div class="address-box">
            <h3>Ship To</h3>
            <p>${formatAddress(shipTo)}</p>
            ${customerEmail ? `<p style="margin-top: 10px;"><strong>Email:</strong> ${customerEmail}</p>` : ''}
          </div>
        </div>

        <!-- Items Table -->
        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Item Description</th>
              <th style="width: 100px; text-align: center;">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${itemsTableHTML}
          </tbody>
        </table>

        <!-- Customer Notes -->
        ${customerNotes ? `
        <div class="notes-section">
          <h3>Customer Notes</h3>
          <p>${customerNotes}</p>
        </div>
        ` : ''}

        <!-- Barcode -->
        ${barcodeValue ? `
        <div class="barcode-section">
          <div style="font-size: 10pt; color: #6c757d; margin-bottom: 5px;">Order Barcode</div>
          <div class="barcode-value">${barcodeValue}</div>
        </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
          <p>Thank you for your business!</p>
          <p>sales@alliancechemical.com | www.alliancechemical.com | (512) 365-6838</p>
        </div>
      </body>
    </html>
    `;
  }

  // Return 4x6 template (default)
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Packing Slip - Order #${orderNumber}</title>
        <style>
          @page {
            size: 4in 6in;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 0.25in;
            font-family: 'Helvetica Neue', Arial, sans-serif;
            font-size: 8pt;
            color: #212529;
            line-height: 1.3;
            width: 4in;
            height: 6in;
          }

          .header {
            text-align: center;
            margin-bottom: 0.1in;
            padding-bottom: 0.08in;
            border-bottom: 2px solid #007bff;
          }

          .company-name {
            font-size: 14pt;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 0.03in;
          }

          .company-contact {
            font-size: 6pt;
            color: #6c757d;
            margin-bottom: 0.02in;
          }

          .document-title {
            font-size: 11pt;
            font-weight: bold;
            color: #212529;
            margin: 0.05in 0;
          }

          .order-info {
            font-size: 7pt;
            color: #495057;
            margin: 0.02in 0;
          }

          .address-section {
            margin-bottom: 0.12in;
          }

          .address-box {
            padding: 0.08in;
            background: #f8f9fa;
            border-radius: 4px;
            border: 1px solid #dee2e6;
            margin-bottom: 0.08in;
          }

          .address-box h3 {
            font-size: 8pt;
            font-weight: bold;
            color: #007bff;
            margin: 0 0 0.04in 0;
            text-transform: uppercase;
          }

          .address-box p {
            margin: 0;
            font-size: 7pt;
            line-height: 1.4;
          }

          .items-section {
            margin-bottom: 0.12in;
          }

          .items-section h3 {
            font-size: 8pt;
            font-weight: bold;
            margin: 0 0 0.05in 0;
            color: #007bff;
            text-transform: uppercase;
          }

          .item {
            padding: 0.05in 0;
            border-bottom: 1px solid #dee2e6;
          }

          .item:last-child {
            border-bottom: none;
          }

          .item-name {
            font-size: 7pt;
            font-weight: bold;
            margin-bottom: 0.02in;
            line-height: 1.2;
            word-wrap: break-word;
          }

          .item-details {
            font-size: 6pt;
            color: #6c757d;
            display: flex;
            justify-content: space-between;
          }

          .notes-section {
            margin-top: 0.1in;
            padding: 0.06in;
            background: #fff3cd;
            border-left: 3px solid #ffc107;
            border-radius: 3px;
          }

          .notes-section h3 {
            font-size: 7pt;
            font-weight: bold;
            margin: 0 0 0.03in 0;
            color: #856404;
          }

          .notes-section p {
            margin: 0;
            font-size: 6pt;
            color: #856404;
            white-space: pre-wrap;
            word-wrap: break-word;
          }

          .barcode-section {
            text-align: center;
            margin-top: 0.1in;
            padding: 0.06in;
            background: #f8f9fa;
            border-radius: 4px;
          }

          .barcode-label {
            font-size: 6pt;
            color: #6c757d;
            margin-bottom: 0.02in;
          }

          .barcode-value {
            font-family: 'Courier New', monospace;
            font-size: 10pt;
            font-weight: bold;
            letter-spacing: 0.08em;
          }

          .footer {
            margin-top: 0.1in;
            padding-top: 0.06in;
            border-top: 1px solid #dee2e6;
            text-align: center;
            font-size: 5pt;
            color: #6c757d;
            line-height: 1.3;
          }

          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header">
          <div class="company-name">Alliance Chemical</div>
          <div class="company-contact">www.alliancechemical.com | sales@alliancechemical.com | (512) 365-6838</div>
          <div class="document-title">PACKING SLIP</div>
          <div class="order-info">Order #${orderNumber}</div>
          ${orderDate ? `<div class="order-info">${formatDate(orderDate)}</div>` : ''}
        </div>

        <!-- Ship To Address -->
        <div class="address-section">
          <div class="address-box">
            <h3>Ship To</h3>
            <p>${formatAddress(shipTo)}</p>
            ${customerEmail ? `<p style="margin-top: 0.03in; font-size: 6pt;"><strong>Email:</strong> ${customerEmail}</p>` : ''}
          </div>
        </div>

        <!-- Items List -->
        <div class="items-section">
          <h3>Items (${items.length})</h3>
          ${items.map((item, index) => {
            const itemName = item.name || 'Unknown Item';
            const sku = item.sku || 'N/A';
            const quantity = item.quantity || 0;

            return `
              <div class="item">
                <div class="item-name">${index + 1}. ${itemName}</div>
                <div class="item-details">
                  <span>SKU: ${sku}</span>
                  <span>Qty: ${quantity}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Customer Notes -->
        ${customerNotes ? `
        <div class="notes-section">
          <h3>Notes</h3>
          <p>${customerNotes.length > 200 ? customerNotes.substring(0, 200) + '...' : customerNotes}</p>
        </div>
        ` : ''}

        <!-- Barcode -->
        ${barcodeValue ? `
        <div class="barcode-section">
          <div class="barcode-label">Order ID Barcode</div>
          <div class="barcode-value">${barcodeValue}</div>
        </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
          <p>Thank you for your business!</p>
          <p>sales@alliancechemical.com | www.alliancechemical.com | (512) 365-6838</p>
        </div>
      </body>
    </html>
  `;
}
