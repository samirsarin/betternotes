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
        const prompt = `You are an expert at improving text for better note-taking. Take the following student note and improve it by fixing spelling/grammar, making it concise, and organizing it better.

CRITICAL FORMATTING RULES - FOLLOW EXACTLY:
1. Use # for main topics (followed by TWO line breaks)
2. Use ## for subtopics (followed by TWO line breaks) 
3. Use - for bullet points (each on separate line)
4. Use **bold** for key terms
5. ALWAYS put TWO line breaks (\\n\\n) between sections
6. ALWAYS put ONE line break (\\n) between bullet points
7. Never put everything on one line

EXAMPLE FORMAT:
# Main Topic

## Subtopic

- First bullet point
- Second bullet point
- Third bullet point

## Another Subtopic

- More bullet points
- With proper spacing

Original text: "${text}"

Improved version with proper line breaks:`;

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

        // Clean up the response and fix formatting issues
        generatedText = fixMarkdownFormatting(generatedText.trim());

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

// Function to fix markdown formatting and ensure proper line breaks
function fixMarkdownFormatting(text) {
    let fixed = text;
    
    // Ensure headers have proper spacing
    fixed = fixed.replace(/^(#{1,6})\s*(.+)$/gm, '$1 $2\n');
    
    // Ensure bullet points are on separate lines
    fixed = fixed.replace(/(-\s*.+?)(\s*-\s*)/g, '$1\n$2');
    
    // Fix bullet points that might be inline
    fixed = fixed.replace(/(-\s*[^-\n]+)(-\s*)/g, '$1\n$2');
    
    // Ensure proper spacing after headers
    fixed = fixed.replace(/^(#{1,6}\s*.+)\n?(?!\n)/gm, '$1\n\n');
    
    // Ensure bullet points have proper line breaks
    fixed = fixed.replace(/^(-\s*.+)$/gm, '$1');
    
    // Add line breaks before bullet point sections
    fixed = fixed.replace(/([^\n])\n(-\s*)/g, '$1\n\n$2');
    
    // Clean up multiple consecutive line breaks (max 2)
    fixed = fixed.replace(/\n{3,}/g, '\n\n');
    
    // Ensure list items are properly separated
    fixed = fixed.replace(/^-\s*(.+)(?=\n-)/gm, '- $1');
    
    // Fix any remaining formatting issues
    fixed = fixed.replace(/^\s*-\s*/gm, '- ');
    
    return fixed.trim();
}

   