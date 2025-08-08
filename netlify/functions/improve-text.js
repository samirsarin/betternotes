// Netlify Function to improve text using Google Gemini 2.0 Flash
// This keeps your Google AI Studio API key secure on the server side

exports.handler = async (event, context) => {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { text, max_length = 512, temperature = 0.3 } = JSON.parse(event.body);

        if (!text || text.trim() === '') {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Text is required' })
            };
        }

        // Handle test requests
        if (text === 'test') {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Gemini function is working',
                    generated_text: 'Gemini test successful!'
                })
            };
        }

        // Get Google AI Studio API key from environment variables
        const GOOGLE_API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY;
        
        if (!GOOGLE_API_KEY) {
            console.error('Google AI Studio API key not found in environment variables');
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: 'AI service configuration error',
                    details: 'GOOGLE_AI_STUDIO_API_KEY environment variable not set'
                })
            };
        }

        // Create the prompt for Gemini
        const prompt = `Improve this student note by making it clearer, fixing errors, adding any relevant information and organizing it better.

CRITICAL: Your response must have proper line breaks and spacing. Use this EXACT format:

Title

Subtitle
    • First bullet point
    • Second bullet point

Another Subtitle  
    • More bullet points
    • With proper spacing

RULES:
1. Put TWO line breaks after titles
2. Put TWO line breaks between sections
3. Use 4 spaces before bullet points
4. Put ONE line break after each bullet point
5. Use • symbol for bullets

Original text: "${text}"

Your improved version (follow the format exactly):`;

        console.log('Making request to Gemini API...');

        // Call Google Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: temperature,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: Math.min(max_length, 1000),
                        stopSequences: []
                    },
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_HATE_SPEECH", 
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        }
                    ]
                })
            }
        );

        console.log('Gemini API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            
            // Handle specific error cases
            if (response.status === 400) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ 
                        error: 'Invalid request to Gemini API',
                        details: errorText
                    })
                };
            } else if (response.status === 403) {
                return {
                    statusCode: 403,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ 
                        error: 'API key invalid or quota exceeded',
                        details: 'Check your Google AI Studio API key'
                    })
                };
            } else if (response.status === 429) {
                return {
                    statusCode: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ 
                        error: 'Rate limit exceeded',
                        details: 'Please wait a moment and try again'
                    })
                };
            }
            
            return {
                statusCode: response.status,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: `Gemini API error: ${response.status}`,
                    details: errorText
                })
            };
        }

        const result = await response.json();
        console.log('Gemini API response received');

        // Extract the generated text from Gemini's response format
        let generatedText = '';
        if (result.candidates && result.candidates.length > 0) {
            const candidate = result.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                generatedText = candidate.content.parts[0].text || '';
            }
        }

        if (!generatedText) {
            console.error('No generated text in Gemini response:', result);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: 'Gemini returned empty response',
                    details: 'No text generated'
                })
            };
        }

        // Clean up the response while preserving formatting
        console.log('Raw AI response before cleaning:', JSON.stringify(generatedText));
        
        generatedText = generatedText
            .trim()
            .replace(/\n{4,}/g, '\n\n\n')   // Limit excessive line breaks but allow some spacing
            .replace(/[ \t]+$/gm, '');      // Remove trailing spaces but preserve line structure
            
        console.log('Cleaned AI response:', JSON.stringify(generatedText));
        
        // Force proper formatting if AI didn't follow rules
        generatedText = forceProperFormatting(generatedText);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST'
            },
            body: JSON.stringify({
                generated_text: generatedText,
                success: true,
                model: 'gemini-2.0-flash-exp'
            })
        };

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message 
            })
                };
    }
};

// Function to force proper formatting on AI response
function forceProperFormatting(text) {
    console.log('Forcing proper formatting on:', JSON.stringify(text));
    
    let formatted = text;
    
    // Split into lines and process
    let lines = formatted.split('\n');
    let result = [];
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        if (!line) {
            // Keep empty lines for spacing
            result.push('');
            continue;
        }
        
        // Check if this looks like a title (no bullet, substantial text)
        if (!line.startsWith('•') && !line.startsWith('-') && !line.startsWith('    ') && line.length > 3) {
            // Add spacing before titles (except first line)
            if (result.length > 0 && result[result.length - 1] !== '') {
                result.push('');
            }
            result.push(line);
            result.push(''); // Add spacing after titles
        }
        // Check if this looks like a bullet point
        else if (line.startsWith('•') || line.startsWith('-')) {
            // Ensure proper indentation for bullets
            let bulletText = line.replace(/^[•\-]\s*/, '');
            result.push('    • ' + bulletText);
        }
        // Check if this is already indented content
        else if (line.startsWith('    ')) {
            result.push(line);
        }
        // Regular text
        else {
            result.push(line);
        }
    }
    
    // Join back and clean up excessive spacing
    formatted = result.join('\n').replace(/\n{4,}/g, '\n\n\n');
    
    console.log('After forcing format:', JSON.stringify(formatted));
    return formatted;
}

// Function to completely restructure markdown by parsing and rebuilding
function fixMarkdownFormatting(text) {
    console.log('Original messy text:', text);
    
    // Step 1: Normalize whitespace
    let normalized = text.replace(/\s+/g, ' ').trim();
    
    // Step 2: Split into tokens and identify markdown elements
    let tokens = [];
    let current = '';
    
    for (let i = 0; i < normalized.length; i++) {
        let char = normalized[i];
        let nextChars = normalized.substring(i, i + 10);
        
        // Check for headers
        if (char === '#' && (i === 0 || normalized[i-1] === ' ')) {
            if (current.trim()) {
                tokens.push({type: 'text', content: current.trim()});
                current = '';
            }
            
            let headerLevel = 0;
            while (normalized[i] === '#' && headerLevel < 6) {
                headerLevel++;
                i++;
            }
            
            // Get header text until next # or bullet or end
            let headerText = '';
            while (i < normalized.length && 
                   !normalized.substring(i).match(/^\s*(#{1,6}|\*|\-)/)) {
                headerText += normalized[i];
                i++;
            }
            i--; // Back up one
            
            tokens.push({
                type: 'header', 
                level: headerLevel, 
                content: headerText.trim()
            });
            continue;
        }
        
        // Check for bullets
        if ((char === '-' || char === '*') && (i === 0 || normalized[i-1] === ' ')) {
            if (current.trim()) {
                tokens.push({type: 'text', content: current.trim()});
                current = '';
            }
            
            i++; // Skip the bullet character
            while (i < normalized.length && normalized[i] === ' ') i++; // Skip spaces
            
            // Get bullet content until next bullet or header or end
            let bulletText = '';
            while (i < normalized.length && 
                   !normalized.substring(i).match(/^\s*(#{1,6}|\*|\-)/)) {
                bulletText += normalized[i];
                i++;
            }
            i--; // Back up one
            
            tokens.push({
                type: 'bullet', 
                content: bulletText.trim()
            });
            continue;
        }
        
        current += char;
    }
    
    // Add any remaining text
    if (current.trim()) {
        tokens.push({type: 'text', content: current.trim()});
    }
    
    // Step 3: Rebuild with proper formatting
    let result = '';
    
    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i];
        
        if (token.type === 'header') {
            if (result && !result.endsWith('\n\n')) {
                result += '\n\n';
            }
            result += '#'.repeat(token.level) + ' ' + token.content + '\n\n';
        }
        else if (token.type === 'bullet') {
            // Check if this is the first bullet in a series
            if (i === 0 || tokens[i-1].type !== 'bullet') {
                if (result && !result.endsWith('\n\n')) {
                    result += '\n\n';
                }
            }
            result += '- ' + token.content + '\n';
        }
        else if (token.type === 'text') {
            if (result && !result.endsWith('\n\n') && !result.endsWith('\n')) {
                result += '\n\n';
            }
            result += token.content + '\n\n';
        }
    }
    
    // Final cleanup
    result = result.replace(/\n{3,}/g, '\n\n').trim();
    
    console.log('Rebuilt text:', result);
    return result;
}

   