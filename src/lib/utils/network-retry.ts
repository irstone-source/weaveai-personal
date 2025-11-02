/**
 * Network Retry Utility
 *
 * Provides retry logic for network requests with exponential backoff.
 * Addresses P1 QA requirement for network error recovery.
 */

export interface RetryOptions {
	maxRetries?: number;
	initialDelay?: number;
	maxDelay?: number;
	backoffMultiplier?: number;
	shouldRetry?: (error: Error) => boolean;
	onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
	maxRetries: 3,
	initialDelay: 1000, // 1 second
	maxDelay: 10000, // 10 seconds
	backoffMultiplier: 2,
	shouldRetry: (error: Error) => {
		// Retry on network errors, timeouts, and 5xx server errors
		if (error instanceof TypeError && error.message.includes('fetch')) {
			return true; // Network error
		}
		if (error.message.includes('timeout')) {
			return true;
		}
		// For Response errors, check status code
		if ('status' in error && typeof (error as any).status === 'number') {
			const status = (error as any).status;
			return status >= 500 && status < 600; // Retry 5xx errors
		}
		return false;
	},
	onRetry: () => {}
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
	const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);
	const cappedDelay = Math.min(exponentialDelay, options.maxDelay);
	// Add jitter (±20%) to prevent thundering herd
	const jitter = cappedDelay * 0.2 * (Math.random() - 0.5);
	return Math.floor(cappedDelay + jitter);
}

/**
 * Retry a function with exponential backoff
 *
 * @example
 * ```typescript
 * const data = await retryWithBackoff(
 *   async () => {
 *     const response = await fetch('/api/data');
 *     if (!response.ok) throw new Error(`HTTP ${response.status}`);
 *     return response.json();
 *   },
 *   {
 *     maxRetries: 3,
 *     onRetry: (attempt, error) => {
 *       console.log(`Retry attempt ${attempt}: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {}
): Promise<T> {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	let lastError: Error;

	for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error as Error;

			// Check if we should retry
			if (attempt > opts.maxRetries || !opts.shouldRetry(lastError)) {
				throw lastError;
			}

			// Calculate delay and wait
			const delay = calculateDelay(attempt, opts);
			opts.onRetry(attempt, lastError);

			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}

	throw lastError!;
}

/**
 * Fetch with automatic retry on network errors
 *
 * @example
 * ```typescript
 * const response = await fetchWithRetry('/api/chat', {
 *   method: 'POST',
 *   body: JSON.stringify({ message: 'Hello' }),
 *   headers: { 'Content-Type': 'application/json' }
 * });
 * const data = await response.json();
 * ```
 */
export async function fetchWithRetry(
	input: RequestInfo | URL,
	init?: RequestInit,
	retryOptions?: RetryOptions
): Promise<Response> {
	return retryWithBackoff(
		async () => {
			const response = await fetch(input, init);

			// Throw error for 5xx responses (will trigger retry)
			if (response.status >= 500 && response.status < 600) {
				const error: any = new Error(`Server error: ${response.status}`);
				error.status = response.status;
				error.response = response;
				throw error;
			}

			return response;
		},
		{
			...retryOptions,
			shouldRetry: (error: Error) => {
				// Network errors
				if (error instanceof TypeError) {
					return true;
				}
				// Timeout errors
				if (error.message.includes('timeout')) {
					return true;
				}
				// 5xx server errors
				if ('status' in error && typeof (error as any).status === 'number') {
					const status = (error as any).status;
					return status >= 500 && status < 600;
				}
				// Custom retry logic
				if (retryOptions?.shouldRetry) {
					return retryOptions.shouldRetry(error);
				}
				return false;
			}
		}
	);
}
