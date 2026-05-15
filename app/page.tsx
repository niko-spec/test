"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";

// ─── Types ───────────────────────────────────────────────────
interface SearchEntry {
  name: string;
  category: string[];
  department: string[];
  symptom_count: number;
  drug_count: number;
}

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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── ECharts dynamic import type ─────────────────────────────
type EChartsInstance = {
  setOption: (option: Record<string, unknown>) => void;
  dispatchAction: (action: Record<string, unknown>) => void;
  resize: () => void;
  dispose: () => void;
  on: (event: string, handler: (params: Record<string, unknown>) => void) => void;
  off: (event: string, handler?: (params: Record<string, unknown>) => void) => void;
};

// ─── Color config ────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  department: "#4C6EF5",
  disease: "#E8590C",
  symptom: "#2F9E44",
  drug: "#9C36B5",
  check: "#1098AD",
  food_good: "#F08C00",
  food_bad: "#E03131",
};

const CATEGORY_LABELS: Record<string, string> = {
  department: "科室",
  disease: "疾病",
  symptom: "症状",
  drug: "药物",
  check: "检查",
  food_good: "宜食",
  food_bad: "忌食",
};

// Extended question tags for each disease
const EXTENDED_TAGS = [
  { label: "症状", question: "这个疾病的常见症状有哪些？" },
  { label: "患病人群", question: "哪些人群容易患这个疾病？" },
  { label: "相关药物", question: "治疗这个疾病的相关药物有哪些？" },
  { label: "检查项目", question: "需要做哪些检查来确诊？" },
  { label: "预防方法", question: "如何预防这个疾病？" },
  { label: "治疗方法", question: "这个疾病的治疗方法有哪些？" },
  { label: "饮食建议", question: "得了这个病在饮食上有什么注意事项？" },
  { label: "并发症", question: "这个疾病可能有哪些并发症？" },
];

export default function Home() {
  // ─── State ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchEntry[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState<DiseaseDetail | null>(null);
  const [diseaseName, setDiseaseName] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [kgLoading, setKgLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const chartRef = useRef<HTMLDivElement>(null);
  const echartsRef = useRef<EChartsInstance | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Initialize ECharts ─────────────────────────────────────
  useEffect(() => {
    let disposed = false;

    const initChart = async () => {
      const echarts = await import("echarts");
      if (disposed || !chartRef.current) return;

      const chart = echarts.init(chartRef.current, "dark") as unknown as EChartsInstance;
      echartsRef.current = chart;

      try {
        const res = await fetch("/api/kg");
        const graphData = await res.json();

        // Build adjacency map
        const adjMap: Record<string, string[]> = {};
        graphData.links.forEach((link: { source: string; target: string }) => {
          if (!adjMap[link.source]) adjMap[link.source] = [];
          if (!adjMap[link.target]) adjMap[link.target] = [];
          adjMap[link.source].push(link.target);
          adjMap[link.target].push(link.source);
        });

        const edgeColorMap: Record<string, string> = {
          所属科室: "#4C6EF5",
          症状: "#2F9E44",
          推荐药物: "#9C36B5",
          检查: "#1098AD",
          宜食: "#F08C00",
          忌食: "#E03131",
        };

        const option = {
          backgroundColor: "transparent",
          tooltip: {
            trigger: "item",
            backgroundColor: "rgba(15,23,42,0.95)",
            borderColor: "rgba(71,85,105,0.5)",
            textStyle: { color: "#F1F5F9", fontSize: 13 },
            formatter: (params: Record<string, unknown>) => {
              const dt = params.dataType as string;
              if (dt === "node") {
                const catNames = ["科室", "疾病", "症状", "药物", "检查", "宜食", "忌食"];
                const cat = catNames[(params.data as { category: number }).category] || "";
                const name = params.name as string;
                const connections = adjMap[name]?.length || 0;
                return `<b>${name}</b><br/>类型: ${cat}<br/>关联数: ${connections}`;
              } else if (dt === "edge") {
                const d = params.data as { source: string; target: string; value: string };
                return `${d.source} → ${d.target}<br/>关系: ${d.value}`;
              }
              return "";
            },
          },
          series: [
            {
              type: "graph",
              layout: "force",
              animation: true,
              animationDuration: 1200,
              animationEasingUpdate: "quinticInOut",
              data: graphData.nodes.map(
                (node: {
                  name: string;
                  category: number;
                  symbolSize: number;
                  itemStyle: { color: string };
                }) => ({
                  name: node.name,
                  category: node.category,
                  symbolSize: node.symbolSize,
                  label: {
                    show: node.symbolSize >= 30,
                    fontSize: node.category === 0 ? 12 : node.category === 1 ? 11 : 9,
                    color: "#E2E8F0",
                    fontWeight: node.category <= 1 ? "bold" : "normal",
                  },
                  itemStyle: {
                    color: node.itemStyle.color,
                    borderColor: "rgba(255,255,255,0.12)",
                    borderWidth: 1,
                    shadowBlur: 6,
                    shadowColor: node.itemStyle.color + "30",
                  },
                  emphasis: {
                    label: { show: true, fontSize: 13, fontWeight: "bold" as const },
                    itemStyle: {
                      borderColor: "#fff",
                      borderWidth: 2,
                      shadowBlur: 20,
                    },
                  },
                })
              ),
              links: graphData.links.map(
                (link: { source: string; target: string; value: string }) => ({
                  source: link.source,
                  target: link.target,
                  value: link.value,
                  lineStyle: {
                    color: edgeColorMap[link.value] || "#475569",
                    width: link.value === "所属科室" ? 2 : 0.8,
                    opacity: link.value === "所属科室" ? 0.5 : 0.25,
                    curveness: 0.1,
                  },
                })
              ),
              categories: graphData.categories.map(
                (cat: { name: string; itemStyle: { color: string } }) => ({
                  name: cat.name,
                  itemStyle: { color: cat.itemStyle.color },
                })
              ),
              force: {
                repulsion: 260,
                gravity: 0.08,
                edgeLength: [80, 200],
                friction: 0.6,
                layoutAnimation: true,
              },
              roam: true,
              draggable: true,
              focusNodeAdjacency: true,
              edgeSymbol: ["none", "arrow"],
              edgeSymbolSize: [0, 5],
              emphasis: {
                focus: "adjacency",
                lineStyle: { width: 2, opacity: 0.7 },
              },
              blur: {
                itemStyle: { opacity: 0.12 },
                lineStyle: { opacity: 0.04 },
              },
            },
          ],
        };

        chart.setOption(option);
        setKgLoading(false);

        // Click handler
        chart.on("click", (params: Record<string, unknown>) => {
          if ((params.dataType as string) === "node") {
            const cat = (params.data as { category: number }).category;
            if (cat === 1) {
              // Disease node
              handleSelectDisease(params.name as string);
            }
          }
        });
      } catch {
        setKgLoading(false);
      }
    };

    initChart();

    const handleResize = () => echartsRef.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", handleResize);
      echartsRef.current?.dispose();
    };
  }, []);

  // ─── Highlight node in KG ───────────────────────────────────
  const highlightNode = useCallback((name: string) => {
    if (!echartsRef.current) return;
    // First downplay all, then highlight target
    echartsRef.current.dispatchAction({ type: "downplay" });
    echartsRef.current.dispatchAction({
      type: "highlight",
      name,
    });
    // Show tooltip for the node
    echartsRef.current.dispatchAction({
      type: "showTip",
      seriesIndex: 0,
      name,
    });
  }, []);

  // ─── Search handler ────────────────────────────────────────
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);

      if (!query.trim()) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      searchTimeout.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          const data = await res.json();
          setSearchResults(data.results || []);
          setShowDropdown(data.results?.length > 0);
        } catch {
          setSearchResults([]);
        }
      }, 200);
    },
    []
  );

  // ─── Select disease ────────────────────────────────────────
  const handleSelectDisease = useCallback(
    async (name: string) => {
      setSearchQuery(name);
      setShowDropdown(false);
      setDiseaseName(name);
      setActiveTag(null);

      try {
        const res = await fetch(`/api/disease?name=${encodeURIComponent(name)}`);
        const data = await res.json();
        if (data.disease) {
          setSelectedDisease(data.disease);
          // Initialize chat with greeting
          setChatMessages([
            {
              role: "assistant",
              content: `您好！我是医学知识助手，已为您加载了**${name}**的知识图谱数据。\n\n您想询问有关${name}的什么问题？可以点击上方标签快速提问，也可以直接输入您的问题。`,
            },
          ]);
        }
      } catch {
        setSelectedDisease(null);
      }

      // Highlight in KG
      highlightNode(name);
    },
    [highlightNode]
  );

  // ─── Send chat message ──────────────────────────────────────
  const handleSendMessage = useCallback(
    async (message?: string) => {
      const text = message || chatInput.trim();
      if (!text || !diseaseName || chatLoading) return;

      setChatInput("");
      setChatLoading(true);
      setActiveTag(null);

      const userMsg: ChatMessage = { role: "user", content: text };
      setChatMessages((prev) => [...prev, userMsg]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            disease_name: diseaseName,
            question: text,
          }),
        });
        const data = await res.json();
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: data.answer || "抱歉，未能获取到回答。",
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const errorMsg: ChatMessage = {
          role: "assistant",
          content: "抱歉，请求出错了，请重试。",
        };
        setChatMessages((prev) => [...prev, errorMsg]);
      } finally {
        setChatLoading(false);
      }
    },
    [chatInput, diseaseName, chatLoading]
  );

  // ─── Auto-scroll chat ──────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F1F5F9] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1E293B] px-4 sm:px-6 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4C6EF5] to-[#9C36B5] flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <h1 className="text-lg font-bold tracking-wide hidden sm:block">
            医学知识图谱
          </h1>
        </div>

        {/* Search bar */}
        <div className="flex-1 max-w-xl relative">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() =>
                searchResults.length > 0 && setShowDropdown(true)
              }
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  handleSelectDisease(searchQuery.trim());
                }
              }}
              placeholder="搜索疾病，如：冠心病、糖尿病、肺炎..."
              className="w-full pl-10 pr-4 py-2 bg-[#1E293B] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#4C6EF5] focus:ring-1 focus:ring-[#4C6EF5] transition-colors"
            />
          </div>

          {/* Search dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-[#1E293B] border border-[#334155] rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
              {searchResults.map((item) => (
                <button
                  key={item.name}
                  onMouseDown={() => handleSelectDisease(item.name)}
                  className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-[#334155] transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS.disease }}
                    />
                    <span className="text-sm text-[#F1F5F9]">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-xs text-[#64748B]">
                    {item.department?.[0] || ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="hidden lg:flex items-center gap-3">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[key] }}
              />
              <span className="text-xs text-[#94A3B8]">{label}</span>
            </div>
          ))}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Knowledge Graph */}
        <div className="flex-1 relative min-h-[300px]">
          {kgLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0F172A] z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[#4C6EF5] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-[#94A3B8]">
                  加载知识图谱中...
                </span>
              </div>
            </div>
          )}
          <div ref={chartRef} className="w-full h-full" />

          {/* Info overlay for selected disease */}
          {selectedDisease && (
            <div className="absolute top-3 left-3 bg-[#1E293B]/90 backdrop-blur-md border border-[#334155] rounded-xl p-4 max-w-xs z-20 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-[#F1F5F9]">
                  {selectedDisease.name}
                </h3>
                <button
                  onClick={() => {
                    setSelectedDisease(null);
                    setDiseaseName("");
                    setChatMessages([]);
                    setSearchQuery("");
                    echartsRef.current?.dispatchAction({ type: "downplay" });
                  }}
                  className="text-[#64748B] hover:text-[#F1F5F9] transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {selectedDisease.department?.length > 0 && (
                <div className="flex items-center gap-1 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS.department }}
                  />
                  <span className="text-xs text-[#94A3B8]">
                    {selectedDisease.department.join(" / ")}
                  </span>
                </div>
              )}
              {selectedDisease.symptom?.length > 0 && (
                <div className="flex items-center gap-1 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS.symptom }}
                  />
                  <span className="text-xs text-[#94A3B8]">
                    {selectedDisease.symptom.slice(0, 5).join("、")}
                    {selectedDisease.symptom.length > 5 ? "..." : ""}
                  </span>
                </div>
              )}
              <p className="text-xs text-[#64748B] mt-2 leading-relaxed line-clamp-3">
                {selectedDisease.desc?.slice(0, 120)}...
              </p>
            </div>
          )}
        </div>

        {/* Chat Panel */}
        <div className="w-full lg:w-[420px] border-t lg:border-t-0 lg:border-l border-[#1E293B] flex flex-col bg-[#0F172A] shrink-0 max-h-[50vh] lg:max-h-none">
          {/* Chat header */}
          <div className="px-4 py-3 border-b border-[#1E293B] shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#4C6EF5] to-[#9C36B5] flex items-center justify-center">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <span className="text-sm font-medium">
                {diseaseName
                  ? `${diseaseName} - 智能问答`
                  : "医学智能问答"}
              </span>
            </div>

            {/* Extended question tags */}
            {diseaseName && (
              <div className="flex flex-wrap gap-1.5">
                {EXTENDED_TAGS.map((tag) => (
                  <button
                    key={tag.label}
                    onClick={() => {
                      setActiveTag(tag.label);
                      handleSendMessage(tag.question);
                    }}
                    disabled={chatLoading}
                    className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                      activeTag === tag.label
                        ? "bg-[#4C6EF5] text-white"
                        : "bg-[#1E293B] text-[#94A3B8] hover:bg-[#334155] hover:text-[#F1F5F9] border border-[#334155]"
                    } disabled:opacity-50`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
            {!diseaseName && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="w-16 h-16 rounded-full bg-[#1E293B] flex items-center justify-center mb-4">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#4C6EF5"
                    strokeWidth="1.5"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-[#64748B] mb-1">
                  搜索并选择一个疾病
                </p>
                <p className="text-xs text-[#475569]">
                  在上方搜索框输入疾病名称，或在知识图谱中点击疾病节点
                </p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#4C6EF5] text-white rounded-br-md"
                      : "bg-[#1E293B] text-[#E2E8F0] rounded-bl-md border border-[#334155]"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2 [&>li]:mb-0.5">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-[#1E293B] border border-[#334155] rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-[#4C6EF5] rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 bg-[#4C6EF5] rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 bg-[#4C6EF5] rounded-full animate-bounce" />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="px-4 py-3 border-t border-[#1E293B] shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  diseaseName
                    ? `询问有关${diseaseName}的问题...`
                    : "请先选择一个疾病"
                }
                disabled={!diseaseName || chatLoading}
                className="flex-1 px-4 py-2 bg-[#1E293B] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#4C6EF5] disabled:opacity-50 transition-colors"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!diseaseName || chatLoading || !chatInput.trim()}
                className="px-3 py-2 bg-[#4C6EF5] text-white rounded-lg hover:bg-[#3B5BD6] disabled:opacity-50 disabled:hover:bg-[#4C6EF5] transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m22 2-7 20-4-9-9-4zM22 2 11 13" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
