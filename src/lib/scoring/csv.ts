import { z } from "zod";
import type { Competitor, Role } from "@/lib/types";

const rowSchema = z.object({
  BibNumber: z.string().min(1),
  PreferredName: z.string().min(1),
  Role: z.enum(["Leader", "Follower"]),
  LegalFirstName: z.string().optional(),
  LegalLastName: z.string().optional()
});

export function parseCompetitorCsv(input: string): { competitors: Competitor[]; errors: string[] } {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { competitors: [], errors: ["CSV is empty."] };

  const headers = splitCsvLine(lines[0]);
  const errors: string[] = [];
  const seenBibs = new Set<string>();
  const competitors: Competitor[] = [];

  for (const [index, line] of lines.slice(1).entries()) {
    const cells = splitCsvLine(line);
    const row = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? ""]));
    const parsed = rowSchema.safeParse(row);

    if (!parsed.success) {
      errors.push(`Row ${index + 2}: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`);
      continue;
    }

    if (seenBibs.has(parsed.data.BibNumber)) {
      errors.push(`Row ${index + 2}: duplicate bib ${parsed.data.BibNumber}.`);
      continue;
    }

    seenBibs.add(parsed.data.BibNumber);
    competitors.push({
      id: `competitor-${parsed.data.BibNumber}`,
      bibNumber: parsed.data.BibNumber,
      preferredName: parsed.data.PreferredName,
      role: parsed.data.Role as Role,
      legalFirstName: parsed.data.LegalFirstName,
      legalLastName: parsed.data.LegalLastName
    });
  }

  return { competitors, errors };
}

export function toCsv(rows: Array<Record<string, string | number | undefined>>): string {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header] ?? "")).join(","))
  ].join("\n");
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
