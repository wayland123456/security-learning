// Supabase Edge Function: score
// POST { title, content, question, essayType }
//   essayType = "applied"      应用文写作 15 分（五档 13-15 / 10-12 / 7-9 / 4-6 / 0-3）
//   essayType = "continuation" 读后续写   25 分（五档 21-25 / 16-20 / 11-15 / 6-10 / 0-5）
// 调用通义千问 qwen-plus（DashScope 兼容 OpenAI 格式），返回结构化 JSON。
//
// 鉴权：只认 login 函数签发的教师令牌；平台层 Verify JWT 保持 Disable。
// Key：只从 Edge Function Secrets 读 DASHSCOPE_API_KEY，禁止写进代码或仓库。

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { verifyTeacherOrStudent } from "../_shared/auth.ts";

const DASHSCOPE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const getDashKey = () => Deno.env.get("DASHSCOPE_API_KEY") || "";

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/* ====================================================================
 * 两套评分标准
 * ==================================================================== */

const RUBRIC_APPLIED = `【高考英语应用文写作 15 分 · 五档评分标准】

【第五档 13–15 分】完全完成试题规定的任务
· 覆盖全部内容要点，并有适当的细节扩展
· 词汇和语法结构多样、准确，仅有个别不影响理解的小错
· 格式规范（书信有称呼与落款，通知有标题与署名），语域得体
· 行文连贯，衔接手段自然，完全达到交际目的

【第四档 10–12 分】较好完成试题规定的任务
· 覆盖主要要点，个别次要要点缺失
· 词汇语法基本准确，少量错误但不影响理解
· 格式基本正确，连贯性较好

【第三档 7–9 分】基本完成试题规定的任务
· 遗漏部分要点，或要点表述不清
· 词汇语法错误较多，但基本能表达意思
· 格式有缺漏，连贯性一般

【第二档 4–6 分】未恰当完成试题规定的任务
· 只覆盖少数要点，或要点严重偏离
· 语言错误多，影响理解
· 格式错误明显，缺乏连贯

【第一档 0–3 分】未完成试题规定的任务
· 跑题、抄袭题干、只写零散词句、或基本无法理解
· 空白卷 0 分

【硬性扣分规则（必须执行，并在 deductions 中逐条列出）】
1. 要点缺失：题目要求 3 个要点，缺 1 个扣 3–4 分；缺 2 个及以上 → 总分直接压到 6 分以下（不得判第四档及以上）
2. 格式语域：书信无称呼或无落款、时态混用、语气与对象不符 → 扣 1–2 分
3. 语言错误密度：主谓不一致、时态错乱、固定搭配错误、高频词拼写错误，累计每 3 处 → 降一档
4. 词数：不足 60 词扣 2–3 分；不足 40 词直接判低档（≤6 分）
5. 超字数不扣分，但超出的部分若有语言错误仍照常扣分

【维度拆分（合计满分 15）】
· 内容要点 6 分：三个要点是否齐全、具体到位
· 语言准确 5 分：词汇丰富度、语法正确率、句式多样性
· 篇章连贯 2 分：连接词使用、句间段落逻辑
· 格式语域 2 分：格式是否规范、语域是否得体`;

const RUBRIC_CONTINUATION = `【高考英语读后续写 25 分 · 五档评分标准】

【第五档 21–25 分】与原文高度衔接，情节与语言俱佳
· 情节与原文逻辑严密衔接，人物性格、时空线索一致，有合理起伏与冲突解决
· 词汇语法丰富准确，句式多样（含非谓语、定语从句、倒装、强调等高级结构）
· 有具体的动作、心理、环境细节描写，画面感强
· 两段之间过渡自然，结尾有情感升华或主题收束
· 两段合计约 150 词

【第四档 16–20 分】衔接较好，情节合理
· 情节与原文基本一致，逻辑通顺，但起伏不足或细节较少
· 语言表达较准确，有一定句式变化，少量错误
· 有细节但不够生动，结尾有一定收束

【第三档 11–15 分】基本衔接，情节尚可
· 情节能与原文勉强衔接，存在小的逻辑跳跃
· 词汇语法错误较多，句式单一
· 细节描写薄弱，结尾平淡或无升华

【第二档 6–10 分】衔接差，情节平淡
· 情节与原文脱节，或平铺直叙无起伏
· 语言错误多，影响理解
· 几乎没有细节描写

【第一档 0–5 分】与原文脱节或无法理解
· 跑题、抄袭原文、只写零散词句、或基本无法理解
· 空白卷 0 分

【硬性扣分规则（必须执行，并在 deductions 中逐条列出）】
1. 情节断层 / 人物性格崩塌（人设与原文矛盾）/ 明显逻辑矛盾 → 直接降 2 档
2. 只写一段，或两段严重失衡（一段明显过短）→ 扣 5–8 分
3. 未接续所给段落开头语、或大段照抄原文 → 降档处理
4. 词数：两段合计不足 100 词 → 直接降一档；150 词左右为佳，超出不扣分
5. 时态混乱（叙事主体时态不一致，过去时与现在时随意切换）→ 降一档

【冲满分三条件（给 21 分以上必须逐条说明是否满足）】
① 高级句式：非谓语动词、定语从句、倒装、强调句、独立主格等至少 3 处
② 细节描写：动作 / 心理 / 环境描写具体可感
③ 结尾升华：结尾有情感或主题的升华，且不生硬

【维度拆分（合计满分 25）】
· 情节逻辑 8 分：与原文衔接、情节合理性、有无断层与矛盾
· 语言表达 8 分：词汇准确丰富、句式多样与高级结构使用
· 衔接连贯 5 分：两段之间与段内的过渡、指代与连接
· 结尾升华 4 分：结尾是否收束主题、有情感深度`;

const SCHEMA_BLOCK = `【输出 JSON 格式】（只输出一个 JSON 对象，禁止任何前后缀解释或 Markdown 代码块）
{
  "type": "$TYPE",
  "maxScore": $MAX,
  "tier": "<档位全称，如：第五档（13-15分）>",
  "tierIndex": <5 到 1 的整数>,
  "total": <总分 0-$MAX，已含硬性扣分>,
  "tierReason": "<100-200 字。先说明判为这一档的依据（对照五档描述的哪几条），再说明为什么不是上一档、为什么不是下一档。总分高于 $HIGHLINE 时必须逐条说明为何够高档>",
  "dimensions": [
    $DIMENSIONS
  ],
  "deductions": [
    {"item": "<扣分项，如：缺少要点2（比赛主题）>", "points": <负数，如 -3>}
  ],
  "summary": "<一句话核心评价，30-60 字，给学生看的>",
  "highlights": ["<亮点1>", "<亮点2>", "<亮点3>"],
  "polish_examples": [
    {
      "original": "<学生原文原句，必须能在原文中找到>",
      "issue": "<这句的具体毛病，10-25 字>",
      "polished": "<升格示范：英语原句 + 中文说明，换上就能用>",
      "technique": "<改写手法，如：非谓语作状语 / 定语从句 / 倒装 / 细节描写>",
      "gain": "<换上可多得几分，如 +1~2 分>"
    }
  ],
  "gain_plan": [
    {"step": 1, "task": "<具体修改动作>", "expected": "<预期提分，如 +2~3 分>", "difficulty": "简单/中等/困难"}
  ],
  "issues": [
    {"title": "<问题小标题>", "body": "<问题描述，含原文例证>", "gain": "<修好可多得几分>"}
  ],
  "suggestions": ["<可操作短建议1>", "<建议2>", "<建议3>"]
}`;

const DIMS_APPLIED = `{"name":"内容要点","score":0,"max":6,"reason":"<三个要点各自覆盖情况>"},
    {"name":"语言准确","score":0,"max":5,"reason":"<词汇/语法/句式的具体表现>"},
    {"name":"篇章连贯","score":0,"max":2,"reason":"<衔接手段与逻辑>"},
    {"name":"格式语域","score":0,"max":2,"reason":"<格式与语域是否得体>"}`;

const DIMS_CONTINUATION = `{"name":"情节逻辑","score":0,"max":8,"reason":"<与原文衔接、情节合理性>"},
    {"name":"语言表达","score":0,"max":8,"reason":"<词汇与句式，指出高级结构有无>"},
    {"name":"衔接连贯","score":0,"max":5,"reason":"<两段过渡与段内衔接>"},
    {"name":"结尾升华","score":0,"max":4,"reason":"<结尾是否收束主题>"}`;

interface TypeMeta { name: string; max: number; high: number; dims: string }
const ESSAY_META: Record<string, TypeMeta> = {
  applied: { name: "应用文写作", max: 15, high: 13, dims: DIMS_APPLIED },
  continuation: { name: "读后续写", max: 25, high: 20, dims: DIMS_CONTINUATION },
};

const SYSTEM_PROMPT = `你是一位资深高考英语阅卷老师，严格按【评分标准】给学生的英语作文打分。必须只输出一个 JSON 对象，禁止任何前后缀解释或 Markdown 代码块。

【核心纪律】
1. 先把学生原文完整读一遍（含拼写、标点、分段），再动笔评分，不许边看边猜。
2. 五档是硬边界：只能给档内的分数，档内最多 ±1 分浮动，绝对不许跨档给分。
3. 拿不准档次时，一律往下压一档 —— 给低了可以解释，给高了改不回来。
4. 总分必须等于 dimensions 各项之和，再叠加 deductions 里的扣分；算不通就重算。
5. 引用原文必须真实存在，不许编造学生没写过的句子。
6. 升格示范要给「换上就能用」的英语原句，不许写"可考虑使用更高级的词汇"这类空话。`;

function buildUserText(
  type: string,
  title: string,
  content: string,
  question: string,
): string {
  const m = ESSAY_META[type];
  const rubric = type === "applied" ? RUBRIC_APPLIED : RUBRIC_CONTINUATION;
  const schema = SCHEMA_BLOCK
    .replace(/\$TYPE/g, type)
    .replace(/\$MAX/g, String(m.max))
    .replace(/\$HIGHLINE/g, String(m.high))
    .replace("$DIMENSIONS", m.dims);

  return `${rubric}

${schema}

【补充要求】
· 总分高于 ${m.high} 分时，tierReason 必须逐条说明为什么够高档，否则退回下一档。
· deductions 没有扣分项就给空数组 []，不要编造扣分。
· polish_examples 至少 3 条，polished 字段要给完整英文原句，中文说明放括号里。
· gain_plan 至少 4 条，按性价比从高到低；issues 至少 3 条。

【作文题目 / 要求】
${question || title || "（未提供，按通用标准评）"}

【学生作文原文】
${content}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return jsonResp({ error: "仅支持 POST" }, 405);
  }

  const auth = await verifyTeacherOrStudent(req);
  if (!auth.ok) {
    return jsonResp({ error: auth.error }, auth.status || 401);
  }

  const apiKey = getDashKey();
  if (!apiKey) {
    return jsonResp(
      { error: "服务端未配置 DASHSCOPE_API_KEY，请在 Supabase 项目 Secrets 中设置后重新部署" },
      500,
    );
  }

  let payload: {
    title?: string;
    content?: string;
    question?: string;
    essayType?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResp({ error: "请求体不是合法 JSON" }, 400);
  }

  const type = payload.essayType === "continuation" ? "continuation" : "applied";
  const m = ESSAY_META[type];
  const title = (payload.title || "").trim();
  const content = (payload.content || "").trim();
  const question = (payload.question || "").trim();

  if (!content) {
    return jsonResp({ error: "缺少作文正文 content" }, 400);
  }

  // 成本护栏：一篇英语作文正常几百词，超过 12000 字符基本可断定不是正常批改请求
  if (content.length > 12000 || question.length > 12000 || title.length > 300) {
    return jsonResp({ error: "内容超出单次批改上限（正文/题目各 12000 字符）" }, 413);
  }

  const body = {
    model: "qwen-plus",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserText(type, title, content, question) },
    ],
    temperature: 0.5,
    top_p: 0.85,
    response_format: { type: "json_object" },
  };

  let dashResp: Response;
  try {
    dashResp = await fetch(DASHSCOPE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return jsonResp({ error: `调用 DashScope 失败: ${(err as Error).message}` }, 502);
  }

  const text = await dashResp.text();
  if (!dashResp.ok) {
    return jsonResp(
      { error: `DashScope 返回 ${dashResp.status}`, detail: text.slice(0, 1000) },
      dashResp.status,
    );
  }

  let data: {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: Record<string, number>;
  };
  try {
    data = JSON.parse(text);
  } catch {
    return jsonResp({ error: "DashScope 返回不是 JSON", detail: text.slice(0, 500) }, 502);
  }

  let rawResult = (data?.choices?.[0]?.message?.content || "").trim();
  if (!rawResult) {
    return jsonResp({ error: "评分模型无输出", raw: data }, 502);
  }

  // 模型偶有不严格 JSON，剥掉 ```json 包裹
  const fenced = rawResult.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) rawResult = fenced[1].trim();

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(rawResult) as Record<string, unknown>;
  } catch {
    return jsonResp({
      type,
      maxScore: m.max,
      total: 0,
      tier: "未评定",
      tierIndex: 0,
      tierReason: "评分模型未输出严格 JSON，已降级展示原文",
      dimensions: [],
      deductions: [],
      summary: rawResult.slice(0, 500),
      highlights: [],
      polish_examples: [],
      gain_plan: [],
      issues: [],
      suggestions: [],
      _raw: true,
    });
  }

  const tierIndex = Number(obj.tierIndex) || 0;
  return jsonResp({
    type,
    maxScore: Number(obj.maxScore) || m.max,
    total: Number(obj.total) || 0,
    tier: String(obj.tier || "未评定"),
    tierIndex,
    tierReason: String(obj.tierReason || ""),
    dimensions: Array.isArray(obj.dimensions) ? obj.dimensions : [],
    deductions: Array.isArray(obj.deductions) ? obj.deductions : [],
    summary: String(obj.summary || ""),
    highlights: Array.isArray(obj.highlights) ? obj.highlights : [],
    polish_examples: Array.isArray(obj.polish_examples) ? obj.polish_examples : [],
    gain_plan: Array.isArray(obj.gain_plan) ? obj.gain_plan : [],
    issues: Array.isArray(obj.issues) ? obj.issues : [],
    suggestions: Array.isArray(obj.suggestions) ? obj.suggestions : [],
    usage: data.usage || {},
  });
});
