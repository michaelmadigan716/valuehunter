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
            content: "You are an elite hedge fund analyst. Always end your analysis with exactly two lines: UPSIDE_PCT: [number] and INSIDER_CONVICTION: [number]. These are required."
          },
          { 
            role: "user", 
            content: prompt 
          }
        ],
        max_tokens: 1000,
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
    
    console.log('Raw Grok response (last 200 chars):', text.slice(-200));
    
    // Clean up any markdown formatting
    text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/##/g, '').replace(/#/g, '').replace(/`/g, '');
    
    // Extract upside percentage - try multiple patterns
    let upsidePct = null;
    const upsidePatterns = [
      /UPSIDE_PCT:\s*([+-]?\d+)/i,
      /UPSIDE_PCT\s*=\s*([+-]?\d+)/i,
      /UPSIDE[_\s]*PCT[:\s]*([+-]?\d+)/i,
      /upside[:\s]*([+-]?\d+)\s*%/i
    ];
    
    for (const pattern of upsidePatterns) {
      const match = text.match(pattern);
      if (match) {
        upsidePct = parseInt(match[1]);
        console.log('Found upside:', upsidePct, 'with pattern:', pattern);
        break;
      }
    }
    
    // Extract insider conviction score - try multiple patterns
    let insiderConviction = null;
    const convictionPatterns = [
      /INSIDER_CONVICTION:\s*(\d+)/i,
      /INSIDER_CONVICTION\s*=\s*(\d+)/i,
      /INSIDER[_\s]*CONVICTION[:\s]*(\d+)/i,
      /conviction[:\s]*(\d+)/i
    ];
    
    for (const pattern of convictionPatterns) {
      const match = text.match(pattern);
      if (match) {
        insiderConviction = parseInt(match[1]);
        console.log('Found conviction:', insiderConviction, 'with pattern:', pattern);
        break;
      }
    }
    
    // Remove the score lines from the analysis text
    text = text.replace(/UPSIDE_PCT[:\s=]*[+-]?\d+%?/gi, '').trim();
    text = text.replace(/INSIDER_CONVICTION[:\s=]*\d+%?/gi, '').trim();
    
    console.log('Extracted values - upside:', upsidePct, 'conviction:', insiderConviction);
    
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
