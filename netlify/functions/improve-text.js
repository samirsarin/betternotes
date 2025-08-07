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
        const prompt = `You are an expert at improving text for better note-taking. Take the following student note and improve it by:
- Fixing spelling and grammar errors
- Making it more concise and clear
- Organizing information better
- Adding relevant details that would be useful in notes

FORMATTING REQUIREMENTS:
- Use proper markdown formatting for better readability
- Use # for main topics/headers
- Use ## for subtopics
- Use - for bullet points and lists
- Use **bold** for important terms
- Use proper line breaks between sections
- Make it well-structured and easy to read

Original text: "${text}"

Improved markdown formatted version:`;

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

        // Clean up the response (basic cleanup only)
        generatedText = generatedText.trim();

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

 