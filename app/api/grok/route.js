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
        model: "grok-4",
        messages: [
          { 
            role: "system",
            content: "You are an elite hedge fund analyst. Be concise. When asked to provide scores, always include them at the end of your response in the exact format requested."
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
      return Response.json({ error: `Grok API error: ${response.status}`, analysis: errorText }, { status: response.status });
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || '';
    
    // Clean up markdown
    text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/##/g, '').replace(/#/g, '').replace(/`/g, '');
    
    // Extract metrics if present
    let insiderConviction = null;
    const convictionMatch = text.match(/INSIDER_CONVICTION[:\s=]*(\d+)/i);
    if (convictionMatch) {
      insiderConviction = Math.min(100, parseInt(convictionMatch[1]));
    }
    
    let cupHandleScore = null;
    const cupHandleMatch = text.match(/CUP_HANDLE_SCORE[:\s=]*(\d+)/i);
    if (cupHandleMatch) {
      cupHandleScore = Math.min(100, parseInt(cupHandleMatch[1]));
    }
    
    let upsidePct = null;
    const upsideMatch = text.match(/UPSIDE_PCT[:\s=]*([+-]?\d+)/i);
    if (upsideMatch) {
      upsidePct = parseInt(upsideMatch[1]);
    }
    
    return Response.json({ 
      analysis: text || 'No response from AI',
      insiderConviction,
      cupHandleScore,
      upsidePct
    });
    
  } catch (error) {
    console.error('Grok route error:', error);
    return Response.json({ error: error.message, analysis: 'Error occurred' }, { status: 500 });
  }
}
