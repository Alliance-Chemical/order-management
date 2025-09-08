import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const sql = neon(process.env.DATABASE_URL!);

async function createFreightTables() {
  try {
    console.log('Creating freight tables...');
    
    // Create freight_orders table
    await sql`
      CREATE TABLE IF NOT EXISTS freight_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES qr_workspace.workspaces(id),
        order_id BIGINT NOT NULL UNIQUE,
        order_number VARCHAR(100) NOT NULL,
        mycarrier_order_id VARCHAR(100),
        tracking_number VARCHAR(255),
        carrier_name VARCHAR(255),
        service_type VARCHAR(100),
        estimated_cost DECIMAL(10,2),
        actual_cost DECIMAL(10,2),
        origin_address JSONB,
        destination_address JSONB,
        package_details JSONB,
        booking_status VARCHAR(50) DEFAULT 'pending',
        booked_at TIMESTAMP,
        shipped_at TIMESTAMP,
        delivered_at TIMESTAMP,
        ai_suggestions JSONB DEFAULT '[]'::jsonb,
        confidence_score DECIMAL(3,2),
        decision_source VARCHAR(50),
        session_id UUID,
        telemetry_data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        created_by VARCHAR(255),
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by VARCHAR(255),
        special_instructions TEXT,
        internal_notes TEXT
      )
    `;
    
    // Create freight_quotes table
    await sql`
      CREATE TABLE IF NOT EXISTS freight_quotes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        freight_order_id UUID REFERENCES freight_orders(id),
        carrier_name VARCHAR(255) NOT NULL,
        service_type VARCHAR(100),
        quoted_cost DECIMAL(10,2) NOT NULL,
        transit_time INTEGER,
        quote_reference VARCHAR(255),
        valid_until TIMESTAMP,
        raw_quote_data JSONB,
        is_selected BOOLEAN DEFAULT false,
        selected_at TIMESTAMP,
        selected_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    // Create freight_events table  
    await sql`
      CREATE TABLE IF NOT EXISTS freight_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        freight_order_id UUID REFERENCES freight_orders(id),
        event_type VARCHAR(100) NOT NULL,
        event_description VARCHAR(500),
        event_data JSONB DEFAULT '{}'::jsonb,
        performed_by VARCHAR(255),
        performed_at TIMESTAMP DEFAULT NOW(),
        location VARCHAR(255)
      )
    `;
    
    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_freight_workspace_id ON freight_orders(workspace_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_freight_order_id ON freight_orders(order_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_freight_booking_status ON freight_orders(booking_status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_freight_carrier ON freight_orders(carrier_name)`;
    
    await sql`CREATE INDEX IF NOT EXISTS idx_quote_freight_order_id ON freight_quotes(freight_order_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_quote_carrier ON freight_quotes(carrier_name)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_quote_selected ON freight_quotes(is_selected)`;
    
    await sql`CREATE INDEX IF NOT EXISTS idx_event_freight_order_id ON freight_events(freight_order_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_event_type ON freight_events(event_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_event_performed_at ON freight_events(performed_at)`;
    
    console.log('✅ Freight tables created successfully!');
  } catch (error) {
    console.error('❌ Error creating freight tables:', error);
    process.exit(1);
  }
}

createFreightTables();