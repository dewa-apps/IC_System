const tomorrow = new Date(Date.now() + 24*3600*1000);
const tomorrowStr = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().split('T')[0];
console.log(tomorrowStr);
