// Simple fallback Netlify Function using a basic model
exports.handler = async (event, context) => {
    // Handle CORS
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

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { text } = JSON.parse(event.body);

        if (!text || text.trim() === '') {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'Text is required' })
            };
        }

        // Simple test response
        if (text === 'test') {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    success: true,
                    generated_text: 'Simple test successful - function working'
                })
            };
        }

        const HF_TOKEN = process.env.HUGGING_FACE_TOKEN;
        
        if (!HF_TOKEN) {
            return {
                statusCode: 500,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'HF token not configured' })
            };
        }

        // Use distilbart-cnn - very reliable model
        const response = await fetch(
            'https://api-inference.huggingface.co/models/sshleifer/distilbart-cnn-12-6',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HF_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: text,
                    options: { wait_for_model: true }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            return {
                statusCode: response.status,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ 
                    error: `HF API error: ${response.status}`,
                    details: errorText
                })
            };
        }

        const result = await response.json();
        
        let generatedText = '';
        if (Array.isArray(result) && result.length > 0) {
            generatedText = result[0].summary_text || result[0].generated_text || '';
        } else if (result.summary_text) {
            generatedText = result.summary_text;
        } else if (result.generated_text) {
            generatedText = result.generated_text;
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                generated_text: generatedText,
                success: true
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ 
                error: 'Internal error',
                details: error.message 
            })
        };
    }
}; 