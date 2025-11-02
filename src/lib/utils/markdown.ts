import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { browser } from '$app/environment';
import { addCopyButtonsToCodeBlocks } from './code-copy.js';

// Configure marked with basic options
marked.use({
	gfm: true, // GitHub Flavored Markdown
	breaks: true // Convert line breaks to <br>
});

/**
 * Check if text contains raw HTML tags outside of markdown code blocks
 */
function containsRawHTML(text: string): boolean {
	// Handle null/undefined input
	if (!text || typeof text !== 'string') {
		return false;
	}
	
	// Remove code blocks (both ``` and ` styles) to check only non-code content
	const withoutCodeBlocks = text
		.replace(/```[\s\S]*?```/g, '') // Remove fenced code blocks
		.replace(/`[^`\n]*`/g, ''); // Remove inline code
	
	// Check for HTML tags in the remaining content
	const htmlTagRegex = /<\/?[a-zA-Z][a-zA-Z0-9]*\b[^>]*>/;
	return htmlTagRegex.test(withoutCodeBlocks);
}

/**
 * Escape HTML entities in text while preserving markdown code blocks
 */
function escapeRawHTML(text: string): string {
	const codeBlocks: string[] = [];
	let processedText = text;
	
	// Extract and temporarily replace code blocks
	processedText = processedText.replace(/```[\s\S]*?```/g, (match) => {
		codeBlocks.push(match);
		return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
	});
	
	// Extract and temporarily replace inline code
	processedText = processedText.replace(/`[^`\n]*`/g, (match) => {
		codeBlocks.push(match);
		return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
	});
	
	// Escape HTML entities in non-code content
	processedText = processedText
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
	
	// Restore code blocks
	codeBlocks.forEach((block, index) => {
		processedText = processedText.replace(`__CODE_BLOCK_${index}__`, block);
	});
	
	return processedText;
}

/**
 * Parse markdown text and return sanitized HTML string using marked and DOMPurify
 * Automatically escapes raw HTML content while preserving markdown code blocks
 */
export function parseMarkdown(text: string): string {
	// Handle null/undefined input
	if (!text || typeof text !== 'string') {
		return '';
	}
	
	try {
		// Pre-process text to escape raw HTML outside of markdown code blocks
		let processedText = text;
		if (containsRawHTML(text)) {
			processedText = escapeRawHTML(text);
		}
		
		const result = marked.parse(processedText);

		// Handle both sync and async returns from marked
		if (typeof result === 'string') {
			// CRITICAL: Always sanitize the HTML to prevent XSS attacks
			return DOMPurify.sanitize(result);
		} else {
			// If marked returns a Promise, fall back to simple text
			console.warn('Marked returned a Promise, falling back to simple text');
			return DOMPurify.sanitize(text.replace(/\n/g, '<br>'));
		}
	} catch (error) {
		console.error('Markdown parsing error:', error);
		// Return sanitized fallback content on error - handle null/undefined safely
		const fallbackText = text || '';
		return DOMPurify.sanitize(fallbackText.replace(/\n/g, '<br>'));
	}
}

/**
 * Apply syntax highlighting to code blocks in a DOM element
 * This function should be called after content is added to the DOM
 */
export function applySyntaxHighlighting(element?: HTMLElement): void {
	// Only run on client side
	if (!browser) return;

	try {
		// Dynamic import to ensure highlight.js is only loaded on client side
		import('highlight.js').then(({ default: hljs }) => {
			// Configure highlight.js
			hljs.configure({
				ignoreUnescapedHTML: true,
				// Automatically detect languages
				languages: undefined // Use all available languages
			});

			if (element) {
				// Highlight code blocks within the specified element
				const codeBlocks = element.querySelectorAll('pre code:not(.hljs)');
				codeBlocks.forEach((block) => {
					hljs.highlightElement(block as HTMLElement);
				});
				// Add copy buttons after highlighting
				addCopyButtonsToCodeBlocks(element);
			} else {
				// Highlight all code blocks on the page
				hljs.highlightAll();
				// Add copy buttons to all code blocks
				addCopyButtonsToCodeBlocks();
			}
		}).catch((error) => {
			console.warn('Failed to load highlight.js:', error);
		});
	} catch (error) {
		console.warn('Syntax highlighting error:', error);
	}
}