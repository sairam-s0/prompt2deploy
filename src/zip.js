const textEncoder = new TextEncoder();
const crcTable = buildCrcTable();

export function downloadProjectZip(project) {
  const zipBytes = buildZip(project.files || []);
  const safeName = slugify(project.projectName || "generated-project");
  const blob = new Blob([zipBytes], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${safeName}.zip`;
  link.click();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildZip(files) {
  const entries = files
    .filter((file) => typeof file?.path === "string" && typeof file?.content === "string")
    .map((file) => ({
      nameBytes: textEncoder.encode(file.path.replace(/\\/g, "/")),
      dataBytes: textEncoder.encode(file.content),
    }));

  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  const now = new Date();
  const dosTime = getDosTime(now);
  const dosDate = getDosDate(now);

  for (const entry of entries) {
    const crc = crc32(entry.dataBytes);
    const localHeader = createLocalHeader(entry.nameBytes, entry.dataBytes.length, crc, dosTime, dosDate);
    const centralHeader = createCentralHeader(
      entry.nameBytes,
      entry.dataBytes.length,
      crc,
      dosTime,
      dosDate,
      offset,
    );

    localChunks.push(localHeader, entry.dataBytes);
    centralChunks.push(centralHeader);
    offset += localHeader.length + entry.dataBytes.length;
  }

  const centralDirectory = concatUint8Arrays(centralChunks);
  const localData = concatUint8Arrays(localChunks);
  const endRecord = createEndRecord(entries.length, centralDirectory.length, offset);

  return concatUint8Arrays([localData, centralDirectory, endRecord]);
}

function createLocalHeader(nameBytes, dataLength, crc, dosTime, dosDate) {
  const buffer = new ArrayBuffer(30 + nameBytes.length);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, dosTime, true);
  view.setUint16(12, dosDate, true);
  view.setUint32(14, crc >>> 0, true);
  view.setUint32(18, dataLength, true);
  view.setUint32(22, dataLength, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  bytes.set(nameBytes, 30);

  return bytes;
}

function createCentralHeader(nameBytes, dataLength, crc, dosTime, dosDate, localHeaderOffset) {
  const buffer = new ArrayBuffer(46 + nameBytes.length);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, dosTime, true);
  view.setUint16(14, dosDate, true);
  view.setUint32(16, crc >>> 0, true);
  view.setUint32(20, dataLength, true);
  view.setUint32(24, dataLength, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, localHeaderOffset, true);
  bytes.set(nameBytes, 46);

  return bytes;
}

function createEndRecord(entryCount, centralDirectorySize, centralDirectoryOffset) {
  const buffer = new ArrayBuffer(22);
  const view = new DataView(buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  view.setUint16(20, 0, true);

  return new Uint8Array(buffer);
}

function concatUint8Arrays(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

function buildCrcTable() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let current = index;

    for (let bit = 0; bit < 8; bit += 1) {
      current = (current & 1) === 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
    }

    table[index] = current >>> 0;
  }

  return table;
}

function crc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function getDosTime(date) {
  return (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
}

function getDosDate(date) {
  const year = Math.max(date.getFullYear(), 1980);
  return ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "generated-project";
}
