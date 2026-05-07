fetch("http://localhost:3000/api/webhooks/email-task", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    secret: "SIRCLO_INVENTORY_SECRET_TASK",
    taskData: {
      title: "Re: Ending Stock Odoo 30 Nov 2024",
      description: "#parent_task# IC-00452",
      parent_task_id: "IC-00452",
      email_thread_id: "test-thread-id-1234",
      request_date: new Date().toISOString(),
      due_date: new Date().toISOString(),
      subtasks: []
    }
  })
}).then(res => res.json()).then(console.log).catch(console.error);
