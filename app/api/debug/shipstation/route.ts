import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.SHIPSTATION_API_KEY;
  const apiSecret = process.env.SHIPSTATION_API_SECRET;
  
  // Basic validation
  if (!apiKey || !apiSecret) {
    return NextResponse.json({
      error: 'Missing credentials',
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
      apiKeyLength: apiKey?.length || 0,
      apiSecretLength: apiSecret?.length || 0
    }, { status: 500 });
  }

  // Create auth header - trim any whitespace
  const trimmedKey = apiKey.trim();
  const trimmedSecret = apiSecret.trim();
  const auth = Buffer.from(`${trimmedKey}:${trimmedSecret}`).toString('base64');
  
  // Expected auth string for debugging
  const expectedAuth = 'ZGU4YTY5ZjYxNmY0NGQ2NDg3MDk3YmY0ZTVhYjQ2ZjI6MGY0ZjVlNWNjOWJkNGVhMzlkYWM2ZmY0NDc5MTQ2NjQ=';
  
  try {
    // Try a simple API call to test authentication
    const response = await fetch('https://ssapi.shipstation.com/carriers', {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    const responseText = await response.text();
    
    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText.substring(0, 500), // First 500 chars
      credentials: {
        apiKeyLength: apiKey.length,
        apiSecretLength: apiSecret.length,
        apiKeyPrefix: apiKey.substring(0, 8) + '...',
        authHeaderLength: auth.length,
        authMatches: auth === expectedAuth,
        actualAuth: auth.substring(0, 20) + '...',
        expectedAuthPrefix: expectedAuth.substring(0, 20) + '...',
        trimmedKeyLength: trimmedKey.length,
        trimmedSecretLength: trimmedSecret.length
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      credentials: {
        apiKeyLength: apiKey.length,
        apiSecretLength: apiSecret.length,
        apiKeyPrefix: apiKey.substring(0, 8) + '...'
      }
    }, { status: 500 });
  }
}