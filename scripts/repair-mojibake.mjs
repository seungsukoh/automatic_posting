import fs from "node:fs/promises";

const files = process.argv.slice(2);

const cp1252 = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

function toByte(char) {
  const codePoint = char.codePointAt(0);
  if (codePoint <= 0xff) return codePoint;
  return cp1252.get(codePoint);
}

function decodeMojibake(value) {
  const bytes = [];
  for (const char of value) {
    const byte = toByte(char);
    if (byte === undefined) return value;
    bytes.push(byte);
  }

  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
    return /[가-힣]/.test(decoded) ? decoded : value;
  } catch {
    return value;
  }
}

const mojibakeRun = /[\u0080-\u00ff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]{2,}/g;

for (const file of files) {
  const original = await fs.readFile(file, "utf8");
  const repaired = original
    .replace(mojibakeRun, decodeMojibake)
    .replaceAll("Â·", "·");
  await fs.writeFile(file, repaired, "utf8");
  console.log(`${file}: ${original === repaired ? "unchanged" : "repaired"}`);
}
