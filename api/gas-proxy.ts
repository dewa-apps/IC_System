export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const gasUrl = "https://script.google.com/macros/s/AKfycbwlC8ARWAHK6CtkdtHeOpqDw6pIjEAV3jxTrtCabiTgX5kDqlcaPOiO9NCWVDQNvqOgsQ/exec";
    
    // Convert JSON body back to string because GAS expects JSON string in text/plain
    const payload = JSON.stringify(req.body);

    const response = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: payload
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
       const json = await response.json();
       return res.status(response.status).json(json);
    } else {
       const text = await response.text();
       return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error("GAS proxy failed", error);
    return res.status(500).json({ error: error.message });
  }
}
