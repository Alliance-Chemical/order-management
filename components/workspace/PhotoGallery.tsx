'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, MagnifyingGlassIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/hooks/use-toast';
import { getWorkspaceDocuments } from '@/app/actions/documents';

interface Photo {
  id: string;
  documentName: string;
  s3Url?: string;
  s3Key?: string;
  lotNumbers?: string[];
  capturedAt?: string;
  uploadedAt?: string;
  documentId?: string;
}

interface PhotoGalleryProps {
  orderId: string;
  moduleState?: any;
}

export default function PhotoGallery({ orderId, moduleState }: PhotoGalleryProps) {
  const { toast } = useToast()
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPhotos();
  }, [orderId, moduleState]);

  const loadPhotos = async () => {
    let hadModulePhotos = false;
    try {
      setLoading(true);
      setError(null);

      const modulePhotos = Array.isArray(moduleState?.preShip?.photos)
        ? moduleState.preShip.photos
        : [];

      const mappedModulePhotos = modulePhotos.map((photo: any) => ({
        id: String(
          photo.id ??
          photo.documentId ??
          (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`)
        ),
        documentName: photo.documentName ?? photo.fileName ?? 'Inspection Photo',
        s3Url: photo.s3Url,
        s3Key: photo.s3Key,
        lotNumbers: photo.lotNumbers,
        capturedAt: photo.capturedAt,
        uploadedAt: photo.uploadedAt,
        documentId: photo.documentId ?? photo.id
      }));

      if (mappedModulePhotos.length > 0) {
        hadModulePhotos = true;
        setPhotos(mappedModulePhotos);
      }

      // Otherwise fetch from documents server action
      const result = await getWorkspaceDocuments(orderId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load photos');
      }
      
      // Filter for pre_ship_photo type
      const preShipPhotos = result.documents?.filter(
        (doc: any) => doc.documentType === 'pre_ship_photo'
      ) || [];
      
      const modulePhotoMap = new Map<string, Photo>();
      mappedModulePhotos.forEach((photo) => {
        if (photo.documentId) {
          modulePhotoMap.set(String(photo.documentId), photo);
        }
        modulePhotoMap.set(photo.id, photo);
      });

      const mergedPhotos: Photo[] = preShipPhotos.map((doc: any) => {
        const docId = String(doc.id);
        const modulePhoto = modulePhotoMap.get(docId);

        return {
          id: docId,
          documentName: doc.fileName ?? doc.documentName ?? modulePhoto?.documentName ?? 'Inspection Photo',
          s3Url: doc.documentUrl,
          s3Key: doc.s3Key,
          lotNumbers: modulePhoto?.lotNumbers || doc.metadata?.lotNumbers || doc.lotNumbers,
          capturedAt: modulePhoto?.capturedAt || doc.metadata?.capturedAt || doc.capturedAt,
          uploadedAt: doc.createdAt || modulePhoto?.uploadedAt,
          documentId: docId
        };
      });

      // Include any module photos that don't have a matching document record yet.
      const unmatchedModulePhotos = mappedModulePhotos.filter((photo) => {
        const docId = photo.documentId ? String(photo.documentId) : photo.id;
        return !mergedPhotos.some((merged) => merged.documentId === docId);
      });

      setPhotos([...mergedPhotos, ...unmatchedModulePhotos]);
    } catch (err: any) {
      console.error('Error loading photos:', err);
      if (!hadModulePhotos) {
        setError(err.message || 'Failed to load photos');
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadPhoto = async (photo: Photo) => {
    try {
      const response = await fetch(photo.s3Url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${photo.documentName}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading photo:', err);
      toast({
        title: "Error",
        description: "Failed to download photo",
        variant: "destructive"
      })
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Inspection Photos</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading photos...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Inspection Photos</h3>
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={loadPhotos}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Inspection Photos</h3>
          <span className="text-sm text-gray-500">{photos.length} photo(s)</span>
        </div>

        {photos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-4">📸</div>
            <p>No photos captured during inspection</p>
          </div>
        ) : (
          <>
            {/* Photo grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group cursor-pointer">
                  <div 
                    className="aspect-square bg-gray-100 rounded-lg overflow-hidden border hover:shadow-md transition-shadow"
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    <img 
                      src={photo.s3Url} 
                      alt={photo.documentName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Overlay with lot count */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-25 transition-opacity flex items-center justify-center">
                      <MagnifyingGlassIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {(photo.lotNumbers && photo.lotNumbers.length > 0) && (
                      <div className="absolute bottom-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                        {photo.lotNumbers.length} lot{photo.lotNumbers.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 truncate">
                    {new Date(photo.capturedAt || photo.uploadedAt || '').toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {/* All lot numbers summary */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-2">Extracted Lot Numbers</h4>
              <div className="flex flex-wrap gap-2">
                {photos.flatMap(p => p.lotNumbers || []).length > 0 ? (
                  photos.flatMap(p => p.lotNumbers || []).map((lot, index) => (
                    <span 
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-mono"
                    >
                      {lot}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500 text-sm">No lot numbers extracted</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Photo lightbox modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full">
            {/* Close button */}
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-opacity"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>

            {/* Download button */}
            <button
              onClick={() => downloadPhoto(selectedPhoto)}
              className="absolute top-4 left-4 z-10 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 transition-opacity"
            >
              <ArrowDownTrayIcon className="w-6 h-6" />
            </button>

            {/* Image */}
            <img 
              src={selectedPhoto.s3Url} 
              alt={selectedPhoto.documentName}
              className="max-w-full max-h-full object-contain rounded-lg"
            />

            {/* Photo info */}
            <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-75 text-white p-4 rounded-lg">
              <h4 className="font-semibold mb-2">{selectedPhoto.documentName}</h4>
              <p className="text-sm opacity-75 mb-2">
                Captured: {new Date(selectedPhoto.capturedAt || selectedPhoto.uploadedAt || '').toLocaleString()}
              </p>
              {(selectedPhoto.lotNumbers && selectedPhoto.lotNumbers.length > 0) && (
                <div>
                  <p className="text-sm font-medium mb-1">Lot Numbers:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedPhoto.lotNumbers.map((lot, index) => (
                      <span 
                        key={index}
                        className="px-2 py-1 bg-white bg-opacity-20 text-xs rounded font-mono"
                      >
                        {lot}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
