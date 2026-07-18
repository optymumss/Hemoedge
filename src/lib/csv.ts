function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}
