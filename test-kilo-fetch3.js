async function main() {
  const urls = [
    "https://app.kilo.ai/api/v1/chat/completions",
    "https://app.kilo.ai/api/chat/completions",
    "https://app.kilo.ai/v1/chat/completions"
  ];
  const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbnYiOiJwcm9kdWN0aW9uIiwia2lsb1VzZXJJZCI6IjY1NDEyNmQ0LThjMDktNDJkMi1hNmUyLTU0OTU4OGY0NjAzMyIsImFwaVRva2VuUGVwcGVyIjpudWxsLCJ2ZXJzaW9uIjozLCJpYXQiOjE3ODQ3MTU3NjUsImV4cCI6MTk0MjM5NTc2NX0.zWUeZX-ZmxBrQduZcwsVbBxRcWHcO2YPnhvM9FqZY9Q";

  for (const url of urls) {
      console.log("Testing", url);
      try {
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
        console.log(response.status);
      } catch (e) {
        console.log(e.message);
      }
  }
}
main();
