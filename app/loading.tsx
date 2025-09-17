import ProgressBar from '@/components/ui/ProgressBar';

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading Work Queue</h2>
          <p className="text-gray-600">Fetching today&apos;s orders...</p>
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
