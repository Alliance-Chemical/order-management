'use client';

import { useState } from 'react';
import Link from 'next/link';
import FreightNavigation from '@/components/navigation/FreightNavigation';
import { formatWarehouseText } from '@/lib/warehouse-ui-utils';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  BookOpenIcon,
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  TruckIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';

export default function TrainingPage() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview'])
  );

  const toggleSection = (id: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSections(newExpanded);
  };

  const Section = ({
    id,
    title,
    icon: Icon,
    children
  }: {
    id: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
  }) => {
    const isExpanded = expandedSections.has(id);

    return (
      <div className="bg-white rounded-warehouse shadow-warehouse border-2 border-gray-200 mb-4 overflow-hidden">
        <button
          onClick={() => toggleSection(id)}
          className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Icon className="w-6 h-6 text-blue-600" />
            <h2 className="text-warehouse-xl font-black text-gray-900 uppercase">
              {title}
            </h2>
          </div>
          {isExpanded ? (
            <ChevronDownIcon className="w-6 h-6 text-gray-600" />
          ) : (
            <ChevronRightIcon className="w-6 h-6 text-gray-600" />
          )}
        </button>
        {isExpanded && (
          <div className="px-6 py-6 prose prose-lg max-w-none">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <FreightNavigation className="bg-white shadow-sm border-b px-6 py-4" />

      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-warehouse shadow-warehouse p-8 mb-8 text-white">
          <h1 className="text-warehouse-3xl font-black uppercase mb-2">
            {formatWarehouseText('Training Guide', 'critical')}
          </h1>
          <p className="text-xl">
            Alliance Chemical Freight Management System
          </p>
        </div>

        {/* Quick Reference Card */}
        <div className="bg-blue-50 border-2 border-blue-300 rounded-warehouse p-6 mb-6">
          <h3 className="text-warehouse-lg font-black text-blue-900 mb-4">
            🚀 QUICK REFERENCE
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong className="text-blue-900">Worker Quick Start:</strong>
              <ol className="ml-4 mt-1 text-gray-700">
                <li>1. Scan QR code</li>
                <li>2. Select inspector name</li>
                <li>3. Check items → Take photos</li>
                <li>4. Submit when done</li>
              </ol>
            </div>
            <div>
              <strong className="text-blue-900">Supervisor Quick Start:</strong>
              <ol className="ml-4 mt-1 text-gray-700">
                <li>1. Open Freight HUD</li>
                <li>2. Review worker inspection</li>
                <li>3. Complete pre-ship checklist</li>
                <li>4. Enter measurements</li>
                <li>5. Mark ready to ship</li>
              </ol>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-blue-300">
            <strong className="text-blue-900">Key URLs:</strong>
            <div className="flex flex-wrap gap-3 mt-2">
              <Link href="/" className="text-blue-700 hover:underline font-mono text-xs">/ (Work Queue)</Link>
              <Link href="/freight-orders?tab=hud" className="text-blue-700 hover:underline font-mono text-xs">/freight-orders (HUD)</Link>
            </div>
          </div>
        </div>

        {/* Sections */}
        <Section id="overview" title="System Overview" icon={BookOpenIcon}>
          <p className="lead">
            This application manages the <strong>entire freight order workflow</strong> for Alliance Chemical,
            from order intake through shipping. Every workspace represents a freight order moving through
            various inspection and preparation phases.
          </p>

          <h3>Workflow Lifecycle</h3>
          <div className="bg-gray-100 p-6 rounded-lg font-mono text-sm">
            <div className="space-y-2">
              <div>1. PENDING/PLANNING</div>
              <div className="ml-4">↓ (Order received from ShipStation)</div>
              <div>2. PRE_MIX</div>
              <div className="ml-4">↓ (Worker performs mixing/prep inspection)</div>
              <div>3. PRE_SHIP</div>
              <div className="ml-4">↓ (Worker performs pre-shipment inspection)</div>
              <div>4. READY_TO_SHIP</div>
              <div className="ml-4">↓ (Supervisor marks ready after final checks)</div>
              <div>5. SHIPPED</div>
              <div className="ml-4">(Order complete)</div>
            </div>
          </div>
        </Section>

        <Section id="roles" title="User Roles" icon={UserGroupIcon}>
          <h3>Workers (Warehouse Floor)</h3>
          <ul>
            <li>Perform Pre-Mix and Pre-Ship inspections</li>
            <li>Take photos of containers and pallets</li>
            <li>Complete checklists and measurements</li>
            <li>Access via mobile/tablet (glove-friendly UI)</li>
          </ul>

          <h3>Supervisors (Office/Management)</h3>
          <ul>
            <li>Review worker inspections</li>
            <li>Mark orders ready to ship</li>
            <li>Manage freight HUD (Unready → Ready → Booked)</li>
            <li>Archive or reset orders</li>
            <li>Enter final measurements and shipping details</li>
          </ul>
        </Section>

        <Section id="worker-inspection" title="Worker Inspections" icon={ClipboardDocumentCheckIcon}>
          <h3>How to Perform an Inspection</h3>

          <h4>Step 1: Access the Workspace</h4>
          <ul>
            <li><strong>Method 1:</strong> Scan QR code on container with phone/tablet</li>
            <li><strong>Method 2:</strong> Click order from Work Queue (<code>/</code>)</li>
          </ul>

          <h4>Step 2: Start Inspection</h4>
          <ol>
            <li>Entry screen shows order details</li>
            <li>Click large <strong>"START INSPECTION"</strong> button</li>
            <li>Select your name from inspector dropdown</li>
          </ol>

          <h4>Step 3: Complete Checklist</h4>
          <p>For each container/item:</p>
          <ul>
            <li>Read checklist item carefully</li>
            <li>Take photo (tap camera icon)</li>
            <li>Mark <span className="text-green-600 font-bold">✅ PASS</span> or <span className="text-red-600 font-bold">❌ FAIL</span></li>
            <li>If FAIL, add note explaining the issue</li>
            <li>Enter quantity if needed</li>
          </ul>

          <h4>Step 4: Submit</h4>
          <ul>
            <li>Review summary of all items</li>
            <li>Click <strong>"SUBMIT INSPECTION"</strong></li>
            <li>Confirmation appears</li>
            <li>Auto-redirect to supervisor view</li>
          </ul>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-4">
            <p className="text-sm">
              <strong>💡 Tip:</strong> All buttons are large and glove-friendly.
              Photos are required for quality control.
            </p>
          </div>
        </Section>

        <Section id="supervisor-preship" title="Supervisor: Complete Pre-Ship" icon={TruckIcon}>
          <h3>How to Mark an Order Ready to Ship</h3>

          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 mb-4">
            <p className="font-bold text-green-900">
              This is the main task supervisors perform to clear inspections!
            </p>
          </div>

          <h4>Step 1: Open the Order</h4>
          <ol>
            <li>Go to <code>/freight-orders?tab=hud</code></li>
            <li>Find order in <strong>"Unready"</strong> lane</li>
            <li>Click <strong>"📂 OPEN"</strong> button</li>
          </ol>

          <h4>Step 2: Review Worker Inspection</h4>
          <ol>
            <li>Click <strong>"Pre-Ship"</strong> tab</li>
            <li>Click <strong>"Review Worker Inspection"</strong> link</li>
            <li>Verify all checklist items passed</li>
            <li>Review photos for quality</li>
          </ol>

          <h4>Step 3: Enter Shipping Information</h4>
          <ul>
            <li><strong>BOL Number:</strong> Required (e.g., BOL-2025-12345)</li>
            <li><strong>Carrier Name:</strong> Required (e.g., XPO Logistics)</li>
            <li><strong>Trailer Number:</strong> Optional (e.g., TRL-9876)</li>
            <li><strong>Seal Numbers:</strong> Add multiple if needed</li>
          </ul>

          <h4>Step 4: Complete Pre-Ship Checklist</h4>
          <p>Check all 5 required items:</p>
          <ul>
            <li>☑️ Order Matches Shipment</li>
            <li>☑️ Containers Clean & Free of Debris</li>
            <li>☑️ Caps Clean & Free of Debris</li>
            <li>☑️ No Leaks Detected</li>
            <li>☑️ Pallet Condition Good & Stable</li>
          </ul>

          <h4>Step 5: Enter Final Measurements</h4>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-3">
            <p className="font-bold text-blue-900">⚠️ Critical for freight booking!</p>
          </div>
          <ul>
            <li><strong>Dimensions:</strong> Length, Width, Height (in inches)</li>
            <li><strong>Weight:</strong> Total weight (in lbs)</li>
            <li><strong>Measured By:</strong> Your name</li>
            <li>Click <strong>"💾 SAVE MEASUREMENTS"</strong> button</li>
            <li>Wait for green checkmark confirmation</li>
          </ul>

          <h4>Step 6: Mark Ready to Ship</h4>
          <ol>
            <li>Verify all sections complete (shipping info, checklist, measurements)</li>
            <li>Click <strong>"✅ MARK READY TO SHIP"</strong> button</li>
            <li>Confirm in popup dialog</li>
          </ol>

          <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 mt-4">
            <h5 className="font-bold text-green-900 mb-2">✅ Result:</h5>
            <ul className="text-sm text-green-800">
              <li>✓ Order moves to "Ready to Book" lane in HUD</li>
              <li>✓ ShipStation tags updated automatically</li>
              <li>✓ Activity logged with timestamp</li>
              <li>✓ Ready for freight booking</li>
            </ul>
          </div>
        </Section>

        <Section id="hud-actions" title="Freight HUD Actions" icon={TruckIcon}>
          <h3>Understanding the Three Lanes</h3>

          <div className="space-y-4">
            <div className="border-l-4 border-gray-500 pl-4">
              <h4 className="font-bold">⏸️ UNREADY Lane</h4>
              <p>Orders still in progress, pre-ship not completed</p>
              <p className="text-sm text-gray-600">
                <strong>Actions:</strong> Open, Archive
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-bold">✅ READY TO BOOK Lane</h4>
              <p>Pre-ship inspection complete, ready for freight booking</p>
              <p className="text-sm text-gray-600">
                <strong>Actions:</strong> Open, Book, Reset, Archive
              </p>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-bold">📦 BOOKED Lane</h4>
              <p>Freight carrier booked, awaiting shipment</p>
              <p className="text-sm text-gray-600">
                <strong>Actions:</strong> Open, Archive
              </p>
            </div>
          </div>

          <h3 className="mt-6">HUD Action Explanations</h3>
          <dl className="space-y-3">
            <div>
              <dt className="font-bold">📂 Open</dt>
              <dd className="ml-4 text-gray-700">Navigate to full workspace details</dd>
            </div>
            <div>
              <dt className="font-bold">🔄 Reset</dt>
              <dd className="ml-4 text-gray-700">
                Undo pre-ship completion, return to active queue. Use when measurements
                need correction or rework is required.
              </dd>
            </div>
            <div>
              <dt className="font-bold">🗄️ Archive</dt>
              <dd className="ml-4 text-gray-700">
                Remove from active view with optional reason. Order is saved but hidden from HUD.
              </dd>
            </div>
            <div>
              <dt className="font-bold">📦 Book</dt>
              <dd className="ml-4 text-gray-700">
                Mark as booked with freight carrier (stub for MyCarrier integration)
              </dd>
            </div>
          </dl>
        </Section>

        <Section id="troubleshooting" title="Troubleshooting" icon={WrenchScrewdriverIcon}>
          <h3>Common Issues & Solutions</h3>

          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-bold text-red-600">Issue: Can't mark ready to ship</h4>
              <p className="text-sm mt-2"><strong>Causes:</strong></p>
              <ul className="text-sm">
                <li>Required checklist items not completed</li>
                <li>BOL or Carrier missing</li>
                <li>Final measurements not saved</li>
              </ul>
              <p className="text-sm mt-2"><strong>Solution:</strong></p>
              <ol className="text-sm">
                <li>Check all 5 checklist boxes</li>
                <li>Fill in BOL Number and Carrier Name</li>
                <li>Enter and SAVE measurements (wait for green checkmark)</li>
              </ol>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-bold text-red-600">Issue: Order not showing in HUD</h4>
              <p className="text-sm mt-2"><strong>Solutions:</strong></p>
              <ul className="text-sm">
                <li>Check ShipStation for tag ID 19844 (Freight Orders)</li>
                <li>Run "Poll Freight Orders" from All Freight Orders tab</li>
                <li>Verify order status is <code>active</code> or <code>in_progress</code></li>
              </ul>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-bold text-red-600">Issue: Photos not appearing</h4>
              <p className="text-sm mt-2"><strong>Solutions:</strong></p>
              <ul className="text-sm">
                <li>Check browser camera permissions</li>
                <li>Retry photo capture</li>
                <li>Check network connection</li>
                <li>Improve lighting conditions</li>
              </ul>
            </div>
          </div>
        </Section>

        {/* Footer */}
        <div className="mt-8 p-6 bg-gray-100 rounded-warehouse text-center text-sm text-gray-600">
          <p>
            <strong>Alliance Chemical Freight Management System</strong>
          </p>
          <p className="mt-1">
            Version 1.0 | Last Updated: January 2025
          </p>
          <p className="mt-2">
            For support, contact your supervisor or development team
          </p>
        </div>
      </div>
    </div>
  );
}
