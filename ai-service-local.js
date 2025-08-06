// Local AI Service - No external APIs, completely free!
class LocalAIService {
    constructor() {
        this.isProcessing = false;
    }

    async improveText(text) {
        if (this.isProcessing || !text.trim()) {
            return null;
        }

        this.isProcessing = true;

        try {
            // Simulate processing time for better UX
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const improvedText = this.improveTextLocally(text.trim());
            return improvedText;

        } catch (error) {
            console.error('Local AI improvement failed:', error);
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    improveTextLocally(text) {
        let improved = text;
        
        // Split into sentences for better processing
        const sentences = improved.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        const improvedSentences = sentences.map(sentence => {
            let s = sentence.trim();
            
            // Remove filler words and redundancy
            s = s.replace(/\b(like|you know|um|uh|basically|actually|literally|totally|really|very|quite|pretty|just|only|maybe|perhaps|probably|definitely|absolutely|completely|entirely|extremely|incredibly|amazing|awesome|super|mega|ultra)\b/gi, '');
            
            // Remove redundant phrases
            s = s.replace(/\b(I think that|I believe that|in my opinion|it seems like|it appears that|I feel like|the fact that|the thing is)\b/gi, '');
            
            // Simplify wordy phrases
            const replacements = {
                'in order to': 'to',
                'due to the fact that': 'because',
                'at this point in time': 'now',
                'in the event that': 'if',
                'for the reason that': 'because',
                'until such time as': 'until',
                'with regard to': 'about',
                'in relation to': 'about',
                'at the present time': 'now',
                'in spite of the fact that': 'although',
                'on the basis of': 'based on',
                'for the purpose of': 'to',
                'in the process of': 'while',
                'a large number of': 'many',
                'a great deal of': 'much',
                'prior to': 'before',
                'subsequent to': 'after',
                'in the vicinity of': 'near'
            };
            
            for (const [wordy, simple] of Object.entries(replacements)) {
                s = s.replace(new RegExp(`\\b${wordy}\\b`, 'gi'), simple);
            }
            
            // Clean up multiple spaces and punctuation
            s = s.replace(/\s+/g, ' ');
            s = s.replace(/,\s*,/g, ',');
            
            return s.trim();
        }).filter(s => s.length > 0);
        
        // Rejoin sentences
        improved = improvedSentences.join('. ');
        
        // Add period if missing
        if (improved && !improved.match(/[.!?]$/)) {
            improved += '.';
        }
        
        // Create bullet points for natural lists
        if (this.shouldConvertToBullets(improved)) {
            improved = this.convertToBulletPoints(improved);
        }
        
        // Capitalize first letter
        if (improved) {
            improved = improved.charAt(0).toUpperCase() + improved.slice(1);
        }
        
        return improved || text; // Fallback to original if processing fails
    }

    shouldConvertToBullets(text) {
        // Convert to bullets if text contains multiple "and" connections
        const andCount = (text.match(/\band\b/gi) || []).length;
        const commaCount = (text.match(/,/g) || []).length;
        
        return (andCount >= 2 || commaCount >= 3) && text.length > 50;
    }

    convertToBulletPoints(text) {
        // Split on common list separators
        let parts = [];
        
        if (text.includes(' and ')) {
            parts = text.split(/\sand\s/);
        } else if (text.includes(', ')) {
            parts = text.split(/,\s*/);
        } else {
            return text; // Don't convert if no clear list structure
        }
        
        if (parts.length <= 1 || parts.length > 8) {
            return text; // Don't convert very short or very long lists
        }
        
        // Clean up parts and create bullets
        const bullets = parts.map((part, index) => {
            let bullet = part.trim();
            
            // Remove trailing punctuation except for the last item
            if (index < parts.length - 1) {
                bullet = bullet.replace(/[.!?]+$/, '');
            }
            
            // Ensure proper capitalization
            bullet = bullet.charAt(0).toUpperCase() + bullet.slice(1);
            
            return `• ${bullet}`;
        });
        
        return bullets.join('\n');
    }

    isAvailable() {
        return !this.isProcessing;
    }

    async testConnection() {
        return { 
            success: true, 
            status: 200, 
            data: { message: 'Local AI service working perfectly!' }
        };
    }
}

// Export for use in main app
window.LocalAIService = LocalAIService; 