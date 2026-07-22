import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbnYiOiJwcm9kdWN0aW9uIiwia2lsb1VzZXJJZCI6IjY1NDEyNmQ0LThjMDktNDJkMi1hNmUyLTU0OTU4OGY0NjAzMyIsImFwaVRva2VuUGVwcGVyIjpudWxsLCJ2ZXJzaW9uIjozLCJpYXQiOjE3ODQ3MTU3NjUsImV4cCI6MTk0MjM5NTc2NX0.zWUeZX-ZmxBrQduZcwsVbBxRcWHcO2YPnhvM9FqZY9Q",
  baseURL: "https://api.kilo.ai/v1"
});

async function main() {
  try {
    const stream = await openai.chat.completions.create({
      model: "default",
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
    });
    for await (const chunk of stream) {
      process.stdout.write(chunk.choices[0]?.delta?.content || "");
    }
  } catch(e) {
    console.error(e.message);
  }
}
main();
