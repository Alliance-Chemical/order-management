import { NextRequest, NextResponse } from 'next/server';
import { geminiService } from '@/lib/services/ai/gemini-service';
import { db } from '@/lib/db';
import { workspaces, activityLog } from '@/lib/db/schema/qr-workspace';
import { gte, sql } from 'drizzle-orm';
// AWS SNS removed - log notifications instead

type HistoricalRecord = {
  orderId: number;
  customer: string | null;
  product: string;
  status: string | null;
  createdAt: Date | null;
  failureCount: number;
  failureTypes: string[] | null;
};

type AggregatedInspection = {
  product: string;
  customer: string | null;
  failures: Array<{
    type: string;
    date: Date | null;
    severity: string;
  }>;
  total_inspections: number;
};

type AnomalyReport = Awaited<ReturnType<typeof geminiService.detectAnomalies>>;
type RiskPattern = AnomalyReport['risk_patterns'][number];
type AlertEntry = {
  product: string;
  customer: string | null;
  risk: number;
  action: string;
};

export async function POST(request: NextRequest) {
  try {
    const { days = 30, runAnalysis = true } = await request.json() as { days?: number; runAnalysis?: boolean };

    // Fetch historical inspection data
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get inspection failure data grouped by product and customer
    const historicalData = await db
      .select({
        orderId: workspaces.orderId,
        customer: workspaces.customerName,
        product: sql<string>`COALESCE(${workspaces.metadata}->>'product', 'Unknown')`,
        status: workspaces.status,
        createdAt: workspaces.createdAt,
        failureCount: sql<number>`
          (SELECT COUNT(*) FROM ${activityLog} 
           WHERE ${activityLog.orderId} = ${workspaces.orderId}
           AND ${activityLog.type} = 'inspection_issue')
        `,
        failureTypes: sql<string[]>`
          ARRAY(SELECT DISTINCT ${activityLog.metadata}->>'issueType' 
                FROM ${activityLog}
                WHERE ${activityLog.orderId} = ${workspaces.orderId}
                AND ${activityLog.type} = 'inspection_issue')
        `
      })
      .from(workspaces)
      .where(gte(workspaces.createdAt, startDate)) as HistoricalRecord[];

    // Transform data for AI analysis
    const aggregatedData = historicalData.reduce<Record<string, AggregatedInspection>>((acc, record) => {
      const key = `${record.product}_${record.customer}`;
      
      if (!acc[key]) {
        acc[key] = {
          product: record.product,
          customer: record.customer,
          failures: [],
          total_inspections: 0
        };
      }
      
      acc[key].total_inspections++;
      
      if (record.failureCount > 0) {
        acc[key].failures.push({
          type: record.failureTypes?.join(', ') || 'unknown',
          date: record.createdAt,
          severity: record.status === 'on_hold' ? 'high' : 'medium'
        });
      }
      
      return acc;
    }, {});

    const dataForAnalysis: AggregatedInspection[] = Object.values(aggregatedData);

    if (!runAnalysis) {
      // Just return the raw data without AI analysis
      return NextResponse.json({
        success: true,
        historicalData: dataForAnalysis,
        period: `${days} days`,
        totalRecords: historicalData.length
      });
    }

    // Run AI anomaly detection
    const anomalyReport = await geminiService.detectAnomalies(dataForAnalysis);

    // Process high-risk combinations
    const alerts: AlertEntry[] = [];
    
    for (const combo of anomalyReport.high_risk_combinations) {
      if (combo.predicted_failure_rate > 0.3) { // 30% failure rate threshold
        alerts.push({
          product: combo.product,
          customer: combo.customer,
          risk: combo.predicted_failure_rate,
          action: 'Implement additional QC measures'
        });

        // Log alert for high-risk combinations
        console.log('AI Anomaly Detection: High Risk Pattern Detected', {
          type: 'anomaly_detection',
          product: combo.product,
          customer: combo.customer,
          predicted_failure_rate: combo.predicted_failure_rate,
          common_issues: combo.common_issues,
          recommendation: 'Review and implement enhanced QC procedures'
        });
      }
    }

    // Store analysis results
    await db.insert(activityLog).values({
      orderId: 'SYSTEM',
      type: 'anomaly_analysis',
      message: `AI anomaly detection completed for ${days} days of data`,
      metadata: {
        patterns_found: anomalyReport.risk_patterns.length,
        high_risk_combinations: anomalyReport.high_risk_combinations.length,
        alerts_generated: alerts.length,
        analysis_period: `${days} days`
      },
      createdAt: new Date()
    });

    return NextResponse.json({
      success: true,
      analysis: {
        period: `${days} days`,
        dataPoints: historicalData.length,
        uniqueProducts: [...new Set(dataForAnalysis.map((d) => d.product))].length,
        uniqueCustomers: [...new Set(dataForAnalysis.map((d) => d.customer))].length
      },
      riskPatterns: anomalyReport.risk_patterns,
      highRiskCombinations: anomalyReport.high_risk_combinations,
      alerts,
      recommendations: anomalyReport.risk_patterns
        .filter((p: RiskPattern) => p.risk_score > 70)
        .map((p) => p.recommendation)
    });

  } catch (error) {
    console.error('Anomaly detection error:', error);
    return NextResponse.json(
      { error: 'Failed to run anomaly detection' },
      { status: 500 }
    );
  }
}

// GET endpoint for scheduled jobs
export async function GET(request: NextRequest) {
  // This can be called by a cron job or AWS EventBridge
  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ days: 7, runAnalysis: true })
  }));
}
