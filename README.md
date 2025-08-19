# Workspace Order Management System

A comprehensive order management and quality inspection system for Alliance Chemical, built with Next.js and PostgreSQL.

## Features

### Core Functionality
- **Order Tracking**: Real-time synchronization with ShipStation for order management
- **QR Code System**: Generate and scan QR codes for source containers, destination containers, and master labels
- **Dual-Interface Views**: 
  - Worker View: Simplified touch-friendly interface for warehouse floor operations
  - Supervisor View: Full-featured management interface with detailed controls
- **Inspection Workflows**: Pre-mix and pre-ship inspection checklists with pass/fail tracking
- **Source Container Assignment**: Digital tracking of which bulk containers are used for each order

### Recent Updates (January 2025)
- ✅ QR code scanning functionality integrated into inspection workflow
- ✅ Order item details displayed during inspections
- ✅ Source and destination QR verification steps
- ✅ Removed inappropriate documentation checks from pre-mix inspection
- ✅ Fixed QR URL generation issues with newline characters
- ✅ **Resilient Inspection System**: Implemented fallback mechanisms for QR scanning failures
  - Manual code entry with 6-8 character short codes
  - Supervisor override requests for problematic steps
  - Offline queue with automatic retry on reconnection
  - Enhanced error messages with helpful suggestions

## Tech Stack

- **Frontend**: Next.js 15.4.6 with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS v4
- **Deployment**: Vercel
- **Integrations**: ShipStation API, AWS S3, Google Gemini AI

## Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- ShipStation API credentials
- AWS credentials (for S3 storage)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/andretaki/order-management.git
cd my-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Configure the following in `.env.local`:
- `DATABASE_URL` - PostgreSQL connection string
- `SHIPSTATION_API_KEY` and `SHIPSTATION_API_SECRET`
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- `NEXT_PUBLIC_APP_URL` - Your production URL

4. Initialize the database:
```bash
npm run db:push
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Database Management

```bash
# Generate migrations
npm run db:migrate

# Apply migrations
npm run db:push

# Open Drizzle Studio
npm run db:studio

# Reset database (caution!)
npm run db:reset
```

## Deployment

The application is configured for deployment on Vercel:

```bash
vercel --prod
```

## Project Structure

```
/app/               # Next.js app directory
  /api/            # API routes
  /workspace/      # Main workspace pages
/components/       # React components
  /workspace/      # Workspace-specific components
    /worker-view/  # Simplified worker interface
    /supervisor-view/ # Full supervisor interface
/lib/              # Core libraries
  /db/            # Database schema and client
  /services/      # Business logic services
/public/          # Static assets
/scripts/         # Utility scripts
```

## Key Features

### Worker View
- Large touch-friendly buttons
- One-item-at-a-time inspection flow
- QR code scanning with camera
- Voice and photo issue reporting
- High-contrast design for warehouse visibility

### Supervisor View
- Complete order overview
- Source container assignment
- Label printing with QR codes
- Document management
- Activity timeline tracking

### Inspection Workflow

#### Pre-Mix Inspection
1. Scan source QR code
2. Verify source chemical matches order
3. Check container condition
4. Verify labels
5. Confirm quantities
6. Scan destination QR codes
7. Check hazmat placards
8. Verify seal integrity

#### Pre-Ship Inspection
1. Final container check
2. Verify shipping labels
3. Check pallet stability
4. Confirm documentation
5. Verify total weight

## Testing

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Generate coverage report
npm run test:coverage
```

## Contributing

Please read the CLAUDE.md file for detailed development guidelines and project conventions.

## License

Proprietary - Alliance Chemical

## Support

For issues or questions, contact the development team or create an issue in the repository.# Force Vercel Deployment
