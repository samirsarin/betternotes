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

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: prompt,
                    max_length: Math.min(512, cleanText.length * 2), // Adaptive length
                    temperature: 0.3, // Lower temperature for more focused output
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const result = await response.json();
            
            // Extract the improved text (remove the prompt part)
            let improvedText = result.generated_text || result.text || '';
            
            // Clean up the response
            improvedText = this.cleanImprovedText(improvedText, prompt);
            
            return improvedText;

        } catch (error) {
            console.error('AI text improvement failed:', error);
            throw error;
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
                   !lower.includes('make it clearer');
        });
        
        return relevantLines.join('\n').trim();
    }

    isAvailable() {
        return !this.isProcessing;
    }
}

// Export for use in main app
window.AIService = AIService; 