/**
 * Pure format detection and validation
 * Single responsibility: Identify input format types
 */

export type QRFormat = 'short' | 'url' | 'payload' | null;

export function detectFormat(input: string): QRFormat {
  const trimmed = input.trim();
  
  if (!trimmed) return null;
  
  // Short codes: 6-8 alphanumeric characters
  if (/^[A-Z0-9]{6,8}$/i.test(trimmed)) {
    return 'short';
  }
  
  // URLs with QR parameters
  try {
    const url = new URL(trimmed);
    if (url.searchParams.has('qr') || url.pathname.includes('/qr/')) {
      return 'url';
    }
  } catch {
    // Not a valid URL, continue checking
  }
  
  // Base64/base64url encoded payload (longer than 20 chars)
  if (/^[A-Za-z0-9+/_-]+=*$/.test(trimmed) && trimmed.length > 20) {
    return 'payload';
  }
  
  return null;
}