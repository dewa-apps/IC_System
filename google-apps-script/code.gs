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
    
    // Helper function to format date string to YYYY-MM-DD
    function formatDateString(dateStr) {
      if (!dateStr || typeof dateStr !== 'string') return dateStr || "";
      if (dateStr.indexOf('T') !== -1) {
        return dateStr.split('T')[0];
      }
      return dateStr;
    }
    
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
        "Assignee", "Category", "Brand", "Due Date", "Created At",
        "Request Date", "Description", "Create By", "Requestor", "Division"
      ];
      sheet.appendRow(headers);
      
      // Format tebal huruf Headers
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

      // 2. Memasukkan Baris Tabel (Row)
      var rows = tasks.map(function(task) {
        // Strip HTML tags from description if needed, though for Sheets backup we can just pass the string.
        // It might have HTML tags, you could use a simple regex replacing tags with empty string.
        var desc = (task.description || "").replace(/<[^>]+>/g, "");
        var displayId = task.display_id || ("IC-" + task.id);
        return [
          task.id || "",
          displayId,
          task.title || "",
          task.status || "",
          task.priority || "",
          task.assignee || "Unassigned",
          task.category || "",
          task.brand || "",
          formatDateString(task.due_date),
          formatDateString(task.created_at),
          formatDateString(task.request_date),
          desc,
          task.authorName || "",
          task.requestor || "",
          task.division || ""
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
          formatDateString(item.date),
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
    
    // Jika request adalah untuk backup datalist klaim ke Google Sheets
    if (data.action === 'backupDataListKlaimToSheets') {
      var sheetId = data.sheetId; // ID spreadsheet
      var sheetName = data.sheetName || 'KLAIM'; // Sheet yang dituju
      var spreadsheet = SpreadsheetApp.openById(sheetId);
      var sheet = spreadsheet.getSheetByName(sheetName);
      
      // Jika sheet tidak ada, buat sheet baru
      if (!sheet) {
        sheet = spreadsheet.insertSheet(sheetName);
      } else {
        sheet.clear();
      }
      
      var klaimList = data.klaim;
      if (!klaimList || klaimList.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          message: "No klaim to backup"
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      var headers = [
        "ID", "Display ID", "Claim Type", "Invoice Date", "Invoice No",
        "Description", "Subject Email", "Link Data", "WHP Name", "Partner",
        "Claim Value", "Tax", "Due", "Subsidiary", "Status", "Remark"
      ];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");

      var rows = klaimList.map(function(item) {
        return [
          item.id || "",
          item.display_id || "",
          item.claim_type || "",
          formatDateString(item.invoice_date),
          item.invoice_no || "",
          item.description || "",
          item.subject_email || "",
          item.link_data || "",
          item.whp_name || "",
          item.partner || "",
          item.claim_value !== undefined ? item.claim_value : "",
          item.tax !== undefined ? item.tax : "",
          item.due !== undefined ? item.due : "",
          item.subsidiary || "",
          item.status || "",
          item.remark || ""
        ];
      });
      
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Backup klaim sukses!'
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
    
    // Fetch Warehouse Data
    if (data.action === 'fetchWarehouseData') {
      var sheetIdWarehouse = data.sheetId; 
      var sheetNameWarehouse = data.sheetName;
      var spreadsheetWarehouse = SpreadsheetApp.openById(sheetIdWarehouse);
      var sheetWarehouse = spreadsheetWarehouse.getSheetByName(sheetNameWarehouse);
      
      var resultDataWarehouse = sheetWarehouse.getDataRange().getDisplayValues();
      if (resultDataWarehouse.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          data: []
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      var headersWarehouse = resultDataWarehouse[0];
      var rowsWarehouse = resultDataWarehouse.slice(1).map(function(row) {
        var obj = {};
        headersWarehouse.forEach(function(header, i) {
          obj[header] = row[i];
        });
        return obj;
      });
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        data: rowsWarehouse
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Upload Warehouse File
    if (data.action === 'uploadWarehouseFile') {
      var fileDataWH = data.base64; 
      var fileNameWH = data.fileName;
      var mimeTypeWH = data.mimeType;
      
      var whpParam = data.whp || "UnknownWHP";
      var whpNameParam = data.whpName || "UnknownName";
      var sheetIdWH = data.sheetId;
      var sheetNameWH = data.sheetName;
      
      var rootFolderIdWH = "1_wFZ5TCpQZ3Sq81aVjy36ATsI81RxT-5"; 
      var rootFolderWH = DriveApp.getFolderById(rootFolderIdWH);
      
      // Check for WHP folder
      var whpFolders = rootFolderWH.getFoldersByName(whpParam);
      var whpFolderItem;
      if (whpFolders.hasNext()) {
        whpFolderItem = whpFolders.next();
      } else {
        whpFolderItem = rootFolderWH.createFolder(whpParam);
      }
      
      // Check for WHP Name folder
      var nameFolders = whpFolderItem.getFoldersByName(whpNameParam);
      var nameFolderItem;
      if (nameFolders.hasNext()) {
        nameFolderItem = nameFolders.next();
      } else {
        nameFolderItem = whpFolderItem.createFolder(whpNameParam);
      }
      
      var decodedDataWH = Utilities.base64Decode(fileDataWH);
      var blobWH = Utilities.newBlob(decodedDataWH, mimeTypeWH, fileNameWH);
      var fileWH = nameFolderItem.createFile(blobWH);
      var folderUrlWH = nameFolderItem.getUrl();
      
      // Update Google Sheet with folder URL
      if (sheetIdWH && sheetNameWH) {
        var spreadWH = SpreadsheetApp.openById(sheetIdWH);
        var sWH = spreadWH.getSheetByName(sheetNameWH);
        if (sWH) {
          var dRange = sWH.getDataRange();
          var sVals = dRange.getDisplayValues();
          if (sVals.length > 0) {
            var headWH = sVals[0];
            var fIdx = headWH.indexOf('folder');
            var wIdx = headWH.indexOf('whp');
            var nIdx = headWH.indexOf('name');
            
            if (fIdx !== -1 && wIdx !== -1 && nIdx !== -1) {
              for (var j = 1; j < sVals.length; j++) {
                if (sVals[j][wIdx] === whpParam && sVals[j][nIdx] === whpNameParam) {
                  sWH.getRange(j + 1, fIdx + 1).setValue(folderUrlWH);
                  break;
                }
              }
            }
          }
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        fileUrl: fileWH.getUrl(),
        fileId: fileWH.getId(),
        folderUrl: folderUrlWH
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // List Warehouse Files
    if (data.action === 'listWarehouseFiles') {
      var dirUrl = data.folderUrl;
      var fileList = [];
      try {
        var strUrl = String(dirUrl || '');
        var idMatch = strUrl.match(/[-\w]{25,}/);
        if (idMatch && idMatch[0]) {
          var tgtFolder = DriveApp.getFolderById(idMatch[0]);
          var fIter = tgtFolder.getFiles();
          while (fIter.hasNext()) {
            var currFile = fIter.next();
            fileList.push({
              id: currFile.getId(),
              name: currFile.getName(),
              url: currFile.getUrl(),
              size: currFile.getSize(),
              dateCreated: currFile.getDateCreated().toISOString()
            });
          }
        }
      } catch (e) {
        // Ignored
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        files: fileList
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Delete Drive File
    if (data.action === 'deleteDriveFile') {
      var fileIdToDel = data.fileId;
      try {
        DriveApp.getFileById(fileIdToDel).setTrashed(true);
      } catch(e) {}
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success'
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
