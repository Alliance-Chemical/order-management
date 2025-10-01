/**
 * Timeout utility for wrapping async operations
 * Returns null on timeout instead of throwing errors
 */

export interface TimeoutOptions {
  timeoutMs?: number;
  onTimeout?: () => void;
  errorMessage?: string;
}

/**
 * Wrap an async operation with a timeout
 * Returns null if the operation times out
 *
 * @example
 * const result = await withTimeout(
 *   () => fetchData(),
 *   { timeoutMs: 3000, errorMessage: 'Fetch timed out' }
 * );
 * if (result === null) {
 *   // Handle timeout
 * }
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  options: TimeoutOptions = {}
): Promise<T | null> {
  const {
    timeoutMs = 3000,
    onTimeout,
    errorMessage = 'Operation timed out'
  } = options;

  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => {
      if (onTimeout) {
        onTimeout();
      }
      console.warn(errorMessage);
      resolve(null);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      fn(),
      timeoutPromise
    ]);
    return result;
  } catch (error) {
    console.error('Error in withTimeout:', error);
    return null;
  }
}

/**
 * Retry an operation with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T | null> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    onRetry
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      if (attempt < maxRetries - 1) {
        const delay = Math.min(
          initialDelayMs * Math.pow(2, attempt),
          maxDelayMs
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('withRetry exhausted all attempts:', lastError);
  return null;
}
