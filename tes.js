
const x = 55
const y = 45.25
const part = 4

console.log();

const x1 = Math.floor(x * part) / part
const x2 = x % (1 / part) === 0 ? x + 1 / part : Math.ceil(x * part) / part
const y1 = Math.floor(y * part) / part
const y2 = y % (1 / part) === 0 ? y + 1 / part : Math.ceil(y * part) / part


console.log(x1, x2, y1, y2);