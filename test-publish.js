fetch("https://ais-pre-lt4g2fgwfme3g74wdhaeyg-48045594560.asia-southeast1.run.app/api/webhooks/email-task", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ secret: "SIRCLO_INVENTORY_SECRET_TASK" })
}).then(res => res.text()).then(console.log);
