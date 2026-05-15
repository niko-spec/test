import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

let graphData: object | null = null;

function getGraphData() {
  if (!graphData) {
    const filePath = path.join(process.cwd(), "src/data/kg_graph.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    graphData = JSON.parse(raw);
  }
  return graphData;
}

export async function GET() {
  const data = getGraphData();
  return NextResponse.json(data);
}
