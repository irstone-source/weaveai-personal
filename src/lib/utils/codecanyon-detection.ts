/**
 * Simple CodeCanyon Preview Detection Utility
 *
 * Detects if the app is running inside an iframe (e.g., CodeCanyon preview)
 * and provides navigation helpers to break out of the iframe.
 */

/**
 * Checks if the app is currently running inside an iframe
 * @returns true if in iframe, false otherwise
 */
export function isInIframe(): boolean {
	if (typeof window === 'undefined') return false;

	try {
		return window.self !== window.top;
	} catch {
		// If we get a security error, we're likely in a cross-origin iframe
		return true;
	}
}

/**
 * Navigates to a path, breaking out of iframe if embedded
 * @param path - The path to navigate to (e.g., '/register', '/pricing')
 */
export function breakOutToPath(path: string): void {
	if (typeof window === 'undefined') return;
	if (!isInIframe()) return;

	const targetUrl = `${window.location.origin}${path}`;

	try {
		if (window.top) {
			// Break out of iframe and navigate parent window to our app
			window.top.location.href = targetUrl;
		}
	} catch {
		// If we can't access window.top (cross-origin restriction), open in new tab
		window.open(targetUrl, '_blank');
	}
}
