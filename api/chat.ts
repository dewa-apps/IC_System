import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  // CORS if needed, but not strictly required if same-origin on Vercel
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message, history, contextData, currentUser } = req.body;
    
    // Use the GEMINI_API_KEY from Vercel's Environment Variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server misconfiguration: GEMINI_API_KEY is not set in Vercel environment variables.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are an AI Assistant for the IC System application.
The user's email is: ${currentUser}. You can address them by their first name if appropriate.
You have access to the following application data. Please use this data to answer user questions factually.

Here is the data, represented as JSON arrays:
- Tasks: ${JSON.stringify(contextData.tasks)}
- Jadwal: ${JSON.stringify(contextData.jadwal)}
- Klaim: ${JSON.stringify(contextData.klaim)}
- Links: ${JSON.stringify(contextData.links)}
- Warehouse: ${JSON.stringify(contextData.warehouse)}

If the user asks a question about schedules (jadwal) this month, look at the Jadwal data.
If asked about tasks, look at the Tasks data.
Be concise and helpful. Format your response in Markdown.`;

    const chat = ai.chats.create({
      model: "gemini-3.1-pro-preview",
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2
      }
    });

    if (history && history.length > 0) {
      chat.history = history.map((m: any) => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
    }

    const response = await chat.sendMessageStream({ message });
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const chunk of response) {
      if (chunk.text) {
        res.write(chunk.text);
      }
    }
    res.end();
  } catch (error: any) {
    console.error("Chat proxy failed", error);
    res.status(500).json({ error: error.message });
  }
}
