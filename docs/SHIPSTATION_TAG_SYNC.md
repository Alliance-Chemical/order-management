# ShipStation Tag Sync Integration

## Overview

The system now supports bidirectional synchronization between ShipStation tags and workflow phases. When warehouse staff manually tag orders in ShipStation, those changes automatically update the workflow phase in our system.

## How It Works

### Automatic Tag → Workflow Sync

When tags are changed in ShipStation (either manually or via API), the system:

1. **Receives webhook** from ShipStation (ORDER_NOTIFY, TAG_UPDATE events)
2. **Fetches current tags** from the order
3. **Maps tags to workflow phases** based on predefined rules
4. **Updates workspace** with new phase and module states
5. **Logs activity** for audit trail

### Tag Mapping Rules

| ShipStation Tag | Tag ID | Workflow Phase | Module State Changes |
|-----------------|--------|----------------|---------------------|
| Need Labels / FreightStaged | 44777 | pre_mix | `planning.locked = true` |
| Freight Order Ready | 44123 | pre_ship | `pre_ship.completed = true` |
| HOT SHIPMENT | 48500 | (no phase change) | `priority = high`, `shipping.expedited = true` |
| Delay Shipment | 46283 | (no phase change) | `onHold = true`, `shipping.hold = true` |
| Documents Required | 51273 | (no phase change) | `documents.required = true` |

### Workflow → Tag Sync (PR-7)

The system also automatically adds/removes tags based on workflow events:

| Workflow Event | Tag Action | Tag |
|----------------|------------|-----|
| Planning locked | Add | FreightStaged/Need Labels |
| Pre-ship inspection passed | Add | Freight Order Ready |
| Order shipped | Remove | FreightStaged |

## Manual Operations

### Sync All Active Orders

Run this periodically to ensure consistency:

```bash
npx tsx scripts/sync-shipstation-tags.ts
```

### Sync Specific Order

```bash
npx tsx scripts/sync-shipstation-tags.ts <orderId>
```

### Check Tag Mapping

```bash
npx tsx scripts/sync-shipstation-tags.ts --mapping
```

## Webhook Configuration

### Required Webhook Events in ShipStation

Configure these webhooks in ShipStation (Settings > API Settings > Webhooks):

1. **ORDER_NOTIFY** - Triggers on order updates
2. **TAG_UPDATE** - Triggers on tag changes (if available)
3. **SHIP_NOTIFY** - Triggers when order ships

### Webhook Endpoint

```
https://your-domain.com/api/webhook/shipstation
```

### Security

Add webhook secret for signature verification:

```env
SHIPSTATION_WEBHOOK_SECRET=your_webhook_secret
```

## Manual Tagging Workflow

### For Warehouse Staff

1. **View order in ShipStation**
2. **Apply appropriate tags:**
   - "Need Labels" → Order is staged and ready for processing
   - "Freight Order Ready" → Pre-ship inspection passed
   - "HOT SHIPMENT" → Expedite this order
   - "Delay Shipment" → Hold this order
3. **System automatically updates** within seconds via webhook

### For Supervisors

1. **Monitor tag consistency** using sync script
2. **Review activity logs** to see tag-triggered phase changes
3. **Validate tag rules** match business workflow

## Implementation Details

### Key Files

- `/lib/services/shipstation/tag-sync.ts` - Core sync logic
- `/lib/services/shipstation/tags.ts` - Tag operations
- `/app/api/webhook/shipstation/route.ts` - Webhook handler
- `/scripts/sync-shipstation-tags.ts` - Manual sync tool

### Database Impact

Tag sync operations:
- Update `workspaces.workflowPhase`
- Update `workspaces.moduleStates`
- Create entries in `activity_log`

### Error Handling

- Failed tag syncs are logged but don't block operations
- Webhook retries handled by ShipStation
- Manual sync provides detailed error reporting

## Troubleshooting

### Tags Not Syncing

1. Check webhook is configured in ShipStation
2. Verify webhook secret matches environment variable
3. Run manual sync to check for errors
4. Check activity log for sync attempts

### Inconsistent States

Run validation:
```bash
npx tsx scripts/sync-shipstation-tags.ts
```

This will report any inconsistencies like:
- Order has both STAGED and READY tags
- Phase doesn't match expected tags
- Missing required tags for phase

### Performance Considerations

- Webhook processing is async and non-blocking
- Manual sync includes rate limiting (200ms between orders)
- Tag operations are idempotent (safe to retry)

## Future Enhancements

1. **Custom tag rules** - Allow configuration of tag → phase mappings
2. **Tag groups** - Support multiple tags triggering same phase
3. **Conditional logic** - More complex tag-based workflows
4. **Bulk tag operations** - Update multiple orders at once
5. **Tag history** - Track tag changes over time