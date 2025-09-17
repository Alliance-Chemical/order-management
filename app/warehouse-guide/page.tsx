'use client';

import React from 'react';
import { Package, QrCode, CheckCircle, AlertTriangle, Truck, ClipboardCheck } from 'lucide-react';

export default function WarehouseGuide() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-black text-gray-900 mb-8">WAREHOUSE GUIDE</h1>
        
        {/* Quick Start */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
            <Package className="mr-3 text-warehouse-info" />
            QUICK START
          </h2>
          <ol className="space-y-3 text-lg">
            <li className="flex items-start">
              <span className="font-bold mr-2">1.</span>
              <span>Open work queue on tablet</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">2.</span>
              <span>Pick order from list</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">3.</span>
              <span>Scan or type order number</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">4.</span>
              <span>Follow on-screen steps</span>
            </li>
          </ol>
        </div>

        {/* QR Codes */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
            <QrCode className="mr-3 text-warehouse-info" />
            QR CODES & LABELS
          </h2>
          <div className="space-y-4 text-lg">
            <div>
              <p className="font-bold mb-2">DRUMS & TOTES:</p>
              <p className="ml-4">1 label per container (5 drums = 5 labels)</p>
            </div>
            <div>
              <p className="font-bold mb-2">PAILS & CASES:</p>
              <p className="ml-4">1 label for entire shipment</p>
            </div>
            <div className="bg-warehouse-caution/10 border-2 border-warehouse-caution rounded p-3">
              <p className="font-bold">⚠️ ALWAYS SCAN BEFORE APPLYING</p>
            </div>
          </div>
        </div>

        {/* Inspection Steps */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
            <ClipboardCheck className="mr-3 text-warehouse-go" />
            INSPECTION CHECKLIST
          </h2>
          <div className="space-y-3 text-lg">
            <label className="flex items-center p-3 bg-gray-50 rounded">
              <input type="checkbox" className="w-6 h-6 mr-3" />
              <span>Container sealed properly</span>
            </label>
            <label className="flex items-center p-3 bg-gray-50 rounded">
              <input type="checkbox" className="w-6 h-6 mr-3" />
              <span>No visible leaks or damage</span>
            </label>
            <label className="flex items-center p-3 bg-gray-50 rounded">
              <input type="checkbox" className="w-6 h-6 mr-3" />
              <span>Labels match order</span>
            </label>
            <label className="flex items-center p-3 bg-gray-50 rounded">
              <input type="checkbox" className="w-6 h-6 mr-3" />
              <span>Hazmat placards correct (if needed)</span>
            </label>
            <label className="flex items-center p-3 bg-gray-50 rounded">
              <input type="checkbox" className="w-6 h-6 mr-3" />
              <span>Weight recorded</span>
            </label>
          </div>
        </div>

        {/* Hazmat Safety */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
            <AlertTriangle className="mr-3 text-warehouse-stop" />
            HAZMAT SAFETY
          </h2>
          <div className="space-y-4 text-lg">
            <div className="bg-warehouse-stop/10 border-2 border-warehouse-stop rounded p-4">
              <p className="font-bold mb-2">🛑 STOP if you see:</p>
              <ul className="ml-4 space-y-1">
                <li>• Spills or leaks</li>
                <li>• Damaged containers</li>
                <li>• Wrong hazmat labels</li>
                <li>• Missing safety sheets</li>
              </ul>
            </div>
            <div className="bg-warehouse-go/10 border-2 border-warehouse-go rounded p-4">
              <p className="font-bold mb-2">✓ PPE REQUIRED:</p>
              <ul className="ml-4 space-y-1">
                <li>• Safety glasses</li>
                <li>• Chemical gloves</li>
                <li>• Steel-toe boots</li>
                <li>• Apron for liquids</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Shipping */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
            <Truck className="mr-3 text-warehouse-info" />
            SHIPPING PREP
          </h2>
          <ol className="space-y-3 text-lg">
            <li className="flex items-start">
              <span className="font-bold mr-2">1.</span>
              <span>Complete final inspection</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">2.</span>
              <span>Take photos of pallet</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">3.</span>
              <span>Print BOL (Bill of Lading)</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">4.</span>
              <span>Attach documents to pallet</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">5.</span>
              <span>Move to shipping dock</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">6.</span>
              <span>Mark as &quot;Ready to Ship&quot;</span>
            </li>
          </ol>
        </div>

        {/* Common Issues */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">COMMON PROBLEMS</h2>
          <div className="space-y-4 text-lg">
            <div className="border-l-4 border-warehouse-caution pl-4">
              <p className="font-bold">Scanner not working?</p>
              <p className="text-gray-600">→ Type the code manually</p>
            </div>
            <div className="border-l-4 border-warehouse-caution pl-4">
              <p className="font-bold">Wrong label count?</p>
              <p className="text-gray-600">→ Check container type, ask supervisor</p>
            </div>
            <div className="border-l-4 border-warehouse-caution pl-4">
              <p className="font-bold">Can&apos;t find product?</p>
              <p className="text-gray-600">→ Check alternate SKU in system</p>
            </div>
            <div className="border-l-4 border-warehouse-caution pl-4">
              <p className="font-bold">System error?</p>
              <p className="text-gray-600">→ Refresh page, try again</p>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-warehouse-info text-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4">NEED HELP?</h2>
          <div className="text-xl space-y-2">
            <p>📱 Call Supervisor: ext. 2100</p>
            <p>🚨 Emergency: ext. 911</p>
            <p>💻 IT Support: ext. 2150</p>
          </div>
        </div>
      </div>
    </div>
  );
}
