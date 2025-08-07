// AI Service for text improvement using Hugging Face Flan-T5-Large
class AIService {
    constructor() {
        // We'll use Netlify Functions to keep the API key secure
        this.apiEndpoint = '/.netlify/functions/improve-text';
        this.isProcessing = false;
        this.useLocalOnly = false; // Use Gemini AI by default
    }

    async improveText(text) {
        if (this.isProcessing || !text.trim()) {
            return null;
        }

        // If local-only mode is enabled, throw error to trigger fallback
        if (this.useLocalOnly) {
            throw new Error('Using local AI for better reliability and zero cost');
        }

        this.isProcessing = true;

        try {
            // Clean and prepare the text
            const cleanText = text.trim();
            
            // Create a prompt for Flan-T5 to improve the text
            const prompt = `Please improve the following text to make it more concise, organized, and better for note-taking. Keep the same meaning but make it clearer and more structured:

${cleanText}

Improved version:`;

            console.log('Making request to:', this.apiEndpoint);
            console.log('Request payload:', { 
                text: prompt.substring(0, 200) + '...', 
                max_length: Math.min(512, cleanText.length * 2) 
            });

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: prompt,
                    max_length: Math.min(512, cleanText.length * 2),
                    temperature: 0.3,
                })
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', errorText);
                
                // Handle specific error cases
                if (response.status === 404) {
                    throw new Error('Netlify function not found. Function may not be deployed or path incorrect.');
                } else if (response.status === 500) {
                    throw new Error('Server error. Check Hugging Face token in Netlify environment variables.');
                } else if (response.status === 503) {
                    throw new Error('AI model is loading. Please wait 30 seconds and try again.');
                } else if (response.status === 400) {
                    throw new Error('Bad request. Check if text is valid.');
                } else {
                    throw new Error(`API request failed: ${response.status} - ${errorText}`);
                }
            }

            const result = await response.json();
            console.log('API Response:', result);
            
            // Extract the improved text (remove the prompt part)
            let improvedText = result.generated_text || result.text || '';
            
            if (!improvedText) {
                console.error('No generated text in response:', result);
                throw new Error('AI service returned empty response');
            }
            
            // Clean up the GPT-2 response
            improvedText = this.cleanGPT2Response(improvedText, text);
            
            console.log('Cleaned improved text:', improvedText.substring(0, 200) + '...');
            
            return improvedText;

        } catch (error) {
            console.error('AI text improvement failed:', error);
            
            // Re-throw with more context
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Failed to connect to AI service. Check internet connection.');
            } else {
                throw error;
            }
        } finally {
            this.isProcessing = false;
        }
    }

    cleanGPT2Response(generatedText, originalText) {
        let cleaned = generatedText;
        
        // Remove the original prompt
        const improvedMarker = 'Improved:';
        const improvedIndex = cleaned.indexOf(improvedMarker);
        if (improvedIndex !== -1) {
            cleaned = cleaned.substring(improvedIndex + improvedMarker.length);
        }
        
        // Remove the original text if it appears
        if (cleaned.includes(originalText)) {
            cleaned = cleaned.replace(originalText, '');
        }
        
        // Remove common prompt artifacts
        cleaned = cleaned.replace(/Original:/g, '');
        cleaned = cleaned.replace(/Improve this text for better note-taking:/g, '');
        
        // Clean up line breaks and extra whitespace
        cleaned = cleaned.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join(' ');
        
        // Remove any remaining artifacts
        cleaned = cleaned.replace(/^[\s\n\r]+/, '').replace(/[\s\n\r]+$/, '');
        
        return cleaned || originalText; // Fallback to original if cleaning fails
    }

    isAvailable() {
        return !this.isProcessing;
    }

    // Test function to check if the service is working
    async testConnection() {
        try {
            console.log('Testing connection to:', this.apiEndpoint);
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: 'test' })
            });
            
            console.log('Test response status:', response.status);
            console.log('Test response headers:', Object.fromEntries(response.headers.entries()));
            
            if (response.ok) {
                const data = await response.json();
                console.log('Test response data:', data);
                return { success: true, status: response.status, data: data };
            } else {
                const errorText = await response.text();
                console.log('Test error response:', errorText);
                return { success: false, status: response.status, error: errorText };
            }
        } catch (error) {
            console.log('Test connection error:', error);
            return { success: false, error: error.message };
        }
    }
}

// Export for use in main app
window.AIService = AIService; 