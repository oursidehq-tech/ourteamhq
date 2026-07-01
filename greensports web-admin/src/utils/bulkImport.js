import * as XLSX from "xlsx";

const normalizeHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const normalizeRow = (row) => {
  const normalized = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    const normalizedKey = normalizeHeader(key);
    if (!normalizedKey) return;
    normalized[normalizedKey] =
      typeof value === "string" ? value.trim() : value ?? "";
  });
  return normalized;
};

export const parseImportFile = async (file) => {
  if (!file) return { rows: [], errors: ["No file provided."] };

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) return { rows: [], errors: ["No worksheet found."] };

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });

  const rows = rawRows.map(normalizeRow).filter((row) => Object.keys(row).length);
  return { rows, errors: [] };
};

export const downloadCsvTemplate = (filename, headers) => {
  const line = Array.isArray(headers) ? headers.join(",") : "";
  const blob = new Blob([`${line}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
