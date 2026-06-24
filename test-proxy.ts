async function run() {
  const payload = {
    action: 'fetchWarehouseData',
    sheetId: '1_rHOUu6u4A_tpP7ScrdgQ6iVmijijB2mCHXTSQ6t1Bg', 
    sheetName: 'Cek_status_WH'
  };
  const res = await globalThis.fetch('http://localhost:3000/api/gas-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  console.log("Status:", res.status);
  console.log("Headers:", Object.fromEntries(res.headers.entries()));
  const text = await res.text();
  console.log("Body length:", text.length);
  console.log("Body snippet:", text.substring(0, 300));
}
run();
