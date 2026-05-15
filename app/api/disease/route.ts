import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface DiseaseDetail {
  name: string;
  desc: string;
  category: string[];
  department: string[];
  symptom: string[];
  cause: string;
  prevent: string;
  cure_way: string;
  cure_lasttime: string;
  cured_prob: string;
  common_drug: string[];
  recommand_drug: string[];
  check: string[];
  do_eat: string[];
  not_eat: string[];
  acompany: string[];
  easy_get: string;
  get_way: string;
  cost_money: string;
}

let diseaseDetails: Record<string, DiseaseDetail> | null = null;

function getDiseaseDetails(): Record<string, DiseaseDetail> {
  if (!diseaseDetails) {
    const filePath = path.join(
      process.cwd(),
      "src/data/disease_details.json"
    );
    const raw = fs.readFileSync(filePath, "utf-8");
    diseaseDetails = JSON.parse(raw);
  }
  return diseaseDetails!;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim() || "";

  if (!name) {
    return NextResponse.json({ error: "Missing disease name" }, { status: 400 });
  }

  const details = getDiseaseDetails();
  const disease = details[name];

  if (!disease) {
    return NextResponse.json({ error: "Disease not found" }, { status: 404 });
  }

  return NextResponse.json({ disease });
}
