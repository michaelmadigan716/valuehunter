// app/api/grok/route.js
// This proxies requests to xAI Grok API to avoid CORS issues

export async function POST(request) {
  try {
    const { prompt } = await request.json();
    
    const GROK_KEY = process.env.NEXT_PUBLIC_GROK_KEY;
    
    if (!GROK_KEY) {
      return Response.json({ error: 'Grok API key not configured' }, { status: 500 });
    }

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROK_KEY}`
      },
      body: JSON.stringify({
        model: "grok-3",
        messages: [
          { 
            role: "user", 
            content: prompt 
          }
        ],
        max_tokens: 600,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Grok API error:', response.status, errorText);
      return Response.json({ error: `Grok API error: ${response.status} ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || '';
    
    // Clean up markdown formatting (remove ** and other markdown)
    text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/##/g, '').replace(/#/g, '');
    
    // Extract upside percentage
    let upsidePct = null;
    const match = text.match(/UPSIDE_PCT:\s*([+-]?\d+)/i);
    if (match) {
      upsidePct = parseInt(match[1]);
      // Remove the tag from displayed text
      text = text.replace(/UPSIDE_PCT:\s*[+-]?\d+%?/i, '').trim();
    }
    
    return Response.json({ 
      analysis: text || 'No response from AI',
      upsidePct: upsidePct
    });
    
  } catch (error) {
    console.error('Grok route error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
