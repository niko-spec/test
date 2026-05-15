import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import ZAI from "z-ai-web-dev-sdk";

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { disease_name, question } = body;

    if (!disease_name || !question) {
      return NextResponse.json(
        { error: "Missing disease_name or question" },
        { status: 400 }
      );
    }

    // Get disease details
    const details = getDiseaseDetails();
    const disease = details[disease_name];

    // Build context from knowledge graph data
    let context = "";
    if (disease) {
      context = `疾病名称：${disease.name}
疾病描述：${disease.desc || "暂无"}
所属科室：${disease.department?.join("、") || "暂无"}
常见症状：${disease.symptom?.join("、") || "暂无"}
发病原因：${disease.cause || "暂无"}
预防方法：${disease.prevent || "暂无"}
治疗方法：${disease.cure_way || "暂无"}
治疗周期：${disease.cure_lasttime || "暂无"}
治愈概率：${disease.cured_prob || "暂无"}
常用药物：${disease.common_drug?.join("、") || "暂无"}
推荐药物：${disease.recommand_drug?.join("、") || "暂无"}
检查项目：${disease.check?.join("、") || "暂无"}
宜吃食物：${disease.do_eat?.join("、") || "暂无"}
忌吃食物：${disease.not_eat?.join("、") || "暂无"}
并发症：${disease.acompany?.join("、") || "暂无"}
易感人群：${disease.easy_get || "暂无"}
传染方式：${disease.get_way || "暂无"}
治疗费用：${disease.cost_money || "暂无"}`;
    } else {
      context = `未找到"${disease_name}"的详细医学数据，请基于通用医学知识回答。`;
    }

    // Use z-ai-web-dev-sdk for AI chat
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `你是一个专业的医学知识助手。你基于以下医学知识图谱数据来回答用户关于疾病的问题。请用专业但易懂的中文回答，结构清晰，条理分明。如果数据中没有相关信息，请如实说明。

以下是该疾病的详细医学知识：

${context}`,
        },
        {
          role: "user",
          content: question,
        },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const answer =
      completion.choices?.[0]?.message?.content || "抱歉，未能获取到回答。";

    return NextResponse.json({ answer });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
