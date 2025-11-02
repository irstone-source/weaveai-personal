import { browser } from '$app/environment';

/**
 * Create SVG base element with common attributes
 */
function createSvgBase(): SVGElement {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('width', '12');
	svg.setAttribute('height', '12');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '2');
	svg.setAttribute('stroke-linecap', 'round');
	svg.setAttribute('stroke-linejoin', 'round');
	return svg;
}

/**
 * Create copy icon SVG
 */
function createCopyIcon(): SVGElement {
	const svg = createSvgBase();
	
	const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
	rect.setAttribute('width', '14');
	rect.setAttribute('height', '14');
	rect.setAttribute('x', '8');
	rect.setAttribute('y', '8');
	rect.setAttribute('rx', '2');
	rect.setAttribute('ry', '2');
	
	const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	path.setAttribute('d', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2');
	
	svg.appendChild(rect);
	svg.appendChild(path);
	return svg;
}

/**
 * Create check icon SVG
 */
function createCheckIcon(): SVGElement {
	const svg = createSvgBase();
	
	const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
	polyline.setAttribute('points', '20,6 9,17 4,12');
	
	svg.appendChild(polyline);
	return svg;
}

/**
 * Create X icon SVG
 */
function createXIcon(): SVGElement {
	const svg = createSvgBase();
	
	const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
	circle.setAttribute('cx', '12');
	circle.setAttribute('cy', '12');
	circle.setAttribute('r', '10');
	
	const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
	line1.setAttribute('x1', '15');
	line1.setAttribute('y1', '9');
	line1.setAttribute('x2', '9');
	line1.setAttribute('y2', '15');
	
	const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
	line2.setAttribute('x1', '9');
	line2.setAttribute('y1', '9');
	line2.setAttribute('x2', '15');
	line2.setAttribute('y2', '15');
	
	svg.appendChild(circle);
	svg.appendChild(line1);
	svg.appendChild(line2);
	return svg;
}

/**
 * Replace button icon safely
 */
function replaceButtonIcon(button: HTMLElement, newIcon: SVGElement): void {
	const currentIcon = button.firstElementChild;
	if (currentIcon) {
		button.removeChild(currentIcon);
	}
	button.appendChild(newIcon);
}

/**
 * Copy code content to clipboard
 */
async function copyCodeToClipboard(codeElement: HTMLElement, button: HTMLElement): Promise<void> {
	try {
		// Get the text content of the code block
		const codeText = codeElement.textContent || '';
		
		if (!codeText.trim()) {
			throw new Error('No code content to copy');
		}
		
		// Use the Clipboard API
		await navigator.clipboard.writeText(codeText);
		
		// Show success feedback
		replaceButtonIcon(button, createCheckIcon());
		button.title = 'Copied!';
		
		// Clear any existing timeout
		const existingTimeout = button.dataset.timeoutId;
		if (existingTimeout) {
			clearTimeout(Number(existingTimeout));
		}
		
		// Reset after 2 seconds
		const timeoutId = setTimeout(() => {
			replaceButtonIcon(button, createCopyIcon());
			button.title = 'Copy code';
			delete button.dataset.timeoutId;
		}, 2000);
		
		button.dataset.timeoutId = String(timeoutId);
		
	} catch (error) {
		console.warn('Failed to copy code:', error);
		
		// Show error feedback
		replaceButtonIcon(button, createXIcon());
		button.title = 'Copy failed';
		
		// Clear any existing timeout
		const existingTimeout = button.dataset.timeoutId;
		if (existingTimeout) {
			clearTimeout(Number(existingTimeout));
		}
		
		// Reset after 2 seconds
		const timeoutId = setTimeout(() => {
			replaceButtonIcon(button, createCopyIcon());
			button.title = 'Copy code';
			delete button.dataset.timeoutId;
		}, 2000);
		
		button.dataset.timeoutId = String(timeoutId);
	}
}

/**
 * Add a copy button to a code block
 */
export function addCopyButtonToCodeBlock(codeElement: HTMLElement): void {
	const preElement = codeElement.parentElement;
	if (!preElement || preElement.tagName !== 'PRE') return;
	
	// Check if copy button already exists
	if (preElement.querySelector('.code-copy-button')) return;
	
	// Create copy button
	const copyButton = document.createElement('button');
	copyButton.className = 'code-copy-button';
	copyButton.title = 'Copy code';
	copyButton.appendChild(createCopyIcon());
	
	// Add click handler
	copyButton.addEventListener('click', () => copyCodeToClipboard(codeElement, copyButton));
	
	// Add button to pre element
	preElement.appendChild(copyButton);
}

/**
 * Add copy buttons to all code blocks in a container
 */
export function addCopyButtonsToCodeBlocks(container?: HTMLElement): void {
	if (!browser) return;
	
	const codeBlocks = container 
		? container.querySelectorAll('pre code.hljs')
		: document.querySelectorAll('pre code.hljs');
		
	codeBlocks.forEach((block) => {
		addCopyButtonToCodeBlock(block as HTMLElement);
	});
}