import ProgressBar from '@/components/ui/ProgressBar';

export default function Loading() {
  return (
    <div className="min-h-screen bg-warehouse-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h2 className="text-warehouse-2xl font-black text-warehouse-text-primary mb-2">LOADING WORKSPACE</h2>
          <p className="text-warehouse-lg text-warehouse-text-secondary">Setting up order details...</p>
        </div>
        <ProgressBar
          value={50}
          label="Loading"
          showPercentage={false}
          variant="default"
          animated={true}
          className="w-full"
        />
      </div>
    </div>
  );
}