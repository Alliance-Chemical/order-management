'use client';

import { useState } from 'react';
import { DocumentIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/hooks/use-toast';
import { processDocumentOCR } from '@/app/actions/ai';

interface AIDocumentUploadProps {
  orderId: string;
  onUploadComplete: (data: Record<string, unknown>) => void;
}

type ExtractedDocumentData = Record<string, unknown> & { confidence?: number };

export default function AIDocumentUpload({ orderId: _orderId, onUploadComplete }: AIDocumentUploadProps) {
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedDocumentData | null>(null);
  const [selectedType, setSelectedType] = useState<'BOL' | 'COA'>('BOL');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setExtractedData(null);

    try {
      // Convert type to proper document type string
      const documentType = selectedType === 'BOL' ? 'bill_of_lading' : 'certificate_of_analysis';
      
      // Call server action
      const result = await processDocumentOCR({
        file,
        documentType
      });

      if (result.success) {
        const documentData = result as ExtractedDocumentData;
        setExtractedData(documentData);
        onUploadComplete(documentData);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: "Failed to process document",
        variant: "destructive"
      })
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <DocumentIcon className="h-6 w-6 mr-2 text-blue-600" />
        AI Document Processing
      </h3>

      <div className="space-y-4">
        {/* Document Type Selection */}
        <div className="flex space-x-4 mb-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="BOL"
              checked={selectedType === 'BOL'}
              onChange={() => setSelectedType('BOL')}
              className="mr-2"
            />
            <span className="font-medium">Bill of Lading (BOL)</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="COA"
              checked={selectedType === 'COA'}
              onChange={() => setSelectedType('COA')}
              className="mr-2"
            />
            <span className="font-medium">Certificate of Analysis (COA)</span>
          </label>
        </div>

        {/* Upload Area */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
            id="doc-upload"
          />
          <label 
            htmlFor="doc-upload" 
            className="cursor-pointer"
          >
            <CloudArrowUpIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600">
              {isUploading ? 'Processing with AI...' : 'Click to upload document'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              AI will automatically extract key information
            </p>
          </label>
        </div>

        {/* Extracted Data Display */}
        {extractedData && (
          <div className="mt-6 border rounded-lg p-4 bg-gray-50">
            <h4 className="font-semibold mb-3 flex items-center justify-between">
              <span>Extracted Information</span>
              <span className={`text-sm px-2 py-1 rounded ${
                (extractedData.confidence ?? 0) >= 70
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {Math.round(extractedData.confidence ?? 0)}% Confidence
              </span>
            </h4>
            
            <div className="space-y-2 text-sm">
              {extractedData.extractedData && typeof extractedData.extractedData === 'object' && Object.entries(extractedData.extractedData).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-600 capitalize">
                    {key.replace(/_/g, ' ')}:
                  </span>
                  <span className="font-medium">{String(value)}</span>
                </div>
              ))}
            </div>

            {Array.isArray(extractedData.validationErrors) && extractedData.validationErrors.length > 0 && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm font-medium text-yellow-800">Validation Issues:</p>
                <ul className="text-xs text-yellow-700 mt-1">
                  {extractedData.validationErrors.map((error: string, i: number) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {extractedData.requiresManualReview && (
              <p className="mt-3 text-sm text-orange-600 font-medium">
                ⚠️ Manual review recommended due to low confidence
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
