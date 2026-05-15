import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface SearchEntry {
  name: string;
  category: string[];
  department: string[];
  symptom_count: number;
  drug_count: number;
}

let searchIndex: SearchEntry[] | null = null;

function getSearchIndex(): SearchEntry[] {
  if (!searchIndex) {
    const filePath = path.join(process.cwd(), "src/data/search_index.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    searchIndex = JSON.parse(raw);
  }
  return searchIndex!;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const index = getSearchIndex();
  const lowerQuery = query.toLowerCase();

  // Priority: exact match > starts with > contains
  const exactMatches = index.filter(
    (d) => d.name.toLowerCase() === lowerQuery
  );
  const startsWithMatches = index.filter(
    (d) =>
      d.name.toLowerCase().startsWith(lowerQuery) &&
      !exactMatches.includes(d)
  );
  const containsMatches = index.filter(
    (d) =>
      d.name.toLowerCase().includes(lowerQuery) &&
      !exactMatches.includes(d) &&
      !startsWithMatches.includes(d)
  );

  // Also search by symptom keyword in department
  const deptMatches = index.filter(
    (d) =>
      d.department.some((dept) => dept.toLowerCase().includes(lowerQuery)) &&
      !exactMatches.includes(d) &&
      !startsWithMatches.includes(d) &&
      !containsMatches.includes(d)
  );

  const results = [
    ...exactMatches,
    ...startsWithMatches,
    ...containsMatches,
    ...deptMatches,
  ].slice(0, 20);

  return NextResponse.json({ results });
}
