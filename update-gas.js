import fs from 'fs';
let content = fs.readFileSync('google-apps-script/code.gs', 'utf8');

const injection = `
    if (data.action === 'uploadKnowledgeFile') {
      var folderId = "1fmZcQre4WqR6o-K5mJVwTtTgjiNX8MlM";
      var folder = DriveApp.getFolderById(folderId);
      
      var base64Data = data.base64;
      if (base64Data.indexOf(',') !== -1) {
        base64Data = base64Data.split(',')[1];
      }
      
      var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), data.mimeType, data.fileName);
      var file = folder.createFile(blob);
      
      // If the file is a csv or text, we can convert it to sheets/docs but we can also leave it as is.
      // Wait, let's just create it directly.
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        fileUrl: file.getUrl(),
        fileId: file.getId()
      })).setMimeType(ContentService.MimeType.JSON);
    }
`;

content = content.replace("if (data.action === 'getDriveFolderText') {", injection + "\n    if (data.action === 'getDriveFolderText') {");
fs.writeFileSync('google-apps-script/code.gs', content);
