// AI Service for text improvement using Hugging Face Flan-T5-Large
class AIService {
    constructor() {
        // We'll use Netlify Functions to keep the API key secure
        this.apiEndpoint = '/.netlify/functions/improve-text';
        this.isProcessing = false;
    }

    async improveText(text) {
        if (this.isProcessing || !text.trim()) {
            return null;
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
            
            // Clean up the response
            improvedText = this.cleanImprovedText(improvedText, prompt);
            
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

    cleanImprovedText(generatedText, originalPrompt) {
        // Remove the original prompt from the response
        let cleaned = generatedText;
        
        // Try to extract just the improved version
        const improvedIndex = cleaned.toLowerCase().indexOf('improved version:');
        if (improvedIndex !== -1) {
            cleaned = cleaned.substring(improvedIndex + 'improved version:'.length);
        }
        
        // Remove any remaining prompt text
        const lines = cleaned.split('\n');
        const relevantLines = lines.filter(line => {
            const lower = line.toLowerCase().trim();
            return lower && 
                   !lower.includes('please improve') &&
                   !lower.includes('following text') &&
                   !lower.includes('make it clearer') &&
                   !lower.includes('more concise') &&
                   !lower.includes('note-taking');
        });
        
        return relevantLines.join('\n').trim();
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