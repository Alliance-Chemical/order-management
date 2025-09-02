/**
 * Database client exports
 */
import { getDb } from '../../src/data/db/client';

// Export db as a direct instance for backward compatibility
export const db = getDb();

// Also export the function for those who need it
export { getDb } from '../../src/data/db/client';
export type { Database } from '../../src/data/db/client';