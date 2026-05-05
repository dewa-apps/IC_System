const doFetch = async () => {
    try {
        const res = await fetch("http://localhost:3000/api/gas-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: 'uploadWarehouseFile',
            base64: "dGVzdA==",
            fileName: "test-wh.txt",
            mimeType: "text/plain",
            whp: "Agency - Elemis Jakarta (KNS)",
            whpName: "E-Commerce",
            folderUrl: "",
            folderId: "",
            sheetId: '1_rHOUu6u4A_tpP7ScrdgQ6iVmijijB2mCHXTSQ6t1Bg',
            sheetName: 'Cek_status_WH'
          })
        });
        console.log("Status:", res.status);
        console.log("Body:", await res.text());
    } catch (e) {
        console.error(e);
    }
}
doFetch();
