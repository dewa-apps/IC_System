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
    
    // Jika request adalah untuk upload file
    var fileData = data.base64; 
    var fileName = data.fileName;
    var mimeType = data.mimeType;
    
    // MASUKKAN ID FOLDER SHARED DRIVE ANDA DI SINI
    var folderId = "PASTE_ID_FOLDER_DI_SINI"; 
    
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
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
