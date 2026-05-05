const doFetch = async () => {
    try {
        const gasUrl = "https://script.google.com/macros/s/AKfycbwlC8ARWAHK6CtkdtHeOpqDw6pIjEAV3jxTrtCabiTgX5kDqlcaPOiO9NCWVDQNvqOgsQ/exec";
        const res = await fetch(gasUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "listWarehouseFiles", folderUrl: "test" })
        });
        console.log(res.status);
        console.log(await res.text());
    } catch (e) {
        console.error(e);
    }
}
doFetch();
