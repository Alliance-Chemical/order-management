import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { batchHistory, qrCodes } from '@/lib/db/schema/qr-workspace';
import { eq, inArray } from 'drizzle-orm';

// Import PDF generation utilities based on environment
type BatchHistoryRecord = typeof batchHistory.$inferSelect;
type QrCodeRecord = typeof qrCodes.$inferSelect;

let generatePDF: (htmlContent: string) => Promise<Buffer>;

if (process.env.VERCEL) {
  // Production environment - use puppeteer-core with chrome-aws-lambda
  const chromium = require('@sparticuz/chromium');
  const puppeteer = require('puppeteer-core');
  
  generatePDF = async (htmlContent: string) => {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
    });
    await browser.close();
    return pdf;
  };
} else {
  // Development environment - use Playwright
  const { chromium } = require('playwright');
  
  generatePDF = async (htmlContent: string) => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
    });
    await browser.close();
    return pdf;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: { batchId?: string } = await request.json();
    const { batchId } = body;

    if (!batchId) {
      return NextResponse.json(
        { error: 'Batch ID is required' },
        { status: 400 }
      );
    }

    // Fetch batch history record
    const [batch] = await db
      .select()
      .from(batchHistory)
      .where(eq(batchHistory.id, batchId));

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    // Fetch linked destination QR codes if any
    let destinationContainers: QrCodeRecord[] = [];
    if (batch.destinationQrIds && batch.destinationQrIds.length > 0) {
      destinationContainers = await db
        .select()
        .from(qrCodes)
        .where(inArray(qrCodes.id, batch.destinationQrIds as string[]));
    }

    // Generate elegant HTML content
    const htmlContent = generateElegantHTML(batch, destinationContainers);

    // Generate PDF
    const pdfBuffer = await generatePDF(htmlContent);

    // Return PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="dilution-batch-${batch.batchNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[Batch Print] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

function generateElegantHTML(
  batch: BatchHistoryRecord,
  destinationContainers: QrCodeRecord[],
): string {
  const totalWeight = parseFloat(batch.chemicalWeightLbs) + parseFloat(batch.waterWeightLbs);
  const chemicalPercent = (parseFloat(batch.chemicalVolumeGallons) / parseFloat(batch.totalVolumeGallons)) * 100;
  const waterPercent = (parseFloat(batch.waterVolumeGallons) / parseFloat(batch.totalVolumeGallons)) * 100;
  
  // Format date
  const formattedDate = new Date(batch.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: letter;
      margin: 0.5in;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #2c3e50;
      line-height: 1.6;
      background: white;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 15px 15px 0 0;
      margin-bottom: 30px;
      position: relative;
      overflow: hidden;
    }
    
    .header::after {
      content: '';
      position: absolute;
      top: -50%;
      right: -10%;
      width: 50%;
      height: 200%;
      background: rgba(255, 255, 255, 0.1);
      transform: rotate(45deg);
    }
    
    .header h1 {
      font-size: 32px;
      margin-bottom: 10px;
      position: relative;
      z-index: 1;
    }
    
    .header .subtitle {
      font-size: 18px;
      opacity: 0.95;
      position: relative;
      z-index: 1;
    }
    
    .batch-number {
      background: rgba(255, 255, 255, 0.2);
      display: inline-block;
      padding: 8px 16px;
      border-radius: 25px;
      margin-top: 10px;
      font-weight: bold;
      font-size: 20px;
      position: relative;
      z-index: 1;
    }
    
    .section {
      margin-bottom: 25px;
      background: #f8f9fa;
      border-radius: 10px;
      padding: 20px;
      border: 1px solid #e9ecef;
    }
    
    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: #495057;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #dee2e6;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    
    .info-item {
      display: flex;
      flex-direction: column;
    }
    
    .info-label {
      font-size: 12px;
      color: #6c757d;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 3px;
    }
    
    .info-value {
      font-size: 16px;
      color: #2c3e50;
      font-weight: 500;
    }
    
    .concentration-display {
      background: white;
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      border: 2px solid #667eea;
      margin: 20px 0;
    }
    
    .concentration-arrow {
      display: inline-block;
      font-size: 36px;
      color: #667eea;
      margin: 0 20px;
    }
    
    .concentration-value {
      display: inline-block;
      font-size: 42px;
      font-weight: bold;
      color: #2c3e50;
      vertical-align: middle;
    }
    
    .volume-bars {
      margin-top: 20px;
    }
    
    .volume-bar {
      margin-bottom: 15px;
    }
    
    .volume-bar-label {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      font-size: 14px;
    }
    
    .volume-bar-track {
      height: 30px;
      background: #e9ecef;
      border-radius: 15px;
      overflow: hidden;
      position: relative;
    }
    
    .volume-bar-fill {
      height: 100%;
      display: flex;
      align-items: center;
      padding-left: 10px;
      color: white;
      font-weight: bold;
      border-radius: 15px;
    }
    
    .chemical-fill {
      background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
      width: ${chemicalPercent}%;
    }
    
    .water-fill {
      background: linear-gradient(90deg, #43e97b 0%, #38f9d7 100%);
      width: ${waterPercent}%;
    }
    
    .destination-containers {
      background: #e8f4fd;
      border: 1px solid #bee5eb;
      border-radius: 10px;
      padding: 15px;
      margin-top: 15px;
    }
    
    .container-tag {
      display: inline-block;
      background: white;
      border: 1px solid #667eea;
      color: #667eea;
      padding: 5px 12px;
      border-radius: 20px;
      margin-right: 10px;
      margin-bottom: 10px;
      font-size: 14px;
      font-weight: 500;
    }
    
    .safety-section {
      background: #fff3cd;
      border: 2px solid #ffc107;
      border-radius: 10px;
      padding: 20px;
      margin-top: 20px;
    }
    
    .safety-title {
      color: #856404;
      font-weight: bold;
      font-size: 18px;
      margin-bottom: 10px;
    }
    
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #dee2e6;
      text-align: center;
      color: #6c757d;
      font-size: 12px;
    }
    
    .signature-line {
      display: inline-block;
      width: 200px;
      border-bottom: 2px solid #2c3e50;
      margin: 0 20px;
    }
    
    .signature-section {
      margin-top: 40px;
      display: flex;
      justify-content: space-around;
      text-align: center;
    }
    
    .signature-block {
      flex: 1;
    }
    
    .notes-section {
      background: #f0f9ff;
      border-left: 4px solid #667eea;
      padding: 15px;
      margin-top: 15px;
      border-radius: 0 10px 10px 0;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Chemical Dilution Record</h1>
    <div class="subtitle">Alliance Chemical - Precision Dilution Documentation</div>
    <div class="batch-number">Batch #${batch.batchNumber}</div>
  </div>
  
  <div class="concentration-display">
    <span class="concentration-value">${batch.initialConcentration}%</span>
    <span class="concentration-arrow">→</span>
    <span class="concentration-value">${batch.desiredConcentration}%</span>
  </div>
  
  <div class="section">
    <div class="section-title">Dilution Details</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Chemical Name</span>
        <span class="info-value">${batch.chemicalName}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Total Volume</span>
        <span class="info-value">${parseFloat(batch.totalVolumeGallons).toFixed(2)} gallons</span>
      </div>
      <div class="info-item">
        <span class="info-label">Method Used</span>
        <span class="info-value">${batch.methodUsed === 'vv' ? 'Volume/Volume' : batch.methodUsed === 'wv' ? 'Weight/Volume' : 'Weight/Weight'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Specific Gravity</span>
        <span class="info-value">${batch.initialSpecificGravity}</span>
      </div>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">Mixing Instructions</div>
    <div class="volume-bars">
      <div class="volume-bar">
        <div class="volume-bar-label">
          <span><strong>Chemical:</strong> ${batch.chemicalName}</span>
          <span>${parseFloat(batch.chemicalVolumeGallons).toFixed(3)} gal (${parseFloat(batch.chemicalWeightLbs).toFixed(2)} lbs)</span>
        </div>
        <div class="volume-bar-track">
          <div class="volume-bar-fill chemical-fill">
            ${chemicalPercent.toFixed(1)}%
          </div>
        </div>
      </div>
      
      <div class="volume-bar">
        <div class="volume-bar-label">
          <span><strong>Water:</strong> Deionized/Distilled</span>
          <span>${parseFloat(batch.waterVolumeGallons).toFixed(3)} gal (${parseFloat(batch.waterWeightLbs).toFixed(2)} lbs)</span>
        </div>
        <div class="volume-bar-track">
          <div class="volume-bar-fill water-fill">
            ${waterPercent.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
    
    <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 10px;">
      <strong>Total Weight:</strong> ${totalWeight.toFixed(2)} lbs
    </div>
  </div>
  
  ${destinationContainers.length > 0 ? `
  <div class="section">
    <div class="section-title">Destination Containers</div>
    <div class="destination-containers">
      <p style="margin-bottom: 10px;">This dilution batch is linked to the following containers:</p>
      ${destinationContainers.map(container => 
        `<span class="container-tag">${container.shortCode} - ${container.encodedData?.itemName || 'Container'}</span>`
      ).join('')}
    </div>
  </div>
  ` : ''}
  
  ${batch.notes ? `
  <div class="notes-section">
    <strong>Notes:</strong> ${batch.notes}
  </div>
  ` : ''}
  
  <div class="safety-section">
    <div class="safety-title">⚠️ Safety Reminders</div>
    <ul style="margin-left: 20px;">
      <li>Always add acid to water, never water to acid</li>
      <li>Use appropriate PPE including chemical-resistant gloves and eye protection</li>
      <li>Ensure adequate ventilation when mixing chemicals</li>
      <li>Have spill kit and eyewash station readily accessible</li>
      <li>Allow mixture to cool if exothermic reaction occurs</li>
    </ul>
  </div>
  
  <div class="section">
    <div class="section-title">Record Information</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Prepared By</span>
        <span class="info-value">${batch.completedBy}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Date & Time</span>
        <span class="info-value">${formattedDate}</span>
      </div>
    </div>
  </div>
  
  <div class="signature-section">
    <div class="signature-block">
      <div class="signature-line"></div>
      <div style="margin-top: 5px;">Quality Check</div>
      <div style="font-size: 11px; color: #6c757d;">Date: __________</div>
    </div>
    <div class="signature-block">
      <div class="signature-line"></div>
      <div style="margin-top: 5px;">Supervisor Approval</div>
      <div style="font-size: 11px; color: #6c757d;">Date: __________</div>
    </div>
  </div>
  
  <div class="footer">
    <p>Alliance Chemical - Workspace Order Management System</p>
    <p>Generated on ${new Date().toLocaleString()} | Batch ID: ${batch.id}</p>
  </div>
</body>
</html>
  `;
}
