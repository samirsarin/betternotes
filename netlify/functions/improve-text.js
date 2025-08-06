// Netlify Function to improve text using Hugging Face Flan-T5-Large
// This keeps your Hugging Face token secure on the server side

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
                    message: 'Function is working',
                    generated_text: 'Test successful'
                })
            };
        }

        // Get Hugging Face token from environment variables
        const HF_TOKEN = process.env.HUGGING_FACE_TOKEN;
        
        if (!HF_TOKEN) {
            console.error('Hugging Face token not found in environment variables');
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'AI service configuration error' })
            };
        }

        // Call Hugging Face Inference API
        const response = await fetch(
            'https://api-inference.huggingface.co/models/google/flan-t5-large',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HF_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: text,
                    parameters: {
                        max_length: max_length,
                        temperature: temperature,
                        do_sample: true,
                        top_p: 0.9
                    },
                    options: {
                        wait_for_model: true
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Hugging Face API error:', response.status, errorText);
            
            // Handle rate limiting
            if (response.status === 503) {
                return {
                    statusCode: 503,
                    body: JSON.stringify({ 
                        error: 'AI model is loading, please try again in a moment' 
                    })
                };
            }
            
            return {
                statusCode: response.status,
                body: JSON.stringify({ 
                    error: `AI service error: ${response.status}` 
                })
            };
        }

        const result = await response.json();
        
        // Handle different response formats
        let generatedText = '';
        if (Array.isArray(result) && result.length > 0) {
            generatedText = result[0].generated_text || '';
        } else if (result.generated_text) {
            generatedText = result.generated_text;
        }

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
                success: true
            })
        };

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message 
            })
        };
    }
}; 