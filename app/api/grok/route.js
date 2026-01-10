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
            content: "You are an elite hedge fund analyst. Always end your analysis with exactly THREE lines in this format:\nUPSIDE_PCT: [number]\nINSIDER_CONVICTION: [number]\nCUP_HANDLE: [YES or NO]\nThese three lines are required at the end of every response."
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
    
    console.log('Raw Grok response (last 300 chars):', text.slice(-300));
    
    // Clean up any markdown formatting
    text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/##/g, '').replace(/#/g, '').replace(/`/g, '');
    
    // Extract upside percentage
    let upsidePct = null;
    const upsidePatterns = [
      /UPSIDE_PCT:\s*([+-]?\d+)/i,
      /UPSIDE_PCT\s*=\s*([+-]?\d+)/i,
      /UPSIDE[_\s]*PCT[:\s]*([+-]?\d+)/i
    ];
    for (const pattern of upsidePatterns) {
      const match = text.match(pattern);
      if (match) {
        upsidePct = parseInt(match[1]);
        console.log('Found upside:', upsidePct);
        break;
      }
    }
    
    // Extract insider conviction score
    let insiderConviction = null;
    const convictionPatterns = [
      /INSIDER_CONVICTION:\s*(\d+)/i,
      /INSIDER_CONVICTION\s*=\s*(\d+)/i,
      /INSIDER[_\s]*CONVICTION[:\s]*(\d+)/i
    ];
    for (const pattern of convictionPatterns) {
      const match = text.match(pattern);
      if (match) {
        insiderConviction = parseInt(match[1]);
        if (insiderConviction > 100) insiderConviction = 100;
        console.log('Found conviction:', insiderConviction);
        break;
      }
    }
    
    // Extract cup and handle - YES or NO
    let cupHandle = null;
    const cupHandlePatterns = [
      /CUP_HANDLE:\s*(YES|NO)/i,
      /CUP_HANDLE\s*=\s*(YES|NO)/i,
      /CUP[_\s]*(?:AND[_\s]*)?HANDLE[:\s]*(YES|NO)/i
    ];
    for (const pattern of cupHandlePatterns) {
      const match = text.match(pattern);
      if (match) {
        cupHandle = match[1].toUpperCase() === 'YES';
        console.log('Found cup handle:', cupHandle);
        break;
      }
    }
    
    // Remove the score lines from the analysis text
    text = text.replace(/UPSIDE_PCT[:\s=]*[+-]?\d+%?/gi, '').trim();
    text = text.replace(/INSIDER_CONVICTION[:\s=]*\d+%?/gi, '').trim();
    text = text.replace(/CUP_HANDLE[:\s=]*(YES|NO)/gi, '').trim();
    
    console.log('Extracted - upside:', upsidePct, 'conviction:', insiderConviction, 'cupHandle:', cupHandle);
    
    return Response.json({ 
      analysis: text || 'No response from AI',
      upsidePct: upsidePct,
      insiderConviction: insiderConviction,
      cupHandle: cupHandle
    });
    
  } catch (error) {
    console.error('Grok route error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
