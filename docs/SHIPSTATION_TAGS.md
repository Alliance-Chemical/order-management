# ShipStation Tag Configuration

## All Tags in ShipStation Account

| Tag ID | Tag Name | Color | Hex |
|--------|----------|-------|-----|
| 44791 | Amazon Prime Order | Light Cyan | #CCFFFF |
| 49499 | Back Order | Light Orange | #FFCC99 |
| 44125 | Customer Pick Up | Dark Red | #700303 |
| 46283 | Delay Shipment/Don't Ship | Light Purple | #CC99FF |
| 51273 | Documents / Certificates Required | Orange | #FF6600 |
| 44123 | **Freight Order Ready** | Green | #00FF00 |
| 19844 | **Freight Orders** | Red | #FF0000 |
| 44198 | Hazmat Orders | Purple | #800080 |
| 48500 | HOT SHIPMENT - SHIP TODAY | Light Blue | #99CCFF |
| 47435 | International Orders | Brown | #993300 |
| 44126 | Local Customer Order | Blue | #0000FF |
| 44790 | Local Customer Ready | Yellow-Green | #99CC00 |
| 44777 | Need Labels | Yellow | #FFFF00 |
| 44744 | No Inventory | Black | #000000 |
| 57205 | Pick & Pack Ship Today! | Cyan | #00CCFF |
| 44124 | SAIC/GOV/AMENTUM Order | Magenta | #FF00FF |
| 44789 | SAIC/GOV/AMENTUM Order Ready | Light Green | #CCFFCC |
| 54309 | UMS | Olive | #808000 |

## Required Tags for PR-7 Workflow

### Tags We'll Use:

1. **FreightStaged** (⚠️ NEEDS TO BE CREATED)
   - Purpose: Marks orders when planning is locked
   - Suggested color: Orange (#FFA500) or use "Need Labels" yellow (#FFFF00)
   - Trigger: When `planning.locked = true`

2. **Freight Order Ready** (✅ EXISTS - ID: 44123)
   - Purpose: Marks orders that passed pre-ship inspection
   - Color: Green (#00FF00)
   - Trigger: When `pre_ship.completed = true`

## Setup Instructions

### Option 1: Create New "FreightStaged" Tag

1. Log into ShipStation
2. Go to Settings > Store Setup > Order Tags
3. Click "Add Tag"
4. Enter name: `FreightStaged`
5. Choose color: Orange (#FFA500)
6. Click "Save"
7. Run `npx tsx scripts/fetch-shipstation-tags.ts` to get the new tag ID

### Option 2: Repurpose Existing Tag

You could repurpose the "Need Labels" tag (ID: 44777, Yellow) since it semantically fits the "staged" concept:
- Orders with locked planning often need labels printed
- Yellow color indicates "in progress/attention needed"

## Environment Variables

Add these to your `.env.local`:

```env
# ShipStation Tag IDs for workflow automation

# Option 1: After creating FreightStaged tag
FREIGHT_STAGED_TAG_ID=<new_tag_id>  # Get after creating tag
FREIGHT_READY_TAG_ID=44123          # "Freight Order Ready"

# Option 2: Using existing "Need Labels" tag
# FREIGHT_STAGED_TAG_ID=44777       # "Need Labels" (Yellow)
# FREIGHT_READY_TAG_ID=44123        # "Freight Order Ready" (Green)

# Other tags
FREIGHT_ORDERS_TAG_ID=19844         # "Freight Orders" (Red) - general freight tag
READY_TO_SHIP_TAG=19845            # Default ready to ship tag (if exists)
```

## Workflow Tag Automation

The system automatically manages these tags based on workflow state:

| Workflow Event | Action | Tag | Tag ID | Trigger |
|----------------|--------|-----|--------|---------|
| Planning locked | Add | FreightStaged | TBD | `planning.locked = true` |
| Pre-ship inspection passed | Add | Freight Order Ready | 44123 | `pre_ship.completed = true` |
| Order shipped | Remove | FreightStaged | TBD | When marking as shipped |

## Activity Log Events

All tag operations are logged with these event types:
- `shipstation_tag_added` - When a tag is added to an order
- `shipstation_tag_removed` - When a tag is removed from an order

Each log entry includes:
- `tag`: The tag name
- `orderId`: The ShipStation order ID
- `trigger`: What caused the tag change

## Available Scripts

- `scripts/fetch-shipstation-tags.ts` - Fetches all tags from ShipStation
- `scripts/create-shipstation-tag.ts` - Checks if required tags exist and provides setup instructions

## Notes

- ShipStation doesn't provide a public API to create tags programmatically
- Tags must be created manually through the ShipStation UI
- Tag IDs are unique to each ShipStation account
- Consider your existing tag naming conventions when creating new tags
- The system will gracefully handle tag operation failures (logs error but continues)