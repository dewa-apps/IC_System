const doFetch = async () => {
    try {
        const res = await fetch("http://localhost:3000/api/gas-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteDriveFile", fileId: "1Afm-bUbJK6WFJiZeMYuF0G2jpVmjfadv" })
        });
        console.log(res.status);
        console.log(await res.text());
    } catch (e) {
        console.error(e);
    }
}
doFetch();
