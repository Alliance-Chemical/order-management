'use client';

interface PrintSummaryProps {
  itemCount: number;
  totalLabels: number;
}

export default function PrintSummary({ itemCount, totalLabels }: PrintSummaryProps) {
  return (
    <div className="warehouse-card bg-warehouse-bg-highlight">
      <h3 className="text-warehouse-xl font-black mb-4">LABEL SUMMARY</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-warehouse-lg text-warehouse-text-secondary">Total Items:</span>
          <span className="text-warehouse-2xl font-black ml-4">{itemCount}</span>
        </div>
        <div>
          <span className="text-warehouse-lg text-warehouse-text-secondary">Total Labels:</span>
          <span className="text-warehouse-2xl font-black ml-4">{totalLabels}</span>
        </div>
      </div>
    </div>
  );
}