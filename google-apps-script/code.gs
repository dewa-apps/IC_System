function testEmailAuth() {
  // Fungsi ini HANYA untuk memancing popup izin (authorization) dari Google.
  // Silakan jalankan fungsi ini SATU KALI dari editor GAS.
  var email = Session.getActiveUser().getEmail();
  if (email) {
    MailApp.sendEmail({
      to: email,
      subject: "Test Email Authorization",
      body: "Jika Anda menerima email ini, berarti izin pengiriman email sudah berhasil diberikan!"
    });
    Logger.log("Email test terkirim ke: " + email);
  } else {
    Logger.log("Tidak dapat mendeteksi email aktif.");
  }
}

function doPost(e) {
  try {
    // Parse data yang dikirim dari aplikasi
    // Kita menggunakan text/plain dari frontend untuk menghindari isu CORS Preflight
    var data = JSON.parse(e.postData.contents);
    
    // Jika request adalah untuk mengirim email
    if (data.action === 'sendEmail') {
      MailApp.sendEmail({
        to: data.to,
        subject: data.subject,
        body: data.body
      });
      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'success', 
        message: 'Email sent' 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Jika request adalah untuk backup ke Google Sheets
    if (data.action === 'backupToSheets') {
      var sheetId = data.sheetId; // ID spreadsheet
      var spreadsheet = SpreadsheetApp.openById(sheetId);
      var sheet = spreadsheet.getSheets()[0]; // Menyimpan di sheet / tab pertama
      
      // Bersihkan tab data lama terlebih dahulu agar yang baru tidak menumpuk
      sheet.clear();
      
      var tasks = data.tasks;
      if (!tasks || tasks.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          message: "No tasks to backup"
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // 1. Definisikan Judul Kolom (Headers)
      var headers = [
        "Task ID", "Display ID", "Title", "Status", "Priority", 
        "Assignee", "Category", "Brand", "Due Date", "Created At"
      ];
      sheet.appendRow(headers);
      
      // Format tebal huruf Headers
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

      // 2. Memasukkan Baris Tabel (Row)
      var rows = tasks.map(function(task) {
        return [
          task.id || "",
          task.display_id || "",
          task.title || "",
          task.status || "",
          task.priority || "",
          task.assignee || "Unassigned",
          task.category || "",
          task.brand || "",
          task.due_date || "",
          task.created_at || ""
        ];
      });
      
      // Taruh semua baris sekaligus dalam 1 panggilan (batch insert) agar cepat
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Backup sukses!'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Jika request adalah untuk backup datalist links ke Google Sheets
    if (data.action === 'backupDataListLinksToSheets') {
      var sheetId = data.sheetId; // ID spreadsheet
      var sheetName = data.sheetName || 'LINK'; // Sheet yang dituju
      var spreadsheet = SpreadsheetApp.openById(sheetId);
      var sheet = spreadsheet.getSheetByName(sheetName);
      
      // Jika sheet tidak ada, buat sheet baru
      if (!sheet) {
        sheet = spreadsheet.insertSheet(sheetName);
      } else {
        sheet.clear();
      }
      
      var links = data.links;
      if (!links || links.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          message: "No links to backup"
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      var headers = [
        "ID", "Display ID", "Category", "Link Name", "Link URL", 
        "Description", "Note"
      ];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

      var rows = links.map(function(link) {
        return [
          link.id || "",
          link.display_id || "",
          link.category || "",
          link.link_name || "",
          link.link_url || "",
          link.description || "",
          link.note || ""
        ];
      });
      
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Backup links sukses!'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Jika request adalah untuk backup datalist jadwal ke Google Sheets
    if (data.action === 'backupDataListJadwalToSheets') {
      var sheetId = data.sheetId; // ID spreadsheet
      var sheetName = data.sheetName || 'JADWAL'; // Sheet yang dituju
      var spreadsheet = SpreadsheetApp.openById(sheetId);
      var sheet = spreadsheet.getSheetByName(sheetName);
      
      // Jika sheet tidak ada, buat sheet baru
      if (!sheet) {
        sheet = spreadsheet.insertSheet(sheetName);
      } else {
        sheet.clear();
      }
      
      var jadwalList = data.jadwal;
      if (!jadwalList || jadwalList.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          message: "No jadwal to backup"
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      var headers = [
        "ID", "Display ID", "Date", "Type", "Category", "WH Code",
        "WH Name", "WH Partner", "Remark", "Subject Email", "Status BTB WH",
        "Subject Email BTB Brand", "Status BTB Brand"
      ];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

      var rows = jadwalList.map(function(item) {
        return [
          item.id || "",
          item.display_id || "",
          item.date || "",
          item.type || "",
          item.category || "",
          item.wh_code || "",
          item.wh_name || "",
          item.wh_partner || "",
          item.remark || "",
          item.subject_email || "",
          item.status_btb_wh || "",
          item.subject_email_btb_brand || "",
          item.status_btb_brand || ""
        ];
      });
      
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Backup jadwal sukses!'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Jika request adalah untuk upload file klaim
    if (data.action === 'uploadFileKlaim') {
      var fileData = data.base64; 
      var fileName = data.fileName;
      var mimeType = data.mimeType;
      
      var invoiceDate = data.invoiceDate || new Date().toISOString(); 
      var whpName = data.whpName || "UnknownWH";
      var klaimId = data.klaimId || "UnknownID";
      
      var year = invoiceDate.substring(0, 4);
      
      var rootFolderId = "1qlEw1DgqtbJ5AR_i0IdAf1AgyxPT6nxY"; 
      var rootFolder = DriveApp.getFolderById(rootFolderId);
      
      var yearFolders = rootFolder.getFoldersByName(year);
      var yearFolder;
      if (yearFolders.hasNext()) {
        yearFolder = yearFolders.next();
      } else {
        yearFolder = rootFolder.createFolder(year);
      }
      
      var whpFolders = yearFolder.getFoldersByName(whpName);
      var whpFolder;
      if (whpFolders.hasNext()) {
        whpFolder = whpFolders.next();
      } else {
        whpFolder = yearFolder.createFolder(whpName);
      }
      
      var idFolders = whpFolder.getFoldersByName(klaimId);
      var idFolder;
      if (idFolders.hasNext()) {
        idFolder = idFolders.next();
      } else {
        idFolder = whpFolder.createFolder(klaimId);
      }
      
      var decodedData = Utilities.base64Decode(fileData);
      var blob = Utilities.newBlob(decodedData, mimeType, fileName);
      
      var file = idFolder.createFile(blob);
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        fileUrl: file.getUrl(),
        fileId: file.getId(),
        folderUrl: idFolder.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Jika request adalah untuk upload file
    if (data.action === 'uploadFile' || data.base64) {
      var fileData = data.base64; 
      var fileName = data.fileName;
      var mimeType = data.mimeType;
      
      // MASUKKAN ID FOLDER SHARED DRIVE ANDA DI SINI
      var folderId = "1AO6iPo28KjgKk1SKTwsMLVb1jr8_kMrM"; 
      
      // Decode file dan buat blob
      var decodedData = Utilities.base64Decode(fileData);
      var blob = Utilities.newBlob(decodedData, mimeType, fileName);
      
      // Simpan ke Shared Drive
      var folder = DriveApp.getFolderById(folderId);
      var file = folder.createFile(blob);
      
      // Return URL file ke aplikasi
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        fileUrl: file.getUrl(),
        fileId: file.getId()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Unknown action'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
