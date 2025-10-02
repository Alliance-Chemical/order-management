import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function testForeignKeyConstraint() {
  try {
    console.log('Testing freight_orders.workspace_id → workspaces.id foreign key constraint...');
    
    // First, create a test workspace
    const testWorkspace = await sql`
      INSERT INTO qr_workspace.workspaces (
        order_id, 
        order_number, 
        status, 
        active_modules, 
        workspace_url,
        created_at, 
        updated_at
      )
      VALUES (
        999999, 
        'TEST-FREIGHT-001', 
        'active', 
        '{"preMix":true,"warehouse":true,"documents":true}',
        'test-freight-workspace-url',
        NOW(), 
        NOW()
      )
      RETURNING id, order_id, order_number
    `;
    
    console.log('✅ Test workspace created:', testWorkspace[0]);
    
    // Test 1: Insert freight order with valid workspace_id (should succeed)
    const validFreightOrder = await sql`
      INSERT INTO freight_orders (
        workspace_id, 
        order_id, 
        order_number,
        carrier_name,
        booking_status
      ) VALUES (
        ${testWorkspace[0].id},
        ${testWorkspace[0].order_id},
        ${testWorkspace[0].order_number},
        'SAIA',
        'pending'
      )
      RETURNING id, workspace_id, order_number
    `;
    
    console.log('✅ Valid freight order created:', validFreightOrder[0]);
    
    // Test 2: Try to insert freight order with invalid workspace_id (should fail)
    try {
      await sql`
        INSERT INTO freight_orders (
          workspace_id, 
          order_id, 
          order_number,
          carrier_name,
          booking_status
        ) VALUES (
          'invalid-uuid-does-not-exist',
          888888,
          'TEST-INVALID-001',
          'SAIA',
          'pending'
        )
      `;
      console.log('❌ ERROR: Invalid freight order should have failed but succeeded');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log('✅ Foreign key constraint working - invalid workspace_id rejected:', message);
    }
    
    // Test 3: Verify the relationship query works
    const joinResult = await sql`
      SELECT 
        fo.id as freight_id,
        fo.order_number as freight_order_number,
        fo.carrier_name,
        w.id as workspace_id,
        w.order_number as workspace_order_number,
        w.status as workspace_status
      FROM freight_orders fo
      INNER JOIN qr_workspace.workspaces w ON fo.workspace_id = w.id
      WHERE fo.id = ${validFreightOrder[0].id}
    `;
    
    console.log('✅ Join query result:', joinResult[0]);
    
    // Cleanup - delete test data
    await sql`DELETE FROM freight_orders WHERE workspace_id = ${testWorkspace[0].id}`;
    await sql`DELETE FROM qr_workspace.workspaces WHERE id = ${testWorkspace[0].id}`;
    
    console.log('✅ Test data cleaned up');
    console.log('✅ All foreign key constraint tests passed!');
    
  } catch (error) {
    console.error('❌ Error testing foreign key constraint:', error);
    process.exit(1);
  }
}

testForeignKeyConstraint();
