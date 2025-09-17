'use client';

import { useState } from 'react';
import { DocumentIcon, ArrowUpTrayIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
import { uploadDocument } from '@/app/actions/documents';
import type { OrderWorkspace } from '@/lib/types/workspace';

interface DocumentsHubProps {
  orderId: string;
  workspace: OrderWorkspace;
}

interface UploadedDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  uploadedAt: string;
}

export default function DocumentsHub({ orderId, workspace }: DocumentsHubProps) {
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);

  const handleFileUpload = async (file: File, documentType: string) => {
    setUploading(true);

    try {
      const result = await uploadDocument({
        file,
        orderId,
        documentType,
        metadata: {
          orderNumber: workspace.orderNumber,
          uploadedAt: new Date().toISOString(),
        },
      });

      if (result.success && result.document) {
        setDocuments((prev) => [
          ...prev,
          {
            id: result.document.id,
            name: result.document.fileName ?? result.document.documentName,
            type: result.document.documentType,
            url: result.document.url,
            size: result.document.fileSize ?? file.size,
            uploadedAt: new Date().toISOString(),
          },
        ]);
      } else {
        console.error('Upload failed:', result.error);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const documentTypes: Array<{ id: string; label: string; icon: typeof DocumentIcon }> = [
    { id: 'coa', label: 'Certificate of Analysis (COA)', icon: DocumentIcon },
    { id: 'sds', label: 'Safety Data Sheet (SDS)', icon: DocumentIcon },
    { id: 'bol', label: 'Bill of Lading (BOL)', icon: DocumentIcon },
    { id: 'other', label: 'Other Documents', icon: DocumentIcon },
  ];

  const totalSize = workspace.totalDocumentSize ?? 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documentTypes.map((type) => (
            <div
              key={type.id}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-gray-400 transition-colors"
            >
              <label className="cursor-pointer block">
                <input
                  type="file"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleFileUpload(file, type.id);
                  }}
                  disabled={uploading}
                />
                <div className="flex flex-col items-center">
                  <ArrowUpTrayIcon className="w-6 h-6 text-gray-400" />
                  <span className="mt-2 text-sm font-medium text-gray-900">{type.label}</span>
                  <span className="mt-1 text-xs text-gray-500">Click to upload</span>
                </div>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Uploaded Documents</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {documents.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <DocumentIcon className="mx-auto w-8 h-8 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">No documents uploaded yet</p>
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <DocumentIcon className="w-8 h-8 text-gray-400 mr-3 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                      <p className="text-xs text-gray-500">
                        {doc.type.toUpperCase()} • {(doc.size / 1024).toFixed(1)} KB •
                        {` ${new Date(doc.uploadedAt).toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <EyeIcon className="w-5 h-5" />
                    </a>
                    <button className="p-2 text-red-400 hover:text-red-600" aria-label="Delete document">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <DocumentIcon className="w-5 h-5 text-blue-600 mr-2 shrink-0" />
          <p className="text-sm text-blue-900">
            Storage: {(totalSize / 1024 / 1024).toFixed(2)} MB used
          </p>
        </div>
      </div>
    </div>
  );
}
