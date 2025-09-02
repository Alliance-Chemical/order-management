# MyCarrier API Setup Guide

## Current Status
✅ **Scripts Created**: All booking scripts are ready
✅ **Routes Fixed**: API endpoints updated to correct URLs  
❌ **Credentials Missing**: Need to add MyCarrier API credentials

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# MyCarrier Sandbox (for testing)
MYCARRIER_USERNAME_SANDBOX=your_sandbox_username
MYCARRIER_API_KEY_SANDBOX=your_sandbox_password

# MyCarrier Production (for live bookings)
MYCARRIER_USERNAME_PRODUCTION=your_production_username
MYCARRIER_API_KEY_PRODUCTION=your_production_password

# Optional: Override default URLs if needed
MYCARRIER_BASE_SANDBOX_URL=https://order-public-api.sandbox.mycarriertms.com
MYCARRIER_BASE_PRODUCTION_URL=https://order-public-api.api.mycarriertms.com
```

## How to Get Credentials

1. **Contact MyCarrier** for API access
2. Request both sandbox and production credentials
3. They will provide:
   - Username (for Basic Auth)
   - Password/API Key (for Basic Auth)

## Testing the Connection

Once you have credentials:

1. **Test API connection**:
   ```bash
   npx tsx scripts/test-mycarrier-api.ts
   ```

2. **Book pending orders**:
   ```bash
   npx tsx scripts/book-pending-freight-orders.ts
   ```

3. **Verify bookings**:
   ```bash
   npx tsx scripts/verify-mycarrier-booking.ts
   ```

## Current Pending Orders

You have 4 pending orders ready to book:
- SHIPSTATION-INTEGRATION ($950.00)
- INTEGRATION-TEST  
- PERF-TEST ($500.00)
- TEST-ORDER-002 ($750.00)

## API Flow

1. **Order Creation**: Sends order to MyCarrier `/api/Orders` endpoint
2. **Response**: Returns order ID and tracking number
3. **Database Update**: Stores MyCarrier ID and updates status to "booked"
4. **Workspace Link**: Order is linked to workspace with QR codes

## Troubleshooting

If booking fails:
- Check credentials are correct
- Verify network connectivity  
- Review MyCarrier API documentation
- Check error logs in database `internal_notes` field

## Next Steps

1. Add MyCarrier credentials to `.env.local`
2. Run `npx tsx scripts/test-mycarrier-api.ts` to verify connection
3. Run `npx tsx scripts/book-pending-freight-orders.ts` to book orders
4. Check results with `npx tsx scripts/verify-mycarrier-booking.ts`