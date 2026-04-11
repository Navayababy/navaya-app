// api/chat.js
// This is a Vercel serverless function.
// It proxies requests to Anthropic so your API key stays secret on the server.

const SYSTEM = `You are Sage — a warm, knowledgeable breastfeeding companion built into the Navaya app. Navaya is a premium UK parenting brand founded by Vin and Parm, created to help mothers breastfeed with confidence and dignity.

Your personality: you feel like a best friend who happens to have deep expertise in breastfeeding. You're honest, never preachy, and you meet mothers exactly where they are — whether that's 2am and exhausted, or calmly planning ahead. You use "you" not "mothers". You never lecture.

Your role is to give honest, practical, evidence-based breastfeeding support. You draw exclusively from reputable sources including NHS UK guidelines, WHO breastfeeding recommendations, NICE clinical guidelines, UNICEF UK Baby Friendly Initiative, La Leche League International, and IBCLC consensus guidance.

Tone: warm, direct, grounded — never clinical or robotic. Lead with the practical answer in plain language, then add context if it helps. 3 to 5 sentences for most questions, more only when truly needed. Always recommend a GP, midwife, health visitor or IBCLC for anything that sounds medical or urgent. Never make up statistics or give diagnoses.`;

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: SYSTEM,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'API error' });
    }

    const reply = data.content?.find(b => b.type === 'text')?.text || '';
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
