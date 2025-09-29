interface MeasurementEmailPayload {
  orderId: number
  orderNumber: string
  measurements: {
    weight?: { value?: number; units?: string }
    dimensions?: { length?: number; width?: number; height?: number; units?: string }
    measuredBy?: string
    measuredAt?: string
  }
}

const {
  GRAPH_CLIENT_ID = process.env.CLIENT_ID,
  GRAPH_CLIENT_SECRET = process.env.CLIENT_SECRET,
  GRAPH_SCOPE = process.env.GRAPH_SCOPE,
  GRAPH_API_BASE = process.env.GRAPH_API,
  GRAPH_TENANT_ID = process.env.TENANT_ID,
  GRAPH_SENDER_ADDRESS = process.env.GRAPH_SENDER_ADDRESS,
  MEASUREMENT_NOTIFY_RECIPIENT = process.env.MEASUREMENT_NOTIFY_RECIPIENT || 'cruz@alliancechemical.com',
} = process.env as Record<string, string | undefined>

async function getAccessToken(): Promise<string | null> {
  if (!GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET || !GRAPH_SCOPE || !GRAPH_TENANT_ID) {
    console.warn('[measurement-email] Missing Microsoft Graph credentials; skipping email send.')
    return null
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    client_id: GRAPH_CLIENT_ID,
    client_secret: GRAPH_CLIENT_SECRET,
    scope: GRAPH_SCOPE,
    grant_type: 'client_credentials',
  })

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const detail = await response.text()
    console.error('[measurement-email] Failed to acquire Graph token', response.status, detail)
    return null
  }

  const data = await response.json() as { access_token?: string }
  return data.access_token ?? null
}

function buildEmailBody(payload: MeasurementEmailPayload): string {
  const { orderNumber, orderId, measurements } = payload
  const length = measurements.dimensions?.length ?? '—'
  const width = measurements.dimensions?.width ?? '—'
  const height = measurements.dimensions?.height ?? '—'
  const dimUnits = measurements.dimensions?.units ?? 'in'
  const weightValue = measurements.weight?.value ?? '—'
  const weightUnits = measurements.weight?.units ?? 'lbs'
  const recordedBy = measurements.measuredBy ?? 'Unassigned'
  const recordedAt = measurements.measuredAt ? new Date(measurements.measuredAt).toLocaleString() : 'Unknown'

  return `Hello Cruz,

Dimensions and weight were recorded for freight order ${orderNumber} (ShipStation ID: ${orderId}).

Dimensions: ${length} × ${width} × ${height} ${dimUnits}
Weight: ${weightValue} ${weightUnits}
Recorded By: ${recordedBy}
Recorded At: ${recordedAt}

You can review the full workspace here: ${process.env.NEXT_PUBLIC_APP_URL || 'https://app.alliancechemical.com'}/workspace/${orderId}

— Automated notification`
}

export async function sendMeasurementNotificationEmail(payload: MeasurementEmailPayload) {
  if (!GRAPH_SENDER_ADDRESS) {
    console.warn('[measurement-email] GRAPH_SENDER_ADDRESS not configured; skipping email send.')
    return
  }

  const accessToken = await getAccessToken()
  if (!accessToken) {
    return
  }

  const bodyContent = buildEmailBody(payload)
  const graphUrl = `${GRAPH_API_BASE || 'https://graph.microsoft.com/v1.0'}/users/${encodeURIComponent(GRAPH_SENDER_ADDRESS)}/sendMail`

  const response = await fetch(graphUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        subject: `Dimensions recorded for Order ${payload.orderNumber}`,
        body: {
          contentType: 'Text',
          content: bodyContent,
        },
        toRecipients: [
          {
            emailAddress: {
              address: MEASUREMENT_NOTIFY_RECIPIENT,
            },
          },
        ],
      },
      saveToSentItems: false,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    console.error('[measurement-email] Failed to send Graph email', response.status, detail)
  }
}
