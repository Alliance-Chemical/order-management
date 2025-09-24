import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Start with 1 second
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp'
];

interface UploadOptions {
  bucket: string;
  key: string;
  body: Buffer | Uint8Array;
  contentType?: string;
  metadata?: Record<string, string>;
  onProgress?: (percentage: number) => void;
}

interface UploadResult {
  success: boolean;
  url?: string;
  s3Url?: string;
  error?: string;
  retries?: number;
}

export class S3UploadError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'S3UploadError';
  }
}

export function validateImageFile(file: File | { size: number; type: string; name?: string }): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(
      `Invalid file type: ${file.type}. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`
    );
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function uploadToS3WithRetry(
  s3Client: any,
  options: UploadOptions
): Promise<UploadResult> {
  let lastError: Error | undefined;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      // Report progress if callback provided
      if (options.onProgress && attempt === 0) {
        options.onProgress(10); // Starting upload
      }

      const uploadCommand = new PutObjectCommand({
        Bucket: options.bucket,
        Key: options.key,
        Body: options.body,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: options.metadata || {},
        // Add cache control for images
        CacheControl: 'max-age=31536000', // 1 year
        // Add content disposition for proper download
        ContentDisposition: `inline; filename="${options.key.split('/').pop()}"`
      });

      await s3Client.send(uploadCommand);

      if (options.onProgress) {
        options.onProgress(70); // Upload complete
      }

      // Generate presigned URL for access
      const getCommand = new GetObjectCommand({
        Bucket: options.bucket,
        Key: options.key
      });

      const presignedUrl = await getSignedUrl(s3Client, getCommand, {
        expiresIn: 3600 * 24 * 7 // 7 days
      });

      if (options.onProgress) {
        options.onProgress(100); // All done
      }

      return {
        success: true,
        url: presignedUrl,
        s3Url: `https://${options.bucket}.s3.amazonaws.com/${options.key}`,
        retries: attempt
      };
    } catch (error) {
      lastError = error as Error;
      attempt++;

      // Don't retry for certain errors
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (
          message.includes('access denied') ||
          message.includes('invalid credentials') ||
          message.includes('signature') ||
          message.includes('forbidden')
        ) {
          break; // Don't retry auth errors
        }
      }

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
        console.warn(`S3 upload attempt ${attempt} failed, retrying in ${delay}ms...`, error);
        await sleep(delay);
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Upload failed after retries',
    retries: attempt
  };
}

export function generateS3Key(
  orderId: string,
  documentType: string,
  fileName: string
): string {
  // Sanitize filename
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const uniqueId = Math.random().toString(36).substring(2, 9);

  return `workspaces/${orderId}/${documentType}/${timestamp}-${uniqueId}-${sanitizedName}`;
}

// These functions are only available in browser environment
// They won't work in Node.js server actions
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('getImageDimensions is only available in browser'));
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export async function compressImage(
  file: File,
  maxWidth: number = 2048,
  maxHeight: number = 2048,
  quality: number = 0.9
): Promise<Blob> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('compressImage is only available in browser'));
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // Calculate new dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        file.type,
        quality
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}