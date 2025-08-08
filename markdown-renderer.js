/**
 * Enhanced Markdown Rendering Service
 * Uses marked + DOMPurify for secure rendering with Showdown as fallback
 */
class MarkdownRenderer {
    constructor() {
        // Check if required libraries are available
        this.hasMarked = typeof marked !== 'undefined';
        this.hasDOMPurify = typeof DOMPurify !== 'undefined';
        this.hasShowdown = typeof showdown !== 'undefined';
        
        console.log('Markdown Renderer initialized:', {
            marked: this.hasMarked,
            DOMPurify: this.hasDOMPurify,
            showdown: this.hasShowdown
        });
        
        this.initializeRenderer();
    }
    
    /**
     * Initialize the appropriate markdown renderer
     */
    initializeRenderer() {
        if (this.hasMarked && this.hasDOMPurify) {
            // Configure marked with security-focused options
            marked.setOptions({
                gfm: true,              // Enable GitHub Flavored Markdown
                breaks: false,           // Convert line breaks to <br>
                headerIds: false,       // Disable header IDs for security
                mangle: false,          // Don't mangle email addresses
                sanitize: false,        // We'll use DOMPurify for sanitization
                smartLists: true,       // Use smarter list behavior
                smartypants: false,     // Disable smart quotes for security
                xhtml: false           // Output HTML instead of XHTML
            });
            
            console.log('Using marked + DOMPurify for rendering');
        } else if (this.hasShowdown) {
            // Fallback to Showdown with secure configuration
            this.showdownConverter = new showdown.Converter({
                ghCodeBlocks: true,
                tables: true,
                breaks: true,
                simpleLineBreaks: true,
                smoothLivePreview: true,
                strikethrough: true,
                tasklists: true,
                openLinksInNewWindow: true,
                backslashEscapesHTMLTags: true
            });
            console.log('Using Showdown as fallback renderer');
        } else {
            console.error('No markdown renderer available!');
        }
    }
    
    /**
     * Main function to render markdown string to safe HTML
     * @param {string} markdownString - Raw markdown string from API
     * @param {HTMLElement} responseContainer - Target container element
     */
    renderMarkdown(markdownString, responseContainer) {
        try {
            console.log('Rendering markdown:', markdownString);
            
            // Validate inputs
            if (!markdownString || typeof markdownString !== 'string') {
                console.warn('Invalid markdown input');
                responseContainer.innerHTML = '<p>No content to display</p>';
                return;
            }
            
            if (!responseContainer) {
                console.error('Invalid response container: element is null or undefined');
                return;
            }
            
            if (!responseContainer.tagName) {
                console.error('Invalid response container: not a DOM element', responseContainer);
                return;
            }
            
            // Preprocess the markdown for better formatting
            const processedMarkdown = this.preprocessMarkdown(markdownString);
            
            let htmlString;
            
            // Primary renderer: marked + DOMPurify
            if (this.hasMarked && this.hasDOMPurify) {
                htmlString = this.renderWithMarked(processedMarkdown);
            }
            // Fallback renderer: Showdown
            else if (this.hasShowdown) {
                htmlString = this.renderWithShowdown(processedMarkdown);
            }
            // Last resort: plain text with basic formatting
            else {
                htmlString = this.renderPlainText(processedMarkdown);
            }
            
            // Set the sanitized HTML to the container
            responseContainer.innerHTML = htmlString;
            
            console.log('Markdown rendered successfully');
            
        } catch (error) {
            console.error('Error rendering markdown:', error);
            responseContainer.innerHTML = '<p class="error">Error rendering content</p>';
        }
    }
    
    /**
     * Render using marked library with DOMPurify sanitization
     * @param {string} markdown - Preprocessed markdown string
     * @returns {string} - Sanitized HTML string
     */
    renderWithMarked(markdown) {
        // Step 1: Convert markdown to HTML using marked
        const rawHTML = marked.parse(markdown);
        console.log('Raw HTML from marked:', rawHTML);
        
        // Step 2: Sanitize the HTML using DOMPurify to prevent XSS attacks
        const sanitizedHTML = DOMPurify.sanitize(rawHTML, {
            ALLOWED_TAGS: [
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'p', 'br', 'strong', 'em', 'u', 'del',
                'ul', 'ol', 'li', 'blockquote',
                'code', 'pre', 'a', 'img'
            ],
            ALLOWED_ATTR: ['href', 'title', 'alt', 'src'],
            ALLOW_DATA_ATTR: false,
            FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input'],
            FORBID_ATTR: ['onclick', 'onload', 'onerror', 'style']
        });
        
        console.log('Sanitized HTML:', sanitizedHTML);
        return sanitizedHTML;
    }
    
    /**
     * Fallback rendering using Showdown
     * @param {string} markdown - Preprocessed markdown string  
     * @returns {string} - HTML string
     */
    renderWithShowdown(markdown) {
        const html = this.showdownConverter.makeHtml(markdown);
        console.log('HTML from Showdown:', html);
        
        // Basic sanitization for Showdown output
        return this.basicSanitize(html);
    }
    
    /**
     * Last resort: plain text with basic HTML formatting
     * @param {string} markdown - Preprocessed markdown string
     * @returns {string} - Basic HTML string
     */
    renderPlainText(markdown) {
        return markdown
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^\- (.*$)/gm, '<li>$1</li>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }
    
    /**
     * Preprocess markdown to ensure proper formatting
     * @param {string} content - Raw markdown content
     * @returns {string} - Cleaned markdown content
     */
    preprocessMarkdown(content) {
        let processed = content.trim();
        
        // Ensure headers have proper spacing
        processed = processed.replace(/^(#{1,6})\s*(.+)$/gm, '$1 $2\n');
        
        // Ensure bullet points start on new lines
        processed = processed.replace(/([^\n])\s*(-\s*)/g, '$1\n\n$2');
        
        // Fix inline bullet points
        processed = processed.replace(/(-\s*[^-\n]+)\s+(-\s*)/g, '$1\n$2');
        
        // Ensure proper line breaks after headers
        processed = processed.replace(/^(#{1,6}\s*.+)(?!\n\n)/gm, '$1\n');
        
        // Clean up excessive whitespace but preserve intentional breaks
        processed = processed.replace(/\n{4,}/g, '\n\n\n');
        
        return processed;
    }
    
    /**
     * Basic HTML sanitization for fallback scenarios
     * @param {string} html - HTML string to sanitize
     * @returns {string} - Sanitized HTML string
     */
    basicSanitize(html) {
        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/javascript:/gi, '');
    }
} 