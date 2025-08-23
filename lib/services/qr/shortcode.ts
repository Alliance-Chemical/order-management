const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford (no I L O U)

export function makeShortCode(seed: string, size = 7): string {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let n = BigInt(h >>> 0);
  let out = '';
  while (out.length < size) {
    const idx = Number(n % BigInt(ALPHABET.length));
    out = ALPHABET[idx] + out;
    n /= BigInt(ALPHABET.length);
  }
  return out;
}