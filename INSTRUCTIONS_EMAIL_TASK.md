# Panduan Integrasi Email ke Task

Untuk merealisasikan flow pembuatan task otomatis via email dari `inventorycontrol@sirclo.com` beradasarkan `#task#`, kita akan menggunakan **Google Apps Script (GAS)** terhubung ke akun Gmail Anda dan sebuah **Webhook** di server aplikasi ini.

## 1. Webhook di Server
Aplikasi Anda sekarang memiliki Endpoint Webhook `POST /api/webhooks/email-task` yang sudah siap menerima payload dari Google Apps Script. Server juga otomatis akan:
- Menghindari duplikasi dengan mengecek `email_thread_id`
- Memberikan Task ID berurutan (`IC-000XX`)
- Melengkapi *Division* sesuai riwayat task Requestor sebelumnya.

> **Catatan Server**: Jika sebelumnya Anda menghapus file `firebase-applet-config.json`, harap jalankan Firebase setup kembali karena file tersebut terhapus di lingkungan pengembangan. Aplikasi saat ini menggunakan konfigurasi demo.

## 2. Solusi Google Apps Script untuk Email Group (Google Groups)

Karena `inventorycontrol@sirclo.com` adalah **Google Group** (bukan email personal yang bisa login langsung ke Gmail), Anda tidak dapat "login ke inbox" email tersebut untuk mensetting script. Namun karena setiap email yang terkirim ke Group tersebut akan masuk ke akun personal anggota tim di dalamnya (misalnya Anda, Reva, Tono), Anda memiliki 2 opsi solusi:

### Opsi A (Rekomendasi, Paling Mudah): Gunakan Akun Personal Anda/PIC
Jalankan Google Apps Script di akun Gmail personal Anda (atau salah satu PIC di tim) yang tergabung dalam grup `inventorycontrol@sirclo.com`. Script akan membaca email yang masuk ke kotak masuk (inbox) tim tersebut melalui inbox Anda.

Langkah-langkah Opsi A:
1. Buka [Google Apps Script (script.google.com)](https://script.google.com/) menggunakan akun Gmail Anda sendiri (misal: `dewangga@sirclo.com`).
2. Buat **Project Baru**.
3. Hapus kode default dan *paste* kode di bawah ini:

```javascript
/*
 * Script untuk mengecek email baru yang ditujukan ke inventorycontrol@sirclo.com
 * yang mengandung regex #task# dan mengirimkannya otomatis menjadi Task.
 * 
 * Update: Menggunakan Gmail Label untuk menghindari skip pada email yang 
 * sudah terbaca (read) atau email yang Anda kirim sendiri (sent).
 */

function processEmailTasks() {
  var labelName = "IC-Task-Created";
  var processedLabel = GmailApp.getUserLabelByName(labelName);
  
  // Buat label otomatis jika belum ada di Gmail Anda
  if (!processedLabel) {
    processedLabel = GmailApp.createLabel(labelName);
  }

  // Cari thread yang ditujukan ke grup, ada #task#, dan BELUM dilabeli "IC-Task-Created"
  // Ini termasuk email di Kotak Masuk (Inbox) maupun Terkirim (Sent)
  var query = 'to:inventorycontrol@sirclo.com "#task#" -label:' + labelName;

  var threads = GmailApp.search(query);
  
  if (threads.length === 0) {
    return;
  }
  
  // URL untuk endpoint webhook di server kita
  // Ganti dengan Shared App URL jika Anda sudah mem-"Publish" atau membagikan (Share) pembaruan terbaru.
  // Untuk pengetesan (Development), gunakan Dev URL Anda.
  var webhookUrl = "https://ais-dev-lt4g2fgwfme3g74wdhaeyg-48045594560.asia-southeast1.run.app/api/webhooks/email-task";
  var secretKey = "SIRCLO_INVENTORY_SECRET_TASK";
  
  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var messages = thread.getMessages();
    var firstMessage = messages[0];
    
    // Cari pesan balasan mana yang menyertakan teks #task#
    var taskMessage = null;
    var taskMessageIndex = -1;
    for (var j = messages.length - 1; j >= 0; j--) {
      var body = messages[j].getPlainBody() || messages[j].getBody();
      if (body.indexOf("#task#") !== -1) {
        taskMessage = messages[j];
        taskMessageIndex = j;
        break;
      }
    }
    
    if (!taskMessage) {
      // Jika tidak ketemu textnya tapi masuk query, tandai saja agar tidak terus di-loop
      thread.addLabel(processedLabel);
      continue;
    }
    
    // Tentukan pesan target yang merupakan request aslinya
    // (Berdasarkan tombol "Reply" yang ditekan Reva / In-Reply-To header)
    var requestMessage = null;
    var inReplyTo = taskMessage.getHeader("In-Reply-To");
    
    if (inReplyTo) {
      var targetId = inReplyTo.trim();
      for (var k = 0; k < messages.length; k++) {
        var msgId = messages[k].getHeader("Message-ID");
        if (msgId && msgId.trim() === targetId) {
          requestMessage = messages[k];
          break;
        }
      }
    }
    
    // Fallback: Jika tidak ditemukan In-Reply-To (atau error), gunakan pesan sebelum balasan Reva di thread
    if (!requestMessage) {
      requestMessage = (taskMessageIndex > 0) ? messages[taskMessageIndex - 1] : taskMessage;
    }
    
    // Request Date dari email original/target
    var requestDate = requestMessage.getDate();
    var dueDate = addWorkingDays(requestDate, 3);
    
    // Ambil string di sebelah #task#
    var bodyText = taskMessage.getPlainBody();
    var description = "";
    var match = bodyText.match(/#task#(.*)/);
    if (match && match[1]) {
      description = match[1].trim(); 
    }
    
    // Ambil requester dan creator
    var requestorRaw = requestMessage.getFrom();
    var requestorName = extractNameFromEmail(requestorRaw);
    
    var creatorRaw = taskMessage.getFrom();
    var creatorName = extractNameFromEmail(creatorRaw);
    
    var summary = cleanSubject(firstMessage.getSubject());
    
    var taskData = {
      title: summary,
      description: description,
      status: "TODO",
      priority: "LOW",
      requestor: requestorName,
      authorId: creatorName, 
      request_date: formatDateStr(requestDate),
      due_date: formatDateStr(dueDate),
      email_thread_id: thread.getId()
    };
    
    var payload = {
      secret: secretKey,
      taskData: taskData
    };
    
    try {
      var options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload)
      };
      var response = UrlFetchApp.fetch(webhookUrl, options);
      var result = JSON.parse(response.getContentText());
      
      if (result.success) {
         Logger.log("Sukses ID: " + result.id);
         // Tandai dengan label agar script tidak mengeksekusinya lagi di menit berikutnya
         thread.addLabel(processedLabel);
      }
    } catch (e) {
      Logger.log("Error Thread " + thread.getId() + " - " + e.toString());
    }
  }
}

// ======================== Helpers ========================
function extractNameFromEmail(senderStr) {
  var match = senderStr.match(/^(.*?)\s*</);
  return match ? match[1].replace(/"/g, '').trim() : senderStr;
}

function cleanSubject(subject) {
  return subject.replace(/^Re:\s*/i, "").replace(/^Fwd:\s*/i, "").trim();
}

function formatDateStr(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function addWorkingDays(startDate, days) {
  var result = new Date(startDate.getTime());
  var count = 0;
  while (count < days) {
    result.setDate(result.getDate() + 1);
    var dayOfWeek = result.getDay();
    // Skip Weekend
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }
  return result;
}
```

## 3. Set Trigger Otomatis
1. Setelah code disimpan di Google Apps Script, pergilah ke ikon menu **Triggers** (gambar jam alarm di menu kiri).
2. Klik tombol `+ Add Trigger` (kanan bawah).
3. Atur configurasi berikut:
   - **Choose which function to run:** `processEmailTasks`
   - **Select event source:** `Time-driven`
   - **Select type of time based trigger:** `Minutes timer`
   - **Select minute interval:** `Every 1 minute` (atau Every 5 minutes)
4. Simpan trigger. Script akan meminta izin (authorization) untuk mengakses Gmail dan external request (URL Fetch) Anda. Klik Allow.

## Validasi Flow System
Dengan ini:
1. Jika Budi email, lalu Tono membalas, task tidak akan terbentuk karena belum dibaca GAS (tidak ada `#task#`).
2. Jika Reva me-_reply_ dengan kode `#task#Buatkan...`:
   - GAS terpicu di menit bersangkutan.
   - Task terbentuk dan GAS menandai Thread sebagai *Read* (Agar menit selanjutnya diabaikan).
   - Di Server Aplikasi (`server.ts`):
     - Di-cek apakah `email_thread_id` sudah ada. Jika ada, di-*drop* atau di-_skip_ agar **tidak pernah Duplicate**.
     - Di-cek _request_ dari Budi apakah _Division_-nya terekam sebelumnya d database. Jika ya, akan diterapkan.
     - Dibuatkan `display_id` nomor increment otomatis selanjutnya (Contoh `IC-00389`).

### Opsi B: Menggunakan Sistem User Baru (Akun Layanan)
Langkah ini cukup rapi tetapi membutuhkan akun (dan berpotensi biaya lisensi Workspace) tambahan:
1. Buat _User Akun Google Workspace Baru_, contoh: `task-bot@sirclo.com`.
2. Masukkan akun tersebut (sebagai Member) ke dalam email grup `inventorycontrol@sirclo.com`.
3. Login ke Gmail menggunakan `task-bot@sirclo.com`, buka Google Apps Script, lalu lakukan _setup_ yang persis sama.
Hal ini memastikan pengecekan email murni berjalan di akun 'bot' secara transparan tanpa mengganggu atau bergantung pada email pribadi anggota tim manapun. Karena email yang dikirim ke `inventorycontrol@...` juga akan sampai ke inbox si Bot.
