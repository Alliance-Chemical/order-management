# Alliance Chemical Freight Management System - Training Guide

## 🎯 System Overview

This application manages the **entire freight order workflow** for Alliance Chemical, from order intake through shipping. Every workspace represents a freight order moving through various inspection and preparation phases.

---

## 📋 Table of Contents

1. [User Roles](#user-roles)
2. [Main Dashboards](#main-dashboards)
3. [Workspace Lifecycle](#workspace-lifecycle)
4. [Worker View - Inspections](#worker-view---inspections)
5. [Supervisor View - Management](#supervisor-view---management)
6. [Common Tasks](#common-tasks)
7. [Troubleshooting](#troubleshooting)

---

## 👥 User Roles

### **Workers (Warehouse Floor)**
- Perform Pre-Mix and Pre-Ship inspections
- Take photos of containers and pallets
- Complete checklists and measurements
- Access via mobile/tablet (glove-friendly UI)

### **Supervisors (Office/Management)**
- Review worker inspections
- Mark orders ready to ship
- Manage freight HUD (Unready → Ready → Booked)
- Archive or reset orders
- Enter final measurements and shipping details

---

## 🏠 Main Dashboards

### 1. **Work Queue Dashboard** (`/` - Home Page)
**Purpose:** Main landing page showing all active freight orders

**What You See:**
- List of all freight orders with workspace links
- Order numbers, customer names, dates
- Current workflow phase (pre_mix, pre_ship, ready_to_ship)
- Final measurements (weight, dimensions)
- Quick access to print QR codes

**Key Actions:**
- Click order number → Opens workspace
- Click "Print QR" → Print container labels
- Filter by age (under 24h, 24-48h, etc.)
- Search by order number or customer

---

### 2. **Freight Orders Management** (`/freight-orders`)
**Purpose:** Poll ShipStation for freight-tagged orders and manage them

**Tabs:**

#### **🎛️ Supervisor HUD** (NEW!)
Shows orders in 3 lanes:

**Lane 1: ⏸️ UNREADY**
- Orders still in progress
- Pre-ship not completed
- **Actions:** Open, Archive

**Lane 2: ✅ READY TO BOOK**
- Pre-ship inspection complete
- Ready for freight booking
- **Actions:** Open, Book, Reset, Archive

**Lane 3: 📦 BOOKED**
- Freight carrier booked
- Awaiting shipment
- **Actions:** Open, Archive

**Supervisor Actions Explained:**
- **Open:** Go to workspace details
- **Reset:** Undo pre-ship completion, return to active queue
- **Archive:** Remove from active view (with reason)
- **Book:** Mark as booked (stub for MyCarrier integration)

#### **All Freight Orders Tab**
- Shows raw list from ShipStation
- Poll for new orders (last 7 days)
- Create workspaces for new orders

#### **Booking Ready Tab**
- Legacy view of orders with completed measurements
- Quick link to freight booking interface

---

## 🔄 Workspace Lifecycle

Every order goes through these phases:

```
1. PENDING/PLANNING
   ↓ (Order received from ShipStation)

2. PRE_MIX
   ↓ (Worker performs mixing/prep inspection)

3. PRE_SHIP
   ↓ (Worker performs pre-shipment inspection)

4. READY_TO_SHIP
   ↓ (Supervisor marks ready after final checks)

5. SHIPPED
   (Order complete)
```

### Phase Details

**PRE_MIX Phase:**
- Workers inspect source chemicals
- Check concentration, containers, safety
- Take photos during mixing process
- Complete mixing checklist

**PRE_SHIP Phase:**
- Workers inspect final palletized product
- Check for leaks, cleanliness, stability
- Verify order matches shipment
- Take loading photos
- Supervisor reviews and adds measurements

**READY_TO_SHIP Phase:**
- All inspections passed
- Final measurements entered
- BOL and carrier info added
- Ready for freight booking

---

## 📱 Worker View - Inspections

### How Workers Access

**Method 1: Scan QR Code**
- Scan container QR code with phone/tablet
- Automatically opens inspection screen
- No login needed (future enhancement)

**Method 2: Click from Work Queue**
- Go to `/` (home page)
- Click order number
- Select "Worker View" (auto-selected on mobile)

### Worker Inspection Flow

#### **Step 1: Entry Screen**
Shows:
- Order number and customer
- Workflow phase
- "Start Inspection" button

Click **START INSPECTION** to begin

#### **Step 2: Inspection Screen**

**Top Section:**
- Current item being inspected
- Progress indicator (e.g., "1 of 4 containers")
- Inspector name dropdown

**Main Checklist:**
Each item has:
- ✅ Pass / ❌ Fail buttons (large, glove-friendly)
- Optional notes field
- Photo capture button
- Quantity field

**Example Checklist Items:**
- Container is clean and free of debris
- Cap is clean and free of debris
- No leaks detected
- Labels are correct and legible
- Chemical name matches order
- Concentration is correct
- Container condition is good

**Actions:**
- Take photo → Opens camera
- Add notes → Text field appears
- Mark Pass → Green checkmark
- Mark Fail → Red X, requires note

#### **Step 3: Photo Capture**
- Camera opens automatically
- Take photo of container
- Photo saves with metadata (timestamp, inspector, item)
- Can take multiple photos per item

#### **Step 4: Complete Inspection**
- Review summary of all items
- Submit inspection
- Auto-advances to next phase OR
- Returns to supervisor if issues found

---

## 👔 Supervisor View - Management

### How Supervisors Access

**Method 1: Click from Freight HUD**
- Go to `/freight-orders?tab=hud`
- Click "📂 OPEN" on any order

**Method 2: Direct workspace link**
- `/workspace/{orderId}?view=supervisor`

### Supervisor Workspace Tabs

#### **1. Overview Tab**
Shows:
- Customer information
- Order items and quantities
- Current workflow phase
- Recent activity timeline

#### **2. Pre-Mix Inspection Tab**
Shows worker inspection results:
- Checklist completion status
- Photos taken
- Inspector name
- Pass/fail status per item

**Supervisor Actions:**
- Review photos
- Add supervisor notes
- Mark ready to proceed to pre-ship

#### **3. Pre-Ship Inspection Tab**
**This is the main tab for completing orders!**

**Sections:**

**A. Shipping Information**
- BOL Number (required)
- Carrier Name (required)
- Trailer Number
- Seal Numbers (add multiple)

**B. Pre-Ship Checklist**
- [ ] Order Matches Shipment
- [ ] Containers Clean & Free of Debris
- [ ] Caps Clean & Free of Debris
- [ ] No Leaks Detected
- [ ] Pallet Condition Good & Stable

**C. Final Measurements**
Critical for freight booking!

**Dimensions:**
- Length (inches)
- Width (inches)
- Height (inches)
- Unit (in/cm)

**Weight:**
- Total weight (lbs)
- Unit (lbs/kg)

**Measured By:**
- Supervisor name
- Auto-timestamp

**D. Loading Photos**
- Upload photos of loaded pallet
- Photos from staging area
- Photos of trailer loading

**E. Notes**
- Any special instructions
- Issues encountered
- Customer requests

**F. Mark Ready to Ship Button**
- Validates all required fields
- Updates ShipStation tags
- Moves to READY_TO_SHIP phase
- Triggers notifications

#### **4. Documents Tab**
- Upload/view PDFs, images
- COAs, SDSs, BOLs, etc.
- Document history

#### **5. Activity Timeline Tab**
- Full audit log
- Who did what and when
- Phase transitions
- Inspection completions

---

## ✅ Common Tasks

### Task 1: Complete a Pre-Ship Inspection (Supervisor)

**Goal:** Mark an order ready to ship

**Steps:**
1. Go to `/freight-orders?tab=hud`
2. Find order in "Unready" lane
3. Click "📂 OPEN"
4. Click "Pre-Ship" tab
5. **Review Worker Inspection:**
   - Click "Review Worker Inspection" link
   - Verify checklist completion
   - Check photos
6. **Enter Shipping Info:**
   - BOL Number: `BOL-2025-12345`
   - Carrier: `XPO Logistics`
   - Trailer: `TRL-9876`
   - Seal Numbers: `SEAL001`, `SEAL002`
7. **Complete Checklist:**
   - Check all 5 items (✓)
8. **Enter Final Measurements:**
   - Length: `48` in
   - Width: `40` in
   - Height: `48` in
   - Weight: `1200` lbs
   - Measured By: Your name
   - Click "💾 SAVE MEASUREMENTS"
9. **Upload Loading Photos** (optional)
10. Click "✅ MARK READY TO SHIP"
11. Confirm in popup

**Result:**
- Order moves to "Ready to Book" lane in HUD
- ShipStation tags updated
- Activity logged
- Notifications sent (if configured)

---

### Task 2: Reset an Order Back to Queue

**Goal:** Undo pre-ship completion due to error or rework needed

**Steps:**
1. Go to `/freight-orders?tab=hud`
2. Find order in "Ready to Book" lane
3. Click "🔄 RESET" button
4. Confirm: "Reset order #12345 back to active queue?"
5. Click OK

**Result:**
- Pre-ship completion cleared
- Workflow phase → `in_progress`
- Status → `active`
- ShipStation tags rolled back
- Order returns to "Unready" lane
- Activity logged

**When to Use:**
- Mistake in measurements
- Photos need retaking
- Customer requested changes
- QA issue found

---

### Task 3: Archive an Order

**Goal:** Remove completed or cancelled order from active view

**Steps:**
1. Go to `/freight-orders?tab=hud`
2. Find order in any lane
3. Click "🗄️ ARCHIVE" button
4. Enter reason (optional):
   - "Order shipped and delivered"
   - "Cancelled by customer"
   - "Duplicate order"
5. Click OK

**Result:**
- Status → `archived`
- Removed from HUD lanes
- Archived timestamp saved
- Reason logged in activity

**Note:** Archived orders can still be viewed directly via URL

---

### Task 4: Book Freight (Stub)

**Goal:** Mark order as booked with carrier

**Steps:**
1. Go to `/freight-orders?tab=hud`
2. Find order in "Ready to Book" lane
3. Click "📦 BOOK" button
4. Confirm: "Mark order as booked?"
5. Click OK

**Result:**
- freight_orders table updated
- booking_status → `booked`
- booked_at timestamp saved
- Order moves to "Booked" lane
- Activity logged

**Future Enhancement:**
- This will integrate with MyCarrier API
- Real-time freight quotes
- Carrier selection
- Tracking number capture

---

### Task 5: Print QR Codes for Containers

**Goal:** Generate and print labels for chemical containers

**Steps:**
1. Go to `/` (Work Queue)
2. Find order in list
3. Click "🖨️ PRINT QR" button
4. Modal opens showing:
   - Order items
   - Container counts
   - Label preview
5. Select label size (2" x 2", 4" x 4", etc.)
6. Click "Print"
7. Labels print with:
   - QR code
   - Order number
   - Chemical name
   - Container number
   - Short code (e.g., `A1`, `B2`)

**Result:**
- QR codes generated and saved to database
- Print count incremented
- Workers can scan to access workspace

---

### Task 6: Perform Worker Inspection

**Goal:** Complete pre-mix or pre-ship inspection as warehouse worker

**Steps:**
1. **Scan QR code** on container OR go to workspace manually
2. **Entry Screen appears:**
   - Shows order details
   - Click "START INSPECTION"
3. **Inspection Screen loads:**
   - Shows first item/container
   - Select inspector name from dropdown
4. **For each item:**
   - Read checklist item
   - Take photo (tap camera icon)
   - Mark PASS ✅ or FAIL ❌
   - If fail, add note explaining issue
   - Enter quantity if needed
5. **Move to next item:**
   - Click "Next" or swipe
   - Repeat for all containers
6. **Review Summary:**
   - See all pass/fail statuses
   - Review photos
7. **Submit Inspection:**
   - Click "SUBMIT INSPECTION"
   - Confirmation message appears
8. **Redirect:**
   - Auto-redirects to supervisor view after 5 seconds
   - Or tap to go immediately

**Result:**
- Inspection saved to database
- Photos uploaded to S3
- Activity logged
- Supervisor notified (future)
- Order advances to next phase if all pass

---

## 🔧 Troubleshooting

### Issue: Order not showing in HUD

**Possible Causes:**
1. Order is archived
2. Order doesn't have freight tag in ShipStation
3. Database not synced

**Solutions:**
1. Check ShipStation for tag ID `19844` (Freight Orders)
2. Run "Poll Freight Orders" from All Freight Orders tab
3. Check order status: must be `active` or `in_progress`

---

### Issue: Can't mark ready to ship

**Possible Causes:**
1. Required checklist items not completed
2. BOL or Carrier missing
3. Final measurements not saved

**Solutions:**
1. Check all 5 checklist boxes
2. Fill in BOL Number and Carrier Name
3. Enter and SAVE measurements first
4. Verify measurements saved (green checkmark)

---

### Issue: Reset button not working

**Possible Causes:**
1. Order already in unready state
2. Network error

**Solutions:**
1. Refresh page and try again
2. Check browser console for errors
3. Verify order is in "Ready to Book" or "Booked" lane

---

### Issue: Photos not appearing

**Possible Causes:**
1. Camera permission denied
2. Upload failed
3. S3 bucket issue

**Solutions:**
1. Check browser camera permissions
2. Retry photo capture
3. Check network connection
4. Contact admin if persistent

---

### Issue: QR code scan not working

**Possible Causes:**
1. QR code not generated yet
2. Camera focus issue
3. Code damaged/dirty

**Solutions:**
1. Print QR codes first from Work Queue
2. Clean container surface
3. Improve lighting
4. Manual entry: go to workspace directly

---

## 📊 Understanding Data

### Workspace Status Values

- `pending` - Order received, not started
- `active` - Currently being worked
- `in_progress` - Same as active
- `ready_to_ship` - Pre-ship complete, ready for booking
- `shipped` - Order shipped
- `archived` - Removed from active queue

### Workflow Phase Values

- `planning` - Initial planning stage
- `pre_mix` - Chemical mixing/prep phase
- `pre_ship` - Pre-shipment inspection phase
- `ready_to_ship` - Ready for freight booking
- `shipping` - In transit

### Booking Status (freight_orders table)

- `null` or `pending` - Not yet booked
- `booked` - Carrier booked
- `shipped` - Picked up by carrier
- `delivered` - Delivered to customer

---

## 🎓 Training Checklist

### For New Workers
- [ ] Understand workspace lifecycle
- [ ] Practice scanning QR codes
- [ ] Complete practice inspection (test order 12345)
- [ ] Take and review photos
- [ ] Know when to mark pass vs. fail
- [ ] Understand inspector name selection

### For New Supervisors
- [ ] Navigate Freight HUD
- [ ] Review worker inspections
- [ ] Complete full pre-ship inspection
- [ ] Enter final measurements
- [ ] Mark order ready to ship
- [ ] Practice reset and archive actions
- [ ] Understand ShipStation tag sync

### For Administrators
- [ ] Poll freight orders from ShipStation
- [ ] Manage feature flags
- [ ] Review activity logs
- [ ] Handle archived orders
- [ ] Troubleshoot database issues
- [ ] Configure integrations (MyCarrier, S3, etc.)

---

## 📞 Support

**For System Issues:**
- Check activity log for error details
- Review browser console
- Contact development team

**For Process Questions:**
- Refer to this guide
- Ask supervisor or manager
- Review completed order examples

**For Feature Requests:**
- Document use case
- Submit to product team
- Include screenshots/examples

---

## 🚀 Quick Reference Card

### Worker Quick Start
1. Scan QR code
2. Select inspector name
3. Check items → Take photos → Mark pass/fail
4. Submit when done

### Supervisor Quick Start
1. Open HUD: `/freight-orders?tab=hud`
2. Find order in Unready lane
3. Review worker inspection
4. Complete pre-ship checklist
5. Enter measurements + shipping info
6. Mark ready to ship

### Key URLs
- Work Queue: `/`
- Freight HUD: `/freight-orders?tab=hud`
- Workspace: `/workspace/{orderId}`
- Worker View: `/workspace/{orderId}?view=worker`
- Supervisor View: `/workspace/{orderId}?view=supervisor`

---

**Last Updated:** 2025-01-30
**Version:** 1.0
**System:** Alliance Chemical Freight Management
