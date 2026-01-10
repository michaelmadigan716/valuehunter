// app/api/grok/route.js
// Proxies requests to xAI Grok API

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
            content: "You are an elite hedge fund analyst specializing in technical chart patterns and small-cap value investing. Always end your analysis with exactly THREE lines in this exact format:\nUPSIDE_PCT: [number]\nINSIDER_CONVICTION: [number]\nCUP_HANDLE_SCORE: [number]\nThese three data lines are required."
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
    
    console.log('Raw Grok response (last 400 chars):', text.slice(-400));
    
    // Clean up markdown
    text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/##/g, '').replace(/#/g, '').replace(/`/g, '');
    
    // Extract upside percentage
    let upsidePct = null;
    const upsideMatch = text.match(/UPSIDE_PCT[:\s=]*([+-]?\d+)/i);
    if (upsideMatch) {
      upsidePct = parseInt(upsideMatch[1]);
      console.log('Found upside:', upsidePct);
    }
    
    // Extract insider conviction
    let insiderConviction = null;
    const convictionMatch = text.match(/INSIDER_CONVICTION[:\s=]*(\d+)/i);
    if (convictionMatch) {
      insiderConviction = parseInt(convictionMatch[1]);
      if (insiderConviction > 100) insiderConviction = 100;
      console.log('Found conviction:', insiderConviction);
    }
    
    // Extract cup and handle SCORE (0-100)
    let cupHandleScore = null;
    const cupHandlePatterns = [
      /CUP_HANDLE_SCORE[:\s=]*(\d+)/i,
      /CUP_HANDLE[:\s=]*(\d+)/i,
      /CUPHANDLE[:\s=]*(\d+)/i
    ];
    for (const pattern of cupHandlePatterns) {
      const match = text.match(pattern);
      if (match) {
        cupHandleScore = parseInt(match[1]);
        if (cupHandleScore > 100) cupHandleScore = 100;
        console.log('Found cup handle score:', cupHandleScore);
        break;
      }
    }
    
    // Remove the data lines from analysis text
    text = text.replace(/UPSIDE_PCT[:\s=]*[+-]?\d+%?/gi, '').trim();
    text = text.replace(/INSIDER_CONVICTION[:\s=]*\d+%?/gi, '').trim();
    text = text.replace(/CUP_HANDLE_SCORE[:\s=]*\d+%?/gi, '').trim();
    text = text.replace(/CUP_HANDLE[:\s=]*\d+%?/gi, '').trim();
    
    console.log('Extracted - upside:', upsidePct, 'conviction:', insiderConviction, 'cupHandleScore:', cupHandleScore);
    
    return Response.json({ 
      analysis: text || 'No response from AI',
      upsidePct: upsidePct,
      insiderConviction: insiderConviction,
      cupHandleScore: cupHandleScore
    });
    
  } catch (error) {
    console.error('Grok route error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
