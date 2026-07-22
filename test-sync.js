const fetch = require('node-fetch');
async function run() {
  const res = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      message: 'test',
      contextData: {},
      currentUser: 'dewangga@sirclo.com'
    })
  });
  console.log(await res.text());
}
run();
