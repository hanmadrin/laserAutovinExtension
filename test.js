// const a = new Date(new Date().toLocaleString("en-US", {timeZone: "America/New_York"}));
const dayStartingTime = new Date().setHours(0, 0, 0, 0);
console.log(new Date(dayStartingTime));