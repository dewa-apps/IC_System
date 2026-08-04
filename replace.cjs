const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const minimalTasks = tasksRef\.current\.map\(item => \(\{[\s\S]*?await sendAll\(minimalKlaim, 'backupDataListKlaimToSheets', 'sheetName', 'KLAIM', 'klaim'\);/g;

const replacement = `if (target === 'all' || target === 'tasks') {
        const minimalTasks = tasksRef.current.map(item => ({
          id: item.id,
          display_id: item.display_id,
          title: item.title,
          description: stripHtml(item.description).slice(0, 100),
          status: item.status,
          assignee: item.assignee,
          requestor: item.requestor,
          division: item.division,
          brand: item.brand,
          category: item.category,
          due_date: item.due_date,
          updated_at: item.updated_at,
          created_at: item.created_at,
          priority: item.priority,
          request_date: item.request_date,
          authorName: item.authorName
        }));
        await sendAll(minimalTasks, 'backupToSheets', '', undefined, 'tasks');
      }
      
      if (target === 'all' || target === 'links') {
        const minimalLinks = dataLinksRef.current.map((item: any) => ({
          id: item.id,
          display_id: item.display_id,
          category: item.category,
          link_name: item.link_name,
          link_url: item.link_url,
          description: item.description,
          note: item.note
        }));
        await sendAll(minimalLinks, 'backupDataListLinksToSheets', 'sheetName', 'LINK', 'links');
      }

      if (target === 'all' || target === 'jadwal') {
        const minimalJadwal = dataJadwalRef.current.map(item => ({
          id: item.id,
          display_id: item.display_id,
          date: item.date,
          type: item.type,
          category: item.category,
          wh_code: item.wh_code,
          wh_name: item.wh_name,
          wh_partner: item.wh_partner,
          remark: stripHtml(item.remark).slice(0, 100),
          subject_email: item.subject_email,
          status_btb_wh: item.status_btb_wh,
          subject_email_btb_brand: item.subject_email_btb_brand,
          status_btb_brand: item.status_btb_brand
        }));
        await sendAll(minimalJadwal, 'backupDataListJadwalToSheets', 'sheetName', 'JADWAL', 'jadwal');
      }

      if (target === 'all' || target === 'klaim') {
        const minimalKlaim = dataKlaimRef.current.map(item => ({
          id: item.id,
          display_id: item.display_id,
          claim_type: item.claim_type,
          invoice_date: item.invoice_date,
          invoice_no: item.invoice_no,
          description: stripHtml(item.description).slice(0, 100),
          subject_email: item.subject_email,
          link_data: item.link_data,
          whp_name: item.whp_name,
          partner: item.partner,
          claim_value: item.claim_value,
          tax: item.tax,
          due: item.due,
          subsidiary: item.subsidiary,
          status: item.status,
          remark: stripHtml(item.remark).slice(0, 100)
        }));
        await sendAll(minimalKlaim, 'backupDataListKlaimToSheets', 'sheetName', 'KLAIM', 'klaim');
      }`;

let newCode = code.replace(regex, replacement);
fs.writeFileSync('src/App.tsx', newCode);
console.log('done');
