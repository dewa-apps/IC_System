import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  
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
- Drive Documents: ${JSON.stringify(contextData.driveData)}

If the user asks a question about schedules (jadwal) this month, look at the Jadwal data.
If asked about tasks, look at the Tasks data.
If the user asks about knowledge base or manual docs, check the Drive Documents.
Be concise and helpful. Format your response in Markdown.`;

    const chatOptions: any = {
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2
      }
    };

    if (history && history.length > 0) {
      chatOptions.history = history.map((m: any) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));
    }

    const chat = ai.chats.create(chatOptions);

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
    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key not valid')) {
       res.status(400).json({ error: "The GEMINI_API_KEY configured in Vercel is invalid. Please get a valid API key from https://aistudio.google.com/ and update your Vercel Environment Variables." });
    } else if (error.message?.includes('429') || error.message?.includes('exceeded your current quota') || error.status === 429) {
       res.status(429).json({ error: "You have exceeded your Gemini API quota. Please check your plan (https://ai.google.dev/gemini-api/docs/rate-limits) or try again later." });
    } else {
       res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}
