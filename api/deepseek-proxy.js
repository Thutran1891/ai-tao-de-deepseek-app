// File: /api/deepseek-proxy.js
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are accepted' 
    });
  }

  try {
    console.log('📡 [Proxy] Received DeepSeek API request');
    
    const { messages, apiKey, model = 'deepseek-chat', temperature = 0.3, max_tokens = 4000, response_format } = req.body;

    // Validate required fields
    if (!apiKey) {
      return res.status(400).json({ 
        error: 'Missing API Key',
        message: 'API Key is required' 
      });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid messages',
        message: 'Messages must be a non-empty array' 
      });
    }

    console.log('📡 [Proxy] Forwarding to DeepSeek API...');
    
    // Make request to DeepSeek API
    const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: parseFloat(temperature),
        max_tokens: parseInt(max_tokens),
        stream: false,
        ...(response_format && { response_format })
      }),
      // Add timeout
      signal: AbortSignal.timeout(55000) // 55 seconds timeout
    });

    console.log('📡 [Proxy] DeepSeek response status:', deepseekResponse.status);
    
    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error('❌ [Proxy] DeepSeek API error:', errorText);
      
      let errorMessage = 'DeepSeek API error';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.error || errorText;
      } catch (e) {
        errorMessage = errorText;
      }
      
      return res.status(deepseekResponse.status).json({ 
        error: 'DeepSeek API Error',
        message: errorMessage,
        status: deepseekResponse.status
      });
    }

    const data = await deepseekResponse.json();
    console.log('✅ [Proxy] Request successful');
    
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('❌ [Proxy] Error:', error);
    
    // Handle different error types
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return res.status(504).json({ 
        error: 'Gateway Timeout',
        message: 'Request to DeepSeek API timed out. Please try again.' 
      });
    }
    
    if (error.name === 'FetchError' || error.message.includes('fetch failed')) {
      return res.status(502).json({ 
        error: 'Bad Gateway',
        message: 'Cannot connect to DeepSeek API. Please check your network.' 
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message || 'An unexpected error occurred' 
    });
  }
}