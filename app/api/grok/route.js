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
        model: "grok-4-fast-reasoning",
        messages: [
          { 
            role: "system",
            content: "You are an elite hedge fund analyst specializing in small-cap value investing. Provide thorough, institutional-quality analysis focused on upside potential and insider conviction. Be specific with numbers and data. Never use markdown formatting like ** or ## - write in clean plain text."
          },
          { 
            role: "user", 
            content: prompt 
          }
        ],
        max_tokens: 1200,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Grok API error:', response.status, errorText);
      return Response.json({ error: `Grok API error: ${response.status} ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || '';
    
    // Clean up any markdown formatting
    text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/##/g, '').replace(/#/g, '').replace(/`/g, '');
    
    // Extract upside percentage
    let upsidePct = null;
    const upsideMatch = text.match(/UPSIDE_PCT:\s*([+-]?\d+)/i);
    if (upsideMatch) {
      upsidePct = parseInt(upsideMatch[1]);
      text = text.replace(/UPSIDE_PCT:\s*[+-]?\d+%?/i, '').trim();
    }
    
    // Extract insider conviction score (0-100)
    let insiderConviction = null;
    const convictionMatch = text.match(/INSIDER_CONVICTION:\s*(\d+)/i);
    if (convictionMatch) {
      insiderConviction = parseInt(convictionMatch[1]);
      text = text.replace(/INSIDER_CONVICTION:\s*\d+%?/i, '').trim();
    }
    
    return Response.json({ 
      analysis: text || 'No response from AI',
      upsidePct: upsidePct,
      insiderConviction: insiderConviction
    });
    
  } catch (error) {
    console.error('Grok route error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
