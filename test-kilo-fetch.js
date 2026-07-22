async function main() {
  const url = "https://api.kilo.ai/v1/chat/completions";
  const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbnYiOiJwcm9kdWN0aW9uIiwia2lsb1VzZXJJZCI6IjY1NDEyNmQ0LThjMDktNDJkMi1hNmUyLTU0OTU4OGY0NjAzMyIsImFwaVRva2VuUGVwcGVyIjpudWxsLCJ2ZXJzaW9uIjozLCJpYXQiOjE3ODQ3MTU3NjUsImV4cCI6MTk0MjM5NTc2NX0.zWUeZX-ZmxBrQduZcwsVbBxRcWHcO2YPnhvM9FqZY9Q";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "default",
      messages: [{ role: "user", content: "hello" }],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    console.error("HTTP error:", response.status);
    console.error(await response.text());
  } else {
    console.log(await response.json());
  }
}
main();
