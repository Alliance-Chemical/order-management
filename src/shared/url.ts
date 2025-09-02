/**
 * URL utilities for safe joining and normalization
 * Single responsibility: Handle URL construction safely
 */

export function joinUrl(base: string, path: string): string {
  const normalizedBase = base.replace(/\/+$/, ''); // Remove trailing slashes
  const normalizedPath = path.replace(/^\/+/, ''); // Remove leading slashes
  
  return `${normalizedBase}/${normalizedPath}`;
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    // Return original if can't parse
    return url.trim();
  }
}