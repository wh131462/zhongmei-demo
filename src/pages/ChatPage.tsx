import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Database, Pen, FileText, Trash2,
  ChevronDown, Loader2, Square, RotateCcw, Copy, Check, X,
  Presentation, ChevronLeft, ChevronRight, Maximize2,
  Upload, Download, Eye, FileEdit, Save, Printer,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Type,
  FileUp, Sparkles, BookOpen
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { message, Modal } from 'antd';
import { parseFile } from '../services/fileParserService';
import { getAllKnowledgeBases, buildPromptWithRAG } from '../services/knowledgeBaseService';
import { buildRAGFlowPrompt } from '../services/ragflowService';
import type { KnowledgeBase } from '../types';

/* ============================== 配置与数据 ============================== */

const API_CONFIG = {
  url: 'http://183.252.196.133:38000/v1/chat/completions',
  key: 'sk-ycd03E09f7cG1',
  model: 'yantronic-o1-mini',
};

const BASE_SYSTEM_PROMPT = '你是由言创智信（北京）信息科技有限公司开发的AI助手，基于 yantronic-o1-mini 模型。';

interface WritingMode {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  prompt: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

const writingModes: WritingMode[] = [
  {
    id: 'normal',
    name: '普通对话',
    description: '正常的AI对话模式',
    systemPrompt: '',
  },
  {
    id: 'quick_writing',
    name: '快速写作',
    description: '使用模板快速生成内容',
    systemPrompt: '你是一个专业的写作助手，请根据用户选择的模板和输入的内容，生成高质量的文本。',
  },
];

// 写作风格列表 - 用于在快速写作模式下追加到提示词
interface WritingStyle {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

const writingStyles: WritingStyle[] = [
  {
    id: 'none',
    name: '默认风格',
    description: '不添加额外风格要求',
    prompt: '',
  },
  {
    id: 'formal',
    name: '正式公文',
    description: '严谨、正式的公文写作风格',
    prompt: '请使用正式、严谨的公文写作风格。语言要规范、用词准确、逻辑清晰，符合公文写作规范。',
  },
  {
    id: 'creative',
    name: '创意写作',
    description: '富有创意和文学性的表达',
    prompt: '请使用富有创意和文学性的风格。可以适当使用修辞手法、比喻、排比等，让文字生动有感染力。',
  },
  {
    id: 'concise',
    name: '简洁精炼',
    description: '言简意赅，直击要点',
    prompt: '请用最简洁的语言回复，直击要点，不要废话。每个要点用一句话概括，使用列表或编号格式。',
  },
  {
    id: 'explain',
    name: '详细解释',
    description: '深入浅出，循序渐进',
    prompt: '请用深入浅出的方式详细解释，可以举例说明，确保即使是非专业人士也能理解。分步骤、分层次讲解。',
  },
];

const promptTemplates: PromptTemplate[] = [
  { id: '1', category: '写作', name: '撰写工作总结', prompt: '请帮我撰写一份关于【主题】的工作总结，要求包含工作概述、主要成果、存在的问题和下一步计划。' },
  { id: '2', category: '写作', name: '起草通知公告', prompt: '请帮我起草一份关于【事项】的通知，要求格式规范、内容清晰、语言正式。' },
  { id: '3', category: '写作', name: '撰写会议纪要', prompt: '请根据以下会议内容要点，撰写一份会议纪要：\n参会人员：\n会议主题：\n讨论内容：\n决议事项：' },
  { id: '4', category: '分析', name: '分析数据报告', prompt: '请帮我分析以下数据，并给出关键发现和建议：\n【粘贴数据】' },
  { id: '5', category: '分析', name: 'SWOT分析', prompt: '请对【主题/项目】进行SWOT分析，包括优势(Strengths)、劣势(Weaknesses)、机会(Opportunities)和威胁(Threats)。' },
  { id: '6', category: '沟通', name: '回复客户邮件', prompt: '请帮我回复以下客户邮件，要求语气专业、态度友好：\n客户原文：【粘贴邮件内容】' },
  { id: '7', category: '沟通', name: '编写项目提案', prompt: '请帮我编写一份关于【项目名称】的提案，包括项目背景、目标、实施方案、时间计划和预算估算。' },
  { id: '8', category: '效率', name: '代码审查', prompt: '请审查以下代码，指出潜在问题并给出改进建议：\n```\n【粘贴代码】\n```' },
  { id: '9', category: '效率', name: '翻译润色', prompt: '请将以下内容翻译为【目标语言】，并进行适当润色使其更地道自然：\n【粘贴原文】' },
  { id: '10', category: '效率', name: '提炼摘要', prompt: '请将以下长文提炼为一段200字以内的摘要，保留核心观点：\n【粘贴原文】' },
];

/* ============================== PPT工具配置 ============================== */

const PPT_SYSTEM_PROMPT = `你是一个专业的PPT设计师。用户会给你一个主题，你需要根据主题性质选择合适的设计风格，生成专业的HTML格式PPT。

## 风格选择原则（最重要）

**首先判断主题类型，选择匹配的设计风格：**

| 主题类型 | 设计风格 | 配色 | 装饰程度 |
|---------|---------|------|---------|
| 商务报告、工作汇报 | 简洁专业 | 深蓝/灰白/藏青 | 少量几何装饰 |
| 教育培训、知识分享 | 清晰易读 | 蓝绿/浅色系 | 适度图标辅助 |
| 产品发布、营销推广 | 现代活力 | 品牌色/渐变 | 丰富视觉元素 |
| 技术方案、架构设计 | 简约精准 | 冷色调/白底 | 最少装饰，重内容 |
| 年度总结、成果展示 | 大气稳重 | 金色点缀/深色底 | 数据可视化为主 |
| 创意提案、品牌策划 | 设计感强 | 大胆配色/渐变 | 可以丰富 |

**核心原则：风格服务于内容，而非喧宾夺主。**

## 关键技术要求（必须严格遵守）

1. **CSS渐变语法必须完整**：写 \`linear-gradient(135deg, ...)\`，不能漏写成 \`linear135deg\` 或其他错误形式
2. **所有CSS函数必须包含完整的函数名和括号**：linear-gradient()、radial-gradient()、rgba()、translate()、blur() 等
3. **HTML标签必须正确闭合**：每个 \`<div>\` 都有对应 \`</div>\`，每个 \`<svg>\` 都有对应 \`</svg>\`
4. **在输出每页PPT前，先在脑中检查CSS语法正确性**

重要：PPT基于1920x1080分辨率(16:9)设计，所有尺寸按此标准。

请严格按照以下格式输出PPT内容，每一页用 ===SLIDE=== 分隔：

===SLIDE===
<div style="width: 1920px; height: 1080px; background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); position: relative; overflow: hidden; padding: 80px; box-sizing: border-box;">
  <!-- 简洁装饰（可选） -->
  <div style="position: absolute; bottom: 80px; left: 80px; width: 120px; height: 3px; background: rgba(255,255,255,0.2);"></div>
  <!-- 内容区域 -->
  <div style="position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
    <h1 style="color: white; font-size: 80px; text-align: center; margin-bottom: 24px; font-weight: 700; letter-spacing: -1px;">标题</h1>
    <p style="color: rgba(255,255,255,0.85); font-size: 32px; text-align: center; font-weight: 400;">副标题或描述</p>
  </div>
</div>
===SLIDE===

## 设计原则

### 1. 页面布局类型（必须交替使用，避免单调）

**封面页** - 居中大标题 + 副标题 + 装饰圆形
**目录页** - 左侧大标题 + 右侧编号列表
**内容页A** - 顶部标题 + 下方2-3个卡片并排
**内容页B** - 左右分栏（左侧标题描述，右侧要点列表）
**数据页** - 大数字突出显示 + 说明文字
**时间线页** - 横向或纵向时间节点
**对比页** - 左右两栏对比
**总结页** - 核心要点 + 行动号召

### 2. 装饰元素（根据主题适度使用）

**使用原则**：
- 商务/技术类：少用或不用装饰，保持简洁
- 教育/培训类：可用简单几何元素辅助
- 营销/创意类：可适当丰富

**可选装饰**（不是必须）：
- 半透明圆形: \`<div style="position: absolute; top: -100px; right: -100px; width: 400px; height: 400px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>\`
- 简洁线条: \`<div style="position: absolute; bottom: 80px; left: 80px; width: 120px; height: 3px; background: rgba(255,255,255,0.2);"></div>\`
- 角落点缀: \`<div style="position: absolute; top: 60px; right: 60px; width: 8px; height: 8px; background: rgba(255,255,255,0.4); border-radius: 50%;"></div>\`

**避免**：过多圆形堆叠、大面积光晕、与内容抢夺注意力的装饰

### 3. 卡片组件示例（使用SVG图标）

\`\`\`html
<div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 24px; padding: 40px; border: 1px solid rgba(255,255,255,0.2); width: 500px;">
  <div style="width: 56px; height: 56px; background: rgba(255,255,255,0.2); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  </div>
  <h3 style="color: white; font-size: 32px; margin-bottom: 16px; font-weight: 700;">卡片标题</h3>
  <p style="color: rgba(255,255,255,0.8); font-size: 22px; line-height: 1.6;">卡片描述内容</p>
</div>
\`\`\`

### 4. 数字突出显示

\`\`\`html
<div style="text-align: center;">
  <span style="font-size: 120px; font-weight: 800; background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">98%</span>
  <p style="color: rgba(255,255,255,0.8); font-size: 28px; margin-top: 16px;">客户满意度</p>
</div>
\`\`\`

### 5. 配色方案（按主题类型选择）

**商务/专业场景（首选）**：
- 经典深蓝: \`linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)\` - 稳重可信
- 商务灰: \`linear-gradient(135deg, #2d3748 0%, #4a5568 100%)\` - 低调专业
- 极简白底: \`#f8fafc\` 或 \`#ffffff\` 配合深色文字 - 清晰易读

**教育/培训场景**：
- 学术蓝: \`linear-gradient(135deg, #3182ce 0%, #2b6cb0 100%)\` - 清晰专注
- 自然绿: \`linear-gradient(135deg, #276749 0%, #48bb78 100%)\` - 清新舒适
- 浅色底: \`#f0f4f8\` 配合深色文字 - 减少视觉疲劳

**产品/营销场景**：
- 活力橙: \`linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)\` - 吸引注意
- 科技紫: \`linear-gradient(135deg, #667eea 0%, #764ba2 100%)\` - 创新现代
- 品牌红: \`linear-gradient(135deg, #e53e3e 0%, #c53030 100%)\` - 热情有力

**技术/方案场景**：
- 代码深色: \`linear-gradient(135deg, #1a202c 0%, #2d3748 100%)\` - 技术感
- 简约白: \`#ffffff\` 配合蓝色强调 - 聚焦内容

**选择原则：宁可保守，不要花哨。不确定时选深蓝或白底。**

### 6. 字体规范

- 封面标题: 80-96px, font-weight: 800, letter-spacing: -2px
- 页面标题: 56-64px, font-weight: 700
- 副标题: 32-40px, font-weight: 400
- 正文: 24-28px, line-height: 1.8
- 强调数字: 80-120px, font-weight: 800
- 添加 text-shadow 增加层次感

### 7. SVG图标（禁止emoji，可自由创建）

图标容器样式：\`<div style="width: 56px; height: 56px; background: rgba(255,255,255,0.2); border-radius: 16px; display: flex; align-items: center; justify-content: center;">\`

SVG基础格式：\`<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">...</svg>\`

**参考示例**（可根据内容主题自由创建更合适的SVG图标）：
- 闪电: \`<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>\`
- 火箭: \`<path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>\`
- 灯泡: \`<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>\`
- 目标: \`<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>\`
- 图表: \`<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>\`
- 盾牌: \`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>\`
- 用户: \`<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>\`
- 奖杯: \`<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/><path d="M4 22h16"/>\`
- 星星: \`<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>\`
- 对勾: \`<polyline points="20 6 9 17 4 12"/>\`
- 箭头上升: \`<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>\`

你可以根据PPT主题自由创建语义相关的简洁SVG图标，使用基本形状（circle、rect、path、polyline、polygon、line）组合。

### 8. CSS语法规范（严格遵守）

**渐变写法必须完整**：
- 正确：\`background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\`
- 错误：\`background: linear135deg, #667eea 0%, #764ba2 100%);\` ❌ 缺少-gradient(
- 错误：\`background: linear-gradient135deg, ...);\` ❌ 格式混乱

**特殊字符必须转义**（在HTML属性中）：
- 大于号用 \`&gt;\`
- 小于号用 \`&lt;\`
- 引号用 \`&quot;\`
- &符号用 \`&amp;\`

**CSS函数完整性检查清单**：
- linear-gradient() - 必须有完整的函数名和括号
- radial-gradient() - 同上
- rgba() - 颜色函数括号完整
- translate() / scale() / rotate() - transform函数括号完整
- blur() - filter函数括号完整

### 9. 必须遵守

1. **内容完整性最重要**：每页PPT的HTML必须是完整闭合的，确保所有div、svg等标签正确闭合
2. 每页必须有装饰元素，避免空洞
3. 内容区域使用 position: relative; z-index: 1; 确保在装饰之上
4. 每页内容精简，最多3-4个要点
5. 使用 gap/margin 确保元素间距协调
6. 文字要有对比度，深色背景用白色文字
7. 卡片使用毛玻璃效果 backdrop-filter: blur(10px)
8. 一般生成6-8页，内容丰富但不冗余
9. 不同页面使用不同布局，保持视觉新鲜感
10. **禁止使用emoji**，图标使用SVG（可参考示例或自行创建）
11. **确保每页HTML结构完整**，不要在生成过程中截断
12. **生成前检查所有CSS函数语法是否完整**，特别是gradient、rgba、transform等

直接输出PPT内容，不要有任何解释文字。确保每一页都是完整的HTML结构。`;

interface PPTData {
  slides: string[];
  title: string;
}

interface TemplateData {
  id: string;
  fileName: string;
  content: string;
  uploadTime: number;
}

// 历史模板存储
const TEMPLATE_STORAGE_KEY = 'writing_templates';

const getStoredTemplates = (): TemplateData[] => {
  try {
    const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveTemplate = (template: TemplateData): void => {
  const templates = getStoredTemplates();
  // 检查是否已存在同名模板，存在则更新
  const existingIndex = templates.findIndex(t => t.fileName === template.fileName);
  if (existingIndex >= 0) {
    templates[existingIndex] = template;
  } else {
    templates.unshift(template); // 新模板放最前面
  }
  // 最多保存20个模板
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates.slice(0, 20)));
};

const deleteStoredTemplate = (id: string): void => {
  const templates = getStoredTemplates().filter(t => t.id !== id);
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
};

/* ============================== 模板写作配置 ============================== */

const TEMPLATE_WRITING_PROMPT = `你是一个专业的文档写作助手。用户已上传了一个文档模板，你需要根据模板的格式和结构来帮助用户完成写作。

## 用户上传的模板内容：
{TEMPLATE_CONTENT}

## 你的任务：
1. 分析模板的结构和格式要求
2. 根据用户的具体需求，按照模板格式生成内容
3. 保持与模板一致的写作风格和格式规范
4. 确保生成的内容专业、准确、符合模板要求

## 重要输出格式要求：
当你生成完整文档时，请按以下结构输出：

1. 首先，用1-2句话说明你即将做什么（例如：正在根据模板和需求为您编写文档...）

2. 然后，使用特殊标识包裹文档内容，内容使用 Markdown 格式：
===DOCUMENT_START===
# 文档标题

## 第一部分
[内容...]

## 第二部分
[内容...]

---

**重点内容**可以加粗，列表使用 - 或数字编号

===DOCUMENT_END===

3. 最后，用1-2句话做简短的完成说明（例如：文档已按照模板格式生成完成，您可以在右侧编辑器中查看和修改。）

## Markdown 格式规范：
- 使用 # 作为一级标题，## 作为二级标题，### 作为三级标题
- 使用 **文字** 加粗重要内容
- 使用 - 或 1. 2. 3. 创建列表
- 使用 --- 作为分隔线
- 使用 > 作为引用块

标识说明：
- ===DOCUMENT_START=== 和 ===DOCUMENT_END=== 必须各占一行
- 只有生成完整文档时才使用这个格式
- 如果只是回答问题或给建议，直接回复即可，不需要使用标识

请根据用户的输入，生成符合模板格式的文档内容。`;

/* ============================== 报告生成模式配置 ============================== */

interface ReportSourceFile {
  id: string;
  fileName: string;
  content: string;
  uploadTime: number;
}

const REPORT_SYSTEM_PROMPT = `你是一个专业的深度研究报告生成助手，类似于 NotebookLM 的报告生成器。用户会提供一些来源材料，你需要基于这些材料生成一份结构化、深度分析的研究报告。

## 用户提供的来源材料：
{SOURCE_CONTENT}

## 输出格式要求：

请严格按照以下结构输出报告，使用 Markdown 格式，并用特殊标记包裹：

===REPORT_START===

# 报告标题

---

## 概述

[对所有来源材料进行高层次概括，说明报告涉及的核心主题和范围，2-3段]

---

## 核心发现

[从来源材料中提炼出的3-5个关键发现，每个发现用 **简短标题** 加详细说明的形式展开]

---

## 深度分析

[对核心内容进行深入分析，包含因果关系、趋势、对比等，分多个小节，可用 ### 子标题]

---

## 关键数据与事实

[从来源材料中提取的关键数据点、统计数据、重要事实，用列表形式呈现]

---

## 结论与建议

[基于分析得出的结论，以及可行的建议和下一步行动方向]

---

## 来源参考

[列出所有来源材料的文件名]

===REPORT_END===

## 写作规范：
1. 使用 Markdown 格式输出，包括标题（#/##/###）、加粗（**）、列表（-）、分隔线（---）等
2. 报告要有深度、有洞察，不是简单复述来源内容
3. 语言专业、客观、简洁
4. 每个章节之间用 --- 分隔
5. 如果用户提供了额外的指示或聚焦方向，请据此调整报告重点
6. 报告总长度在1500-3000字之间`;

const TYPO_FIX_PROMPT = `在生成或处理文档内容时，请同时执行以下任务：
1. 检查并修复所有错别字、拼写错误
2. 修正标点符号使用不当的地方
3. 纠正语法错误
4. 保持原文意思不变，只进行必要的文字修正
5. 如果发现并修复了错误，在回复末尾简要列出修改项`;

const parsePPTContent = (content: string): PPTData | null => {
  if (!content.includes('===SLIDE===')) return null;

  const slides = content
    .split('===SLIDE===')
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.includes('<div'));

  if (slides.length === 0) return null;

  // 尝试从第一页提取标题
  const firstSlide = slides[0];
  const titleMatch = firstSlide.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const title = titleMatch ? titleMatch[1] : 'PPT演示';

  return { slides, title };
};

// 解析文档内容
interface DocumentData {
  content: string;
  beforeText: string;
  afterText: string;
}

const parseDocumentContent = (content: string): DocumentData | null => {
  const startMarker = '===DOCUMENT_START===';
  const endMarker = '===DOCUMENT_END===';

  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) return null;

  const endIndex = content.indexOf(endMarker);
  const hasEndMarker = endIndex !== -1 && endIndex > startIndex;

  const beforeText = content.substring(0, startIndex).trim();
  const docContent = hasEndMarker
    ? content.substring(startIndex + startMarker.length, endIndex).trim()
    : content.substring(startIndex + startMarker.length).trim();
  const afterText = hasEndMarker
    ? content.substring(endIndex + endMarker.length).trim()
    : '';

  return {
    content: docContent,
    beforeText,
    afterText,
  };
};

// 解析报告内容
interface ReportData {
  content: string;
  title: string;
  beforeText: string;
  afterText: string;
}

const parseReportContent = (content: string): ReportData | null => {
  const startMarker = '===REPORT_START===';
  const endMarker = '===REPORT_END===';

  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) return null;

  const endIndex = content.indexOf(endMarker);
  const hasEndMarker = endIndex !== -1 && endIndex > startIndex;

  const beforeText = content.substring(0, startIndex).trim();
  const reportContent = hasEndMarker
    ? content.substring(startIndex + startMarker.length, endIndex).trim()
    : content.substring(startIndex + startMarker.length).trim();
  const afterText = hasEndMarker
    ? content.substring(endIndex + endMarker.length).trim()
    : '';

  // 尝试从报告内容第一行提取标题
  const lines = reportContent.split('\n').filter(l => l.trim());
  const title = lines[0]?.trim() || '研究报告';

  return {
    content: reportContent,
    title,
    beforeText,
    afterText,
  };
};

/* ============================== 主组件 ============================== */

// 封装 confirm 为 Promise
const showConfirm = (content: string, title = '确认'): Promise<boolean> => {
  return new Promise((resolve) => {
    Modal.confirm({
      title,
      content,
      okText: '确定',
      cancelText: '取消',
      centered: true,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [showKBSelector, setShowKBSelector] = useState(false);
  const [localKBs, setLocalKBs] = useState<KnowledgeBase[]>([]);
  const [selectedMode, setSelectedMode] = useState<WritingMode>(writingModes[0]);
  const [selectedStyle, setSelectedStyle] = useState<WritingStyle>(writingStyles[0]);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pptMode, setPptMode] = useState(false);
  const [showPPTModal, setShowPPTModal] = useState(false);
  const [currentPPT, setCurrentPPT] = useState<PPTData | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  // PPT 弹窗键盘事件
  useEffect(() => {
    if (!showPPTModal || !currentPPT) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentSlideIndex(prev => Math.min(currentPPT.slides.length - 1, prev + 1));
      } else if (e.key === 'Escape') {
        setShowPPTModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPPTModal, currentPPT]);
  // 模板写作模式状态
  const [templateMode, setTemplateMode] = useState(false);
  const [templateData, setTemplateData] = useState<TemplateData | null>(null);
  const [enableTypoFix] = useState(true); // 始终启用纠错，不展示开关
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [storedTemplates, setStoredTemplates] = useState<TemplateData[]>(() => getStoredTemplates());
  // 文档编辑器状态
  const [documentContent, setDocumentContent] = useState('');
  const [showDocumentEditor, setShowDocumentEditor] = useState(false);
  const [documentPreviewMode, setDocumentPreviewMode] = useState(true); // 默认预览模式
  // 报告生成模式状态
  const [reportMode, setReportMode] = useState(false);
  const [reportSourceFiles, setReportSourceFiles] = useState<ReportSourceFile[]>([]);
  const [showReportSourceManager, setShowReportSourceManager] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [showReportViewer, setShowReportViewer] = useState(false);
  const reportFileInputRef = useRef<HTMLInputElement>(null);
  const documentEditorRef = useRef<HTMLTextAreaElement>(null);
  const documentEditorContainerRef = useRef<HTMLDivElement>(null);
  // 智能滚动状态 - 消息列表
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesScrollPausedRef = useRef(false);
  const messagesScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesLastScrollTopRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 智能滚动状态 - 文档编辑器
  const userScrollPausedRef = useRef(false);
  const scrollResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollTopRef = useRef(0);

  // 智能滚动状态 - 报告页面
  const reportContainerRef = useRef<HTMLDivElement>(null);
  const reportScrollPausedRef = useRef(false);
  const reportScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportLastScrollTopRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const kbSelectorRef = useRef<HTMLDivElement>(null);
  const templateFileInputRef = useRef<HTMLInputElement>(null);

  // 消息列表智能滚动
  useEffect(() => {
    if (!messagesScrollPausedRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
      messagesLastScrollTopRef.current = container.scrollTop;
    }
  }, [messages]);

  // 消息列表滚动事件处理
  const handleMessagesScroll = () => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    const currentScrollTop = container.scrollTop;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;

    // 用户向上滚动时暂停自动滚动
    if (currentScrollTop < messagesLastScrollTopRef.current - 10 && !isAtBottom) {
      messagesScrollPausedRef.current = true;
      if (messagesScrollTimerRef.current) {
        clearTimeout(messagesScrollTimerRef.current);
      }
      // 3秒后恢复自动滚动
      messagesScrollTimerRef.current = setTimeout(() => {
        messagesScrollPausedRef.current = false;
        messagesScrollTimerRef.current = null;
      }, 3000);
    }
    // 用户滚动到底部时立即恢复自动滚动
    if (isAtBottom) {
      messagesScrollPausedRef.current = false;
      if (messagesScrollTimerRef.current) {
        clearTimeout(messagesScrollTimerRef.current);
        messagesScrollTimerRef.current = null;
      }
    }
    messagesLastScrollTopRef.current = currentScrollTop;
  };

  // 报告页面滚动事件处理
  const handleReportScroll = () => {
    if (!reportContainerRef.current) return;
    const container = reportContainerRef.current;
    const currentScrollTop = container.scrollTop;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;

    if (currentScrollTop < reportLastScrollTopRef.current - 10 && !isAtBottom) {
      reportScrollPausedRef.current = true;
      if (reportScrollTimerRef.current) {
        clearTimeout(reportScrollTimerRef.current);
      }
      reportScrollTimerRef.current = setTimeout(() => {
        reportScrollPausedRef.current = false;
        reportScrollTimerRef.current = null;
      }, 3000);
    }
    if (isAtBottom) {
      reportScrollPausedRef.current = false;
      if (reportScrollTimerRef.current) {
        clearTimeout(reportScrollTimerRef.current);
        reportScrollTimerRef.current = null;
      }
    }
    reportLastScrollTopRef.current = currentScrollTop;
  };

  // 文档内容变化时自动调整 textarea 高度 + 自动滚动
  useEffect(() => {
    if (documentEditorRef.current) {
      documentEditorRef.current.style.height = 'auto';
      documentEditorRef.current.style.height = documentEditorRef.current.scrollHeight + 'px';
    }
    // 流式写入时自动滚动到底部（用户手动滚动时暂停）
    if (isStreaming && documentEditorContainerRef.current && !userScrollPausedRef.current) {
      const container = documentEditorContainerRef.current;
      container.scrollTop = container.scrollHeight;
      lastScrollTopRef.current = container.scrollTop;
    }
  }, [documentContent, isStreaming]);

  // 文档编辑器滚动事件：检测用户手动滚动
  const handleEditorScroll = () => {
    if (!isStreaming || !documentEditorContainerRef.current) return;
    const container = documentEditorContainerRef.current;
    const currentScrollTop = container.scrollTop;
    // 用户向上滚动时暂停自动滚动
    if (currentScrollTop < lastScrollTopRef.current - 10) {
      userScrollPausedRef.current = true;
      // 清除之前的恢复定时器
      if (scrollResumeTimerRef.current) {
        clearTimeout(scrollResumeTimerRef.current);
      }
      // 3秒后恢复自动滚动
      scrollResumeTimerRef.current = setTimeout(() => {
        userScrollPausedRef.current = false;
        scrollResumeTimerRef.current = null;
      }, 3000);
    }
    lastScrollTopRef.current = currentScrollTop;
  };

  // 流式结束时重置所有滚动暂停状态
  useEffect(() => {
    if (!isStreaming) {
      // 重置文档编辑器滚动状态
      userScrollPausedRef.current = false;
      if (scrollResumeTimerRef.current) {
        clearTimeout(scrollResumeTimerRef.current);
        scrollResumeTimerRef.current = null;
      }
      // 重置消息列表滚动状态
      messagesScrollPausedRef.current = false;
      if (messagesScrollTimerRef.current) {
        clearTimeout(messagesScrollTimerRef.current);
        messagesScrollTimerRef.current = null;
      }
      // 重置报告页面滚动状态
      reportScrollPausedRef.current = false;
      if (reportScrollTimerRef.current) {
        clearTimeout(reportScrollTimerRef.current);
        reportScrollTimerRef.current = null;
      }
    }
  }, [isStreaming]);

  // 报告内容变化时自动滚动
  useEffect(() => {
    if (isStreaming && reportContainerRef.current && !reportScrollPausedRef.current) {
      const container = reportContainerRef.current;
      container.scrollTop = container.scrollHeight;
      reportLastScrollTopRef.current = container.scrollTop;
    }
  }, [reportContent, isStreaming]);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
        setShowModeDropdown(false);
      }
      if (kbSelectorRef.current && !kbSelectorRef.current.contains(e.target as Node)) {
        setShowKBSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 加载本地知识库列表
  useEffect(() => {
    setLocalKBs(getAllKnowledgeBases());
  }, []);

  // 获取 RAG 上下文（优先使用 RAGFlow 语义检索，回退到本地关键词检索）
  const getRAGContext = async (userQuery: string): Promise<string> => {
    if (!selectedKB) return '';

    // 优先使用 RAGFlow 语义检索
    if (selectedKB.ragflowDatasetId) {
      try {
        const ragflowResult = await buildRAGFlowPrompt(userQuery, [selectedKB.ragflowDatasetId]);
        if (ragflowResult) {
          return ragflowResult;
        }
      } catch (error) {
        console.error('RAGFlow 检索失败，回退到本地检索:', error);
      }
    }

    // 回退到本地关键词检索
    const localResult = buildPromptWithRAG(selectedKB, userQuery);
    if (localResult) {
      console.log('使用本地关键词检索');
    }
    return localResult;
  };

  const buildSystemPrompt = async (userQuery: string): Promise<string> => {
    let modePrompt = '';

    if (pptMode) {
      modePrompt = PPT_SYSTEM_PROMPT;
    } else if (reportMode && reportSourceFiles.length > 0) {
      // 报告生成模式
      const sourceContent = reportSourceFiles
        .map((f, i) => `=== 来源 ${i + 1}：${f.fileName} ===\n${f.content}\n=== 来源 ${i + 1} 结束 ===`)
        .join('\n\n');
      modePrompt = REPORT_SYSTEM_PROMPT.replace('{SOURCE_CONTENT}', sourceContent);
    } else if (templateMode && templateData) {
      // 模板写作模式
      const ragContext = await getRAGContext(userQuery);
      const parts: string[] = [];
      if (ragContext) {
        parts.push(ragContext);
      }
      parts.push(TEMPLATE_WRITING_PROMPT.replace('{TEMPLATE_CONTENT}', templateData.content));
      if (enableTypoFix) {
        parts.push(TYPO_FIX_PROMPT);
      }
      modePrompt = parts.join('\n\n');
    } else {
      // 默认模式
      const ragContext = await getRAGContext(userQuery);
      const parts: string[] = [];
      if (ragContext) {
        parts.push(ragContext);
      }
      if (selectedMode.systemPrompt) {
        parts.push(selectedMode.systemPrompt);
      }
      // 快速写作模式下追加风格提示词
      if (selectedMode.id === 'quick_writing' && selectedStyle.prompt) {
        parts.push(selectedStyle.prompt);
      }
      modePrompt = parts.join('\n\n');
    }

    return `${BASE_SYSTEM_PROMPT}\n\n${modePrompt}`;
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    const userMessage: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    setIsStreaming(true);
    setShowTemplates(false);
    resetTextareaHeight();

    const assistantMessage: ChatMessage = {
      id: String(Date.now() + 1),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    setMessages([...newMessages, assistantMessage]);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const systemPrompt = await buildSystemPrompt(text);
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...newMessages.map(m => ({ role: m.role, content: m.content })),
      ];

      const response = await fetch(API_CONFIG.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.key}`,
        },
        body: JSON.stringify({
          model: API_CONFIG.model,
          messages: apiMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: pptMode ? 16384 : templateMode ? 4096 : 2048,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API 错误: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法获取响应流');

      const decoder = new TextDecoder();
      let fullContent = '';
      let documentEditorOpened = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessage.id
                      ? { ...m, content: fullContent }
                      : m
                  )
                );

                // 模板写作模式：检测到文档标记时自动打开编辑器并实时更新
                if (templateMode && fullContent.includes('===DOCUMENT_START===')) {
                  if (!documentEditorOpened) {
                    setShowDocumentEditor(true);
                    documentEditorOpened = true;
                  }
                  // 实时更新编辑器内容
                  const docData = parseDocumentContent(fullContent);
                  if (docData) {
                    setDocumentContent(docData.content);
                  }
                }
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        // 用户主动停止
      } else {
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessage.id
              ? { ...m, content: `⚠️ 请求失败: ${errorMsg}\n\n请检查网络连接或API配置。` }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleRetry = () => {
    if (messages.length < 2) return;
    const lastUserIndex = messages.length - 2;
    const lastUserMsg = messages[lastUserIndex];
    if (lastUserMsg.role !== 'user') return;

    setMessages(messages.slice(0, -2));
    setInputText(lastUserMsg.content);
  };

  const handleClear = () => {
    setMessages([]);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTemplateSelect = (template: PromptTemplate) => {
    setInputText(template.prompt);
    setShowTemplates(false);
    textareaRef.current?.focus();
  };

  const handleTextareaInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.max(60, Math.min(textareaRef.current.scrollHeight, 200));
      textareaRef.current.style.height = newHeight + 'px';
    }
  };

  const resetTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '60px';
    }
  };

  // 模板文件上传处理
  const handleTemplateFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查是否正在生成
    if (isStreaming) {
      const confirmed = await showConfirm('当前正在生成内容，确定要切换到模板写作模式吗？');
      if (!confirmed) {
        e.target.value = '';
        return;
      }
      abortControllerRef.current?.abort();
    }

    const fileName = file.name;
    const fileExt = fileName.split('.').pop()?.toLowerCase();

    try {
      let content = '';

      if (fileExt === 'txt' || fileExt === 'md') {
        content = await file.text();
      } else if (fileExt === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } else {
        message.warning('不支持的文件格式，请上传 .txt、.md 或 .docx 文件');
        return;
      }

      if (content.trim()) {
        const newTemplate: TemplateData = {
          id: `tpl_${Date.now()}`,
          fileName,
          content: content.trim(),
          uploadTime: Date.now(),
        };
        saveTemplate(newTemplate); // 保存到历史记录
        setStoredTemplates(getStoredTemplates()); // 刷新列表
        // 重置其他模式
        setPptMode(false);
        setReportMode(false);
        setReportSourceFiles([]);
        setReportContent('');
        setShowReportViewer(false);
        setSelectedMode(writingModes[0]);
        // 进入模板模式
        setTemplateData(newTemplate);
        setTemplateMode(true);
        setMessages([]); // 清空对话
        setInputText(''); // 清空输入框
        resetTextareaHeight();
        setShowTemplateManager(false); // 关闭弹窗
      } else {
        message.warning('文件内容为空');
      }
    } catch (error) {
      console.error('文件读取失败:', error);
      message.error('文件读取失败，请重试');
    }

    // 清空 input 以便再次选择同一文件
    e.target.value = '';
  };

  // 导出生成的内容
  const handleExportContent = () => {
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistantMsg?.content) {
      message.warning('没有可导出的内容');
      return;
    }

    const blob = new Blob([lastAssistantMsg.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `生成内容_${new Date().toLocaleDateString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 报告来源文件上传处理
  const handleReportSourceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newSourceFiles: ReportSourceFile[] = [];

    for (const file of files) {
      const fileName = file.name;
      const fileExt = fileName.split('.').pop()?.toLowerCase();

      try {
        let content = '';

        if (fileExt === 'txt' || fileExt === 'md') {
          content = await file.text();
        } else if (fileExt === 'docx' || fileExt === 'pdf' || fileExt === 'pptx') {
          const result = await parseFile(file);
          if (result.success) {
            content = result.content;
          } else {
            message.error(`文件 "${fileName}" 解析失败: ${result.error}`);
            continue;
          }
        } else {
          message.warning(`不支持的文件格式: ${fileName}`);
          continue;
        }

        if (content.trim()) {
          newSourceFiles.push({
            id: `src_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            fileName,
            content: content.trim(),
            uploadTime: Date.now(),
          });
        }
      } catch (error) {
        console.error(`文件 "${fileName}" 读取失败:`, error);
        message.error(`文件 "${fileName}" 读取失败`);
      }
    }

    if (newSourceFiles.length > 0) {
      setReportSourceFiles(prev => [...prev, ...newSourceFiles]);
    }

    e.target.value = '';
  };

  // 删除报告来源文件
  const handleDeleteReportSource = (id: string) => {
    setReportSourceFiles(prev => prev.filter(f => f.id !== id));
  };

  // 定义模式类型
  type AppMode = 'normal' | 'quick_writing' | 'template' | 'ppt' | 'report';

  // 获取当前活动模式
  const getCurrentMode = (): AppMode => {
    if (pptMode) return 'ppt';
    if (templateMode) return 'template';
    if (reportMode) return 'report';
    if (selectedMode.id === 'quick_writing') return 'quick_writing';
    return 'normal';
  };

  // 获取模式的中文名称
  const getModeDisplayName = (mode: AppMode): string => {
    const names: Record<AppMode, string> = {
      normal: '普通对话',
      quick_writing: '快速写作',
      template: '模板写作',
      ppt: 'PPT生成',
      report: '报告生成',
    };
    return names[mode];
  };

  // 统一的模式切换函数
  const switchMode = async (targetMode: AppMode, skipConfirm = false): Promise<boolean> => {
    const currentMode = getCurrentMode();

    // 如果目标模式与当前模式相同，执行退出操作
    if (targetMode === currentMode) {
      if (isStreaming && !skipConfirm) {
        const confirmed = await showConfirm('当前正在生成内容，确定要退出当前模式吗？');
        if (!confirmed) {
          return false;
        }
        // 停止当前生成
        abortControllerRef.current?.abort();
      }
      // 退出当前模式，回到普通对话
      resetToNormalMode();
      return true;
    }

    // 切换到新模式前检查是否正在生成
    if (isStreaming && !skipConfirm) {
      const confirmed = await showConfirm(`当前正在生成内容，确定要切换到${getModeDisplayName(targetMode)}模式吗？`);
      if (!confirmed) {
        return false;
      }
      // 停止当前生成
      abortControllerRef.current?.abort();
    }

    // 重置所有模式状态
    resetAllModes();

    // 根据目标模式设置状态
    switch (targetMode) {
      case 'quick_writing':
        setSelectedMode(writingModes[1]);
        break;
      case 'template':
        setShowTemplateManager(true);
        return true; // 模板模式需要先选择模板，不在这里直接设置
      case 'ppt':
        setPptMode(true);
        setMessages([]);
        break;
      case 'report':
        setReportMode(true);
        setMessages([]);
        break;
      case 'normal':
      default:
        setSelectedMode(writingModes[0]);
        break;
    }

    // 清空输入框
    setInputText('');
    resetTextareaHeight();

    return true;
  };

  // 重置所有模式到普通对话状态
  const resetAllModes = () => {
    setPptMode(false);
    setTemplateMode(false);
    setTemplateData(null);
    setReportMode(false);
    setReportSourceFiles([]);
    setReportContent('');
    setShowReportViewer(false);
    setSelectedMode(writingModes[0]);
    setShowTemplates(false);
    setShowModeDropdown(false);
  };

  // 重置到普通对话模式
  const resetToNormalMode = () => {
    resetAllModes();
    setMessages([]);
    setInputText('');
    resetTextareaHeight();
  };

  // 报告生成处理（允许空输入）
  const handleGenerateReport = async () => {
    if (reportSourceFiles.length === 0) {
      message.warning('请先上传来源材料');
      return;
    }
    if (isStreaming) return;

    const text = inputText.trim() || '请根据来源材料生成一份深度分析报告';

    const userMessage: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    setIsStreaming(true);
    resetTextareaHeight();

    const assistantMessage: ChatMessage = {
      id: String(Date.now() + 1),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    setMessages([...newMessages, assistantMessage]);

    let reportViewerOpened = false;

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const systemPrompt = await buildSystemPrompt(text);
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...newMessages.map(m => ({ role: m.role, content: m.content })),
      ];

      const response = await fetch(API_CONFIG.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.key}`,
        },
        body: JSON.stringify({
          model: API_CONFIG.model,
          messages: apiMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API 错误: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法获取响应流');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessage.id
                      ? { ...m, content: fullContent }
                      : m
                  )
                );

                // 检测到报告标记时打开报告查看器
                if (fullContent.includes('===REPORT_START===')) {
                  if (!reportViewerOpened) {
                    setShowReportViewer(true);
                    reportViewerOpened = true;
                  }
                  const reportData = parseReportContent(fullContent);
                  if (reportData) {
                    setReportContent(reportData.content);
                  }
                }
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        // 用户主动停止
      } else {
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessage.id
              ? { ...m, content: `⚠️ 请求失败: ${errorMsg}\n\n请检查网络连接或API配置。` }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] sm:h-[calc(100vh-110px)] gap-2 sm:gap-4 p-2 sm:p-0">
      {/* 对话区 - 根据编辑器状态调整宽度 */}
      <div className={`flex flex-col bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-300 ${
        showDocumentEditor || showReportViewer ? 'w-full lg:w-1/2' : 'w-full max-w-4xl mx-auto'
      }`}>
        {/* 对话头部 */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-blue-600" />
            <span className="font-medium text-gray-800">AI 助手</span>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                title="清空对话"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* 消息列表 */}
        <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              {pptMode ? (
                <>
                  <Presentation size={48} className="mb-4 text-orange-300" />
                  <p className="text-lg font-medium text-gray-500">PPT 制作模式</p>
                  <p className="text-sm mt-1">输入PPT主题，AI将为你生成精美的演示文稿</p>
                  <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-lg">
                    {['年度工作总结', '产品发布会', '项目汇报', '培训课件'].map(topic => (
                      <button
                        key={topic}
                        onClick={() => setInputText(`请帮我制作一个关于"${topic}"的PPT`)}
                        className="px-3 py-1.5 text-sm border border-orange-200 rounded-full text-orange-500 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </>
              ) : templateMode && templateData ? (
                <>
                  <FileText size={48} className="mb-4 text-cyan-400" />
                  <p className="text-lg font-medium text-gray-500">模板写作模式</p>
                  <p className="text-sm mt-1">已加载模板: {templateData.fileName}</p>
                  <p className="text-xs text-gray-400 mt-1">输入写作需求，AI将根据模板格式生成内容</p>
                  <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-lg">
                    {['根据模板写一份完整的文档', '分析模板结构并给出写作建议', '帮我填充模板中的空白部分'].map(prompt => (
                      <button
                        key={prompt}
                        onClick={() => setInputText(prompt)}
                        className="px-3 py-1.5 text-sm border border-cyan-200 rounded-full text-cyan-600 hover:border-cyan-400 hover:text-cyan-700 hover:bg-cyan-50 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </>
              ) : reportMode ? (
                <>
                  <BookOpen size={48} className="mb-4 text-emerald-400" />
                  <p className="text-lg font-medium text-gray-500">报告生成模式</p>
                  <p className="text-sm mt-1 text-gray-400">
                    {reportSourceFiles.length > 0
                      ? `已上传 ${reportSourceFiles.length} 个来源文件`
                      : '上传来源材料，AI将生成深度分析报告'}
                  </p>
                  {reportSourceFiles.length === 0 ? (
                    <button
                      onClick={() => reportFileInputRef.current?.click()}
                      className="mt-6 flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-600 rounded-xl border-2 border-dashed border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100 transition-colors"
                    >
                      <FileUp size={20} />
                      <span>点击上传来源材料</span>
                    </button>
                  ) : (
                    <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-lg">
                      {['生成深度分析报告', '提炼核心观点和发现', '生成数据洞察报告'].map(prompt => (
                        <button
                          key={prompt}
                          onClick={() => setInputText(prompt)}
                          className="px-3 py-1.5 text-sm border border-emerald-200 rounded-full text-emerald-600 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-4">支持 .txt、.md、.docx、.pdf、.pptx 格式</p>
                </>
              ) : (
                <>
                  <Bot size={48} className="mb-4 text-gray-300" />
                  <p className="text-lg font-medium text-gray-500">开始与 AI 对话</p>
                  <p className="text-sm mt-1">选择知识库和写作模式，或使用提示词模板快速开始</p>
                  <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-lg">
                    {promptTemplates.slice(0, 4).map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleTemplateSelect(t)}
                        className="px-3 py-1.5 text-sm border border-gray-200 rounded-full text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {messages.map(message => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                  <Bot size={18} className="text-white" />
                </div>
              )}

              <div className={`max-w-[75%] ${message.role === 'user' ? 'order-first' : ''}`}>
                <div
                  className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 text-gray-800'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    (() => {
                      const pptData = parsePPTContent(message.content);
                      if (pptData && pptData.slides.length > 0) {
                        return (
                          <div className="space-y-3">
                            {/* PPT 预览卡片 - 浅橙色风格 */}
                            <div
                              className={`relative overflow-hidden rounded-2xl border border-orange-200 ${isStreaming ? 'cursor-wait' : 'cursor-pointer group'}`}
                              style={{
                                width: '520px',
                                background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #fed7aa 100%)',
                              }}
                              onClick={() => {
                                if (isStreaming) return;
                                setCurrentPPT(pptData);
                                setCurrentSlideIndex(0);
                                setShowPPTModal(true);
                              }}
                            >
                              {/* 装饰性背景元素 */}
                              <div className="absolute inset-0 overflow-hidden">
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-300/20 rounded-full blur-3xl" />
                                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-orange-200/30 rounded-full blur-3xl" />
                              </div>

                              {/* 顶部标题区域 */}
                              <div className="relative px-5 pt-4 pb-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isStreaming ? 'bg-orange-300/50 animate-pulse' : 'bg-orange-100 group-hover:bg-orange-200'} transition-all border border-orange-200`}>
                                      <Presentation size={20} className="text-orange-600" />
                                    </div>
                                    <div>
                                      <h4 className="text-orange-800 font-semibold text-sm truncate max-w-[280px]">
                                        {pptData.title}
                                      </h4>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-orange-600/80 text-xs">{pptData.slides.length} 页幻灯片</span>
                                        {isStreaming && (
                                          <span className="flex items-center gap-1 text-xs text-orange-700 bg-orange-200/60 px-2 py-0.5 rounded-full">
                                            <Loader2 size={10} className="animate-spin" />
                                            生成中
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {!isStreaming && (
                                    <div className="flex items-center gap-1.5 text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Eye size={14} />
                                      <span className="text-xs">预览</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* PPT 预览区域 */}
                              <div className="relative px-5 pb-4">
                                <div
                                  className="relative rounded-xl overflow-hidden shadow-lg ring-1 ring-orange-200"
                                  style={{ width: '480px', height: '270px' }}
                                >
                                  <div
                                    className="origin-top-left"
                                    style={{
                                      width: '1920px',
                                      height: '1080px',
                                      transform: 'scale(0.25)',
                                    }}
                                  >
                                    <div
                                      style={{ width: '100%', height: '100%' }}
                                      dangerouslySetInnerHTML={{ __html: pptData.slides[0] }}
                                    />
                                  </div>
                                  {/* 悬浮遮罩 */}
                                  {!isStreaming && (
                                    <div className="absolute inset-0 bg-gradient-to-t from-orange-900/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                                      <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform border border-orange-200">
                                        <Maximize2 size={14} className="text-orange-600" />
                                        <span className="text-sm font-medium text-orange-700">点击查看完整PPT</span>
                                      </div>
                                    </div>
                                  )}
                                  {/* 生成中遮罩 */}
                                  {isStreaming && (
                                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center">
                                      <div className="relative">
                                        <div className="w-12 h-12 border-4 border-white/30 rounded-full" />
                                        <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-white rounded-full animate-spin" />
                                      </div>
                                      <span className="text-white text-sm mt-3 font-medium">正在生成PPT...</span>
                                      <span className="text-white/70 text-xs mt-1">已完成 {pptData.slides.length} 页</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* 底部页码指示器 */}
                              {pptData.slides.length > 1 && (
                                <div className="relative px-5 pb-4 flex justify-center gap-1.5">
                                  {pptData.slides.slice(0, Math.min(7, pptData.slides.length)).map((_, idx) => (
                                    <div
                                      key={idx}
                                      className={`h-1.5 rounded-full transition-all ${idx === 0 ? 'w-4 bg-orange-500' : 'w-1.5 bg-orange-300/60'}`}
                                    />
                                  ))}
                                  {pptData.slides.length > 7 && (
                                    <span className="text-orange-500/70 text-xs ml-1">+{pptData.slides.length - 7}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      // 检查是否有文档内容
                      const docData = parseDocumentContent(message.content);
                      if (docData) {
                        return (
                          <div className="space-y-3">
                            {/* 文档前的文字 */}
                            {docData.beforeText && (
                              <div className="whitespace-pre-wrap">{docData.beforeText}</div>
                            )}
                            {/* 文档卡片 - 美观设计，不展示内容 */}
                            <div
                              className={`relative overflow-hidden rounded-xl border ${isStreaming ? 'cursor-default' : 'cursor-pointer group'} transition-all duration-300 hover:shadow-lg`}
                              style={{
                                background: 'linear-gradient(135deg, #e0f2fe 0%, #ddd6fe 50%, #fce7f3 100%)',
                              }}
                              onClick={() => {
                                if (isStreaming) return;
                                setDocumentContent(docData.content);
                                setShowDocumentEditor(true);
                              }}
                            >
                              {/* 装饰性背景图案 */}
                              <div className="absolute inset-0 opacity-10">
                                <div className="absolute top-4 right-4 w-32 h-32 border-4 border-cyan-500 rounded-full" />
                                <div className="absolute bottom-4 left-4 w-24 h-24 border-4 border-purple-500 rounded-lg rotate-12" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-pink-400 rounded-full blur-xl" />
                              </div>

                              {/* 卡片内容 */}
                              <div className="relative px-5 py-4">
                                <div className="flex items-center gap-3">
                                  {/* 文档图标 */}
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isStreaming ? 'bg-cyan-100 animate-pulse' : 'bg-white/80 shadow-sm group-hover:shadow-md'} transition-all`}>
                                    <FileEdit size={24} className="text-cyan-600" />
                                  </div>
                                  {/* 信息 */}
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-gray-800">
                                        {templateData?.fileName || '生成的文档'}
                                      </span>
                                      {isStreaming && (
                                        <span className="flex items-center gap-1 text-xs text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full">
                                          <Loader2 size={10} className="animate-spin" />
                                          写入中
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                      <span>{docData.content.length} 字符</span>
                                      <span>·</span>
                                      <span>{new Date().toLocaleTimeString()}</span>
                                    </div>
                                  </div>
                                  {/* 操作提示 */}
                                  {!isStreaming && (
                                    <div className="flex items-center gap-1 text-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Eye size={16} />
                                      <span className="text-sm">查看</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* 底部进度条（流式时显示） */}
                              {isStreaming && (
                                <div className="h-1 bg-cyan-100">
                                  <div className="h-full bg-gradient-to-r from-cyan-400 to-purple-400 animate-pulse" style={{ width: '60%' }} />
                                </div>
                              )}
                            </div>
                            {/* 文档后的文字 */}
                            {docData.afterText && (
                              <article className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-700 prose-p:leading-relaxed">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{docData.afterText}</ReactMarkdown>
                              </article>
                            )}
                          </div>
                        );
                      }
                      // 检查是否有报告内容
                      const rptData = parseReportContent(message.content);
                      if (rptData) {
                        return (
                          <div className="space-y-3">
                            {rptData.beforeText && (
                              <article className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-700 prose-p:leading-relaxed">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{rptData.beforeText}</ReactMarkdown>
                              </article>
                            )}
                            <div
                              className={`relative overflow-hidden rounded-xl border ${isStreaming ? 'cursor-default' : 'cursor-pointer group'} transition-all duration-300 hover:shadow-lg`}
                              style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 30%, #6ee7b7 70%, #34d399 100%)' }}
                              onClick={() => { if (isStreaming) return; setReportContent(rptData.content); setShowReportViewer(true); }}
                            >
                              <div className="absolute inset-0 opacity-10">
                                <div className="absolute top-4 right-4 w-32 h-32 border-4 border-emerald-700 rounded-full" />
                                <div className="absolute bottom-4 left-4 w-24 h-24 border-4 border-teal-700 rounded-lg rotate-12" />
                              </div>
                              <div className="relative px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isStreaming ? 'bg-emerald-200 animate-pulse' : 'bg-white/80 shadow-sm group-hover:shadow-md'} transition-all`}>
                                    <BookOpen size={24} className="text-emerald-600" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-emerald-900">{rptData.title}</span>
                                      {isStreaming && (
                                        <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-200 px-2 py-0.5 rounded-full">
                                          <Loader2 size={10} className="animate-spin" />
                                          生成中
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-emerald-700/70">
                                      <span>{rptData.content.length} 字符</span>
                                      <span>&middot;</span>
                                      <span>{reportSourceFiles.length} 个来源</span>
                                    </div>
                                  </div>
                                  {!isStreaming && (
                                    <div className="flex items-center gap-1 text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Eye size={16} />
                                      <span className="text-sm">查看</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {isStreaming && (
                                <div className="h-1 bg-emerald-200">
                                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 animate-pulse" style={{ width: '60%' }} />
                                </div>
                              )}
                            </div>
                            {rptData.afterText && (
                              <article className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-700 prose-p:leading-relaxed">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{rptData.afterText}</ReactMarkdown>
                              </article>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div>
                          {message.content ? (
                            <article className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-h1:text-lg prose-h1:font-bold prose-h2:text-base prose-h2:font-semibold prose-h3:text-sm prose-h3:font-semibold prose-hr:my-3 prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-1.5 prose-strong:text-gray-800 prose-ul:my-1.5 prose-li:my-0.5 prose-blockquote:text-gray-600 prose-blockquote:border-gray-300">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.content}
                              </ReactMarkdown>
                            </article>
                          ) : (
                            <span className="flex items-center gap-2 text-gray-400">
                              <Loader2 size={14} className="animate-spin" />
                              {pptMode ? '正在生成PPT...' : reportMode ? '正在生成报告...' : templateMode ? '正在生成文档...' : '正在思考...'}
                            </span>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  )}
                </div>

                {/* 消息操作 */}
                {message.role === 'assistant' && message.content && !isStreaming && (
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      onClick={() => handleCopy(message.content, message.id)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
                      title="复制"
                    >
                      {copiedId === message.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                    {message.id === messages[messages.length - 1]?.id && (
                      <button
                        onClick={handleRetry}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
                        title="重新生成"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center shrink-0">
                  <User size={18} className="text-white" />
                </div>
              )}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <div className="border-t border-gray-200 px-3 sm:px-4 py-2 sm:py-3">
          {/* 模板写作模式 - 输入框左上角显示模板选择 */}
          {templateMode && (
            <div className="flex items-center gap-2 mb-2">
              {/* 模板选择按钮 */}
              <button
                onClick={() => setShowTemplateManager(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors bg-cyan-100 text-cyan-700 border border-cyan-300"
              >
                <FileText size={14} />
                {templateData?.fileName || '选择模板'}
                <ChevronDown size={12} />
              </button>
              {/* 预览模板 */}
              {templateData && (
                <button
                  onClick={() => setShowTemplatePreview(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors bg-gray-100 text-gray-600 hover:bg-cyan-50 hover:text-cyan-600 border border-gray-200"
                  title="预览模板内容"
                >
                  <Eye size={14} />
                  预览
                </button>
              )}
              {/* 导出内容 */}
              {messages.some(m => m.role === 'assistant' && m.content) && (
                <button
                  onClick={handleExportContent}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors bg-gray-100 text-gray-600 hover:bg-cyan-50 hover:text-cyan-600 border border-gray-200"
                  title="导出生成的内容"
                >
                  <Download size={14} />
                  导出
                </button>
              )}
            </div>
          )}

          {/* 快速写作模式下显示模板和风格按钮 - 输入框左上角 */}
          {selectedMode.id === 'quick_writing' && !templateMode && !reportMode && (
            <div className="flex items-center gap-2 mb-2">
              {/* 模板按钮 */}
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  showTemplates
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700 border border-gray-200'
                }`}
              >
                <FileText size={14} />
                模板
                <ChevronDown size={12} className={`transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
              </button>

              {/* 风格按钮 */}
              <div className="relative" ref={modeDropdownRef}>
                <button
                  onClick={() => setShowModeDropdown(!showModeDropdown)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    showModeDropdown || selectedStyle.id !== 'none'
                      ? 'bg-purple-100 text-purple-700 border border-purple-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-purple-700 border border-gray-200'
                  }`}
                >
                  <Pen size={14} />
                  {selectedStyle.id !== 'none' ? selectedStyle.name : '风格'}
                  <ChevronDown size={12} className={`transition-transform ${showModeDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* 风格下拉框 - 向上弹出 */}
                {showModeDropdown && (
                  <div className="absolute bottom-full mb-1 left-0 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-30 overflow-hidden">
                    {writingStyles.map(style => (
                      <button
                        key={style.id}
                        onClick={() => { setSelectedStyle(style); setShowModeDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-purple-50 transition-colors ${
                          selectedStyle.id === style.id ? 'bg-purple-50 text-purple-700' : ''
                        }`}
                      >
                        <p className="font-medium">{style.name}</p>
                        <p className="text-xs text-gray-400">{style.description}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 报告生成模式 - 输入框左上角显示上传来源 */}
          {reportMode && (
            <div className="flex items-center gap-2 mb-2">
              {/* 上传来源按钮 */}
              <button
                onClick={() => reportFileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors bg-emerald-100 text-emerald-700 border border-emerald-300 hover:bg-emerald-200"
              >
                <FileUp size={14} />
                上传来源
              </button>
              {/* 来源文件数量 */}
              {reportSourceFiles.length > 0 && (
                <>
                  <button
                    onClick={() => setShowReportSourceManager(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100"
                    title="管理来源文件"
                  >
                    <Eye size={14} />
                    {reportSourceFiles.length} 个来源
                  </button>
                </>
              )}
              {/* 导出报告 */}
              {reportContent && (
                <button
                  onClick={() => {
                    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `研究报告_${new Date().toLocaleDateString()}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 border border-gray-200"
                  title="导出报告"
                >
                  <Download size={14} />
                  导出
                </button>
              )}
            </div>
          )}

          <div className="flex items-end gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200 shadow-sm focus-within:border-blue-400 focus-within:shadow-md transition-all">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                handleTextareaInput();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (reportMode) {
                    handleGenerateReport();
                  } else {
                    handleSend();
                  }
                }
              }}
              placeholder={pptMode ? "输入PPT主题，如：人工智能发展趋势..." : reportMode ? "输入报告方向或要求（可选），直接点击生成..." : templateMode ? "输入写作需求，AI将根据模板格式生成内容..." : selectedMode.id === 'quick_writing' ? "选择模板或直接输入内容..." : "输入消息，Shift+Enter 换行..."}
              rows={1}
              className="flex-1 bg-transparent px-1 py-2 text-sm resize-none focus:outline-none min-h-[40px] max-h-[200px] overflow-y-auto placeholder-gray-400 scrollbar-hide"
              disabled={isStreaming}
            />

            {isStreaming ? (
              <button
                onClick={handleStop}
                className="flex items-center justify-center w-10 h-10 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all shadow-sm hover:shadow shrink-0"
                title="停止生成"
              >
                <Square size={18} />
              </button>
            ) : reportMode ? (
              <button
                onClick={handleGenerateReport}
                disabled={reportSourceFiles.length === 0}
                className="flex items-center justify-center w-10 h-10 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow shrink-0"
                title="生成报告"
              >
                <Sparkles size={18} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!inputText.trim()}
                className="flex items-center justify-center w-10 h-10 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow shrink-0"
                title="发送"
              >
                <Send size={18} />
              </button>
            )}
          </div>

          {/* 底部胶囊按钮区域 */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {/* 知识库选择按钮 */}
            <div className="relative" ref={kbSelectorRef}>
              <button
                onClick={() => {
                  if (!showKBSelector) {
                    // 打开时刷新知识库列表
                    setLocalKBs(getAllKnowledgeBases());
                  }
                  setShowKBSelector(!showKBSelector);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors border ${
                  selectedKB
                    ? 'bg-purple-100 text-purple-700 border-purple-300'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Database size={14} />
                <span>{selectedKB ? selectedKB.name : '选择知识库'}</span>
                <ChevronDown size={14} className={`transition-transform ${showKBSelector ? 'rotate-180' : ''}`} />
              </button>
              {showKBSelector && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
                    本地知识库（{localKBs.length}个）
                  </div>
                  {localKBs.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-400 text-center">
                      暂无知识库，请先创建
                    </div>
                  ) : (
                    <>
                      {selectedKB && (
                        <button
                          onClick={() => {
                            setSelectedKB(null);
                            setShowKBSelector(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <X size={14} />
                          <span>取消选择</span>
                        </button>
                      )}
                      {localKBs.map(kb => (
                        <button
                          key={kb.id}
                          onClick={() => {
                            setSelectedKB(kb);
                            setShowKBSelector(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                            selectedKB?.id === kb.id ? 'bg-purple-50 text-purple-700' : 'text-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{kb.name}</span>
                            {kb.ragflowDatasetId ? (
                              <span className="text-xs text-green-500">已同步</span>
                            ) : (
                              <span className="text-xs text-gray-400">本地</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {kb.documents.length}个文档 · {kb.totalChunks}个分块
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 快速写作按钮 */}
            <button
              onClick={() => switchMode('quick_writing')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors border ${
                getCurrentMode() === 'quick_writing'
                  ? 'bg-green-100 text-green-700 border-green-300'
                  : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
              }`}
            >
              <Pen size={14} />
              <span>{getCurrentMode() === 'quick_writing' ? '退出快速写作' : '快速写作'}</span>
            </button>

            {/* 模板写作按钮 */}
            <button
              onClick={() => switchMode('template')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors border ${
                getCurrentMode() === 'template'
                  ? 'bg-cyan-100 text-cyan-700 border-cyan-300'
                  : 'bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100'
              }`}
            >
              <Upload size={14} />
              <span>{getCurrentMode() === 'template' ? '退出模板写作' : '模板写作'}</span>
            </button>

            {/* PPT工具按钮 */}
            <button
              onClick={() => switchMode('ppt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors border ${
                getCurrentMode() === 'ppt'
                  ? 'bg-orange-100 text-orange-700 border-orange-300'
                  : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
              }`}
            >
              <Presentation size={14} />
              <span>{getCurrentMode() === 'ppt' ? '退出PPT模式' : '制作PPT'}</span>
            </button>

            {/* 报告生成按钮 */}
            <button
              onClick={() => switchMode('report')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors border ${
                getCurrentMode() === 'report'
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <BookOpen size={14} />
              <span>{getCurrentMode() === 'report' ? '退出报告模式' : '生成报告'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 隐藏的文件上传 input */}
      <input
        ref={templateFileInputRef}
        type="file"
        accept=".txt,.md,.docx"
        onChange={handleTemplateFileUpload}
        className="hidden"
      />

      {/* 报告来源文件上传 input */}
      <input
        ref={reportFileInputRef}
        type="file"
        accept=".txt,.md,.docx,.pdf,.pptx"
        multiple
        onChange={handleReportSourceUpload}
        className="hidden"
      />

      {/* 模板选择弹窗 */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTemplates(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <FileText size={18} className="text-green-600" />
                选择模板
              </h3>
              <button
                onClick={() => setShowTemplates(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {promptTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="flex flex-col items-start p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors text-left group"
                  >
                    <span className="text-xs text-gray-400 mb-1">{template.category}</span>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-green-700">{template.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* PPT预览弹窗 - 全屏浅橙色风格 */}
      {showPPTModal && currentPPT && (
        <div className="fixed inset-0 bg-gradient-to-br from-orange-50 via-orange-100 to-amber-50 flex flex-col z-50">
          {/* 背景装饰 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-200/30 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl" />
          </div>

          {/* 顶部控制栏 */}
          <div className="relative flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur-xl border-b border-orange-200">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-400/25">
                <Presentation size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-orange-800 font-semibold text-lg">{currentPPT.title}</h2>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-orange-600 text-sm">
                    第 {currentSlideIndex + 1} 页，共 {currentPPT.slides.length} 页
                  </span>
                  <div className="flex gap-1">
                    {currentPPT.slides.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          idx === currentSlideIndex ? 'w-6 bg-orange-500' : 'w-1.5 bg-orange-300/60'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-orange-400 text-xs mr-2">← → 切换 · ESC 关闭</span>
              <button
                onClick={() => setShowPPTModal(false)}
                className="p-2.5 text-orange-600 hover:text-orange-700 hover:bg-orange-100 rounded-xl transition-all"
                title="关闭 (ESC)"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* PPT内容区 */}
          <div className="relative flex-1 flex items-center justify-center">
            {/* 左箭头 */}
            <button
              onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
              disabled={currentSlideIndex === 0}
              className="absolute left-6 w-14 h-14 flex items-center justify-center bg-white/80 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl transition-all backdrop-blur-sm border border-orange-200 z-10 group shadow-lg"
            >
              <ChevronLeft size={28} className="text-orange-600 group-hover:scale-110 transition-transform" />
            </button>

            {/* 幻灯片 - 1920x1080 缩放到 960x540 显示 */}
            <div
              className="mx-20 rounded-2xl overflow-hidden shadow-2xl shadow-orange-900/20 relative ring-1 ring-orange-200"
              style={{ width: '960px', height: '540px' }}
            >
              <div
                className="origin-top-left absolute top-0 left-0"
                style={{
                  width: '1920px',
                  height: '1080px',
                  transform: 'scale(0.5)',
                }}
              >
                <div
                  style={{ width: '100%', height: '100%' }}
                  dangerouslySetInnerHTML={{ __html: currentPPT.slides[currentSlideIndex] }}
                />
              </div>
            </div>

            {/* 右箭头 */}
            <button
              onClick={() => setCurrentSlideIndex(Math.min(currentPPT.slides.length - 1, currentSlideIndex + 1))}
              disabled={currentSlideIndex === currentPPT.slides.length - 1}
              className="absolute right-6 w-14 h-14 flex items-center justify-center bg-white/80 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl transition-all backdrop-blur-sm border border-orange-200 z-10 group shadow-lg"
            >
              <ChevronRight size={28} className="text-orange-600 group-hover:scale-110 transition-transform" />
            </button>
          </div>

          {/* 底部缩略图 */}
          <div className="relative flex items-center gap-3 px-6 py-4 bg-white/70 backdrop-blur-xl border-t border-orange-200 overflow-x-auto">
            {currentPPT.slides.map((slide, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlideIndex(index)}
                className={`flex-shrink-0 rounded-xl overflow-hidden transition-all duration-300 relative group ${
                  index === currentSlideIndex
                    ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-orange-50 scale-105'
                    : 'ring-1 ring-orange-200 hover:ring-orange-300 hover:scale-102'
                }`}
                style={{ width: '144px', height: '81px' }}
              >
                <div
                  className="origin-top-left absolute top-0 left-0"
                  style={{
                    width: '1920px',
                    height: '1080px',
                    transform: 'scale(0.075)',
                  }}
                >
                  <div
                    style={{ width: '100%', height: '100%' }}
                    dangerouslySetInnerHTML={{ __html: slide }}
                  />
                </div>
                {/* 序号标签 */}
                <div className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-xs font-medium transition-all ${
                  index === currentSlideIndex
                    ? 'bg-orange-500 text-white'
                    : 'bg-orange-900/50 text-white/80 group-hover:bg-orange-900/70'
                }`}>
                  {index + 1}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 模板管理弹窗 */}
      {showTemplateManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTemplateManager(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <FileText size={18} className="text-cyan-600" />
                选择或上传模板
              </h3>
              <button
                onClick={() => setShowTemplateManager(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              {/* 上传区域 */}
              <div
                onClick={() => templateFileInputRef.current?.click()}
                className="border-2 border-dashed border-cyan-200 rounded-xl p-6 text-center cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/50 transition-colors mb-4"
              >
                <Upload size={32} className="mx-auto text-cyan-400 mb-2" />
                <p className="text-sm font-medium text-gray-700">点击上传新模板</p>
                <p className="text-xs text-gray-400 mt-1">支持 .txt、.md、.docx 格式</p>
              </div>

              {/* 历史模板网格 */}
              {storedTemplates.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-600">历史模板</span>
                    <span className="text-xs text-gray-400">{storedTemplates.length} 个模板</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                    {storedTemplates.map(tpl => (
                      <div
                        key={tpl.id}
                        className={`relative group p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                          templateData?.id === tpl.id
                            ? 'border-cyan-400 bg-cyan-50'
                            : 'border-gray-200 hover:border-cyan-300 hover:bg-gray-50'
                        }`}
                        onClick={async () => {
                          // 检查是否正在生成
                          if (isStreaming) {
                            const confirmed = await showConfirm('当前正在生成内容，确定要切换到模板写作模式吗？');
                            if (!confirmed) {
                              return;
                            }
                            abortControllerRef.current?.abort();
                          }
                          // 重置其他模式
                          setPptMode(false);
                          setReportMode(false);
                          setReportSourceFiles([]);
                          setReportContent('');
                          setShowReportViewer(false);
                          setSelectedMode(writingModes[0]);
                          // 进入模板模式
                          setTemplateData(tpl);
                          setTemplateMode(true);
                          setMessages([]);
                          setInputText('');
                          resetTextareaHeight();
                          setShowTemplateManager(false);
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <FileText size={16} className="text-cyan-500 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">{tpl.fileName}</p>
                            <p className="text-xs text-gray-400 mt-1">{tpl.content.length} 字符</p>
                          </div>
                        </div>
                        {/* 删除按钮 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteStoredTemplate(tpl.id);
                            setStoredTemplates(getStoredTemplates());
                            if (templateData?.id === tpl.id) {
                              setTemplateData(null);
                              setTemplateMode(false);
                            }
                          }}
                          className="absolute top-1 right-1 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="删除模板"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {storedTemplates.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">暂无历史模板，请上传新模板</p>
              )}
            </div>
            {templateMode && (
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                <button
                  onClick={() => {
                    switchMode('template'); // 退出模板模式
                    setShowTemplateManager(false);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-red-500 text-sm transition-colors"
                >
                  退出模板模式
                </button>
                <button
                  onClick={() => setShowTemplateManager(false)}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 transition-colors"
                >
                  确定
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 模板预览弹窗 */}
      {showTemplatePreview && templateData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTemplatePreview(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <FileText size={18} className="text-cyan-600" />
                模板内容预览
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{templateData.fileName}</span>
                <button
                  onClick={() => setShowTemplatePreview(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              <article className="prose prose-cyan prose-sm max-w-none prose-headings:text-gray-800 prose-hr:border-gray-200 prose-hr:my-4 prose-p:text-gray-700 prose-p:leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {templateData.content}
                </ReactMarkdown>
              </article>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowTemplatePreview(false)}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 右侧文档编辑器面板 - 半屏展示 */}
      {showDocumentEditor && (
        <div className="w-1/2 flex flex-col bg-white rounded-lg shadow-sm overflow-hidden">
          {/* 编辑器顶部工具栏 */}
          <div className="border-b border-gray-200">
            {/* 第一行：文件操作 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <FileEdit size={18} className="text-cyan-600" />
                  <span className="font-medium text-gray-800 text-sm">
                    {templateData?.fileName || '未命名文档'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const blob = new Blob([documentContent], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${templateData?.fileName?.replace(/\.[^/.]+$/, '') || '文档'}_生成.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="保存为文件"
                >
                  <Save size={14} />
                  <span>保存</span>
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(documentContent);
                    message.success('已复制到剪贴板');
                  }}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="复制全部内容"
                >
                  <Copy size={14} />
                  <span>复制</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="打印"
                >
                  <Printer size={14} />
                  <span>打印</span>
                </button>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <button
                  onClick={() => setShowDocumentEditor(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="关闭编辑器"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            {/* 第二行：格式工具栏 */}
            <div className="flex items-center gap-1 px-3 py-1.5">
              <div className="flex items-center gap-0.5 pr-2 border-r border-gray-200">
                <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors" title="字体">
                  <Type size={14} />
                </button>
              </div>
              <div className="flex items-center gap-0.5 px-2 border-r border-gray-200">
                <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors" title="加粗">
                  <Bold size={14} />
                </button>
                <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors" title="斜体">
                  <Italic size={14} />
                </button>
                <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors" title="下划线">
                  <Underline size={14} />
                </button>
              </div>
              <div className="flex items-center gap-0.5 px-2">
                <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors" title="左对齐">
                  <AlignLeft size={14} />
                </button>
                <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors" title="居中">
                  <AlignCenter size={14} />
                </button>
                <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors" title="右对齐">
                  <AlignRight size={14} />
                </button>
              </div>
              <div className="flex-1" />
              {/* 预览/编辑切换 */}
              <div className="flex items-center gap-1 mr-2 bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setDocumentPreviewMode(false)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${!documentPreviewMode ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  编辑
                </button>
                <button
                  onClick={() => setDocumentPreviewMode(true)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${documentPreviewMode ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  预览
                </button>
              </div>
              <span className="text-xs text-gray-400">{documentContent.length} 字符</span>
            </div>
          </div>

          {/* 文档编辑区 - 模拟 A4 纸张 */}
          <div ref={documentEditorContainerRef} onScroll={handleEditorScroll} className="flex-1 overflow-auto bg-gray-100 p-4">
            <div className="bg-white shadow-md rounded mx-auto" style={{
              width: '100%',
              maxWidth: '595px', // A4 宽度的缩放版
              minHeight: '842px', // A4 高度的缩放版
              padding: '48px 40px'
            }}>
              {documentPreviewMode ? (
                <article className="prose prose-cyan prose-sm max-w-none prose-headings:text-gray-800 prose-h1:text-xl prose-h1:font-bold prose-h1:border-b prose-h1:border-cyan-200 prose-h1:pb-2 prose-h1:mb-4 prose-h2:text-lg prose-h2:font-semibold prose-h2:text-cyan-800 prose-h2:mt-5 prose-h2:mb-2 prose-hr:border-cyan-200 prose-hr:my-4 prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-2 prose-strong:text-cyan-700 prose-ul:my-2 prose-li:my-0.5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {documentContent || '文档内容将显示在这里...'}
                  </ReactMarkdown>
                </article>
              ) : (
                <textarea
                  ref={documentEditorRef}
                  value={documentContent}
                  onChange={(e) => {
                    setDocumentContent(e.target.value);
                    // 自动调整高度
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  className="w-full resize-none border-none outline-none text-gray-800 leading-relaxed overflow-hidden"
                  style={{
                    fontFamily: 'Menlo, Monaco, Consolas, monospace',
                    fontSize: '13px',
                    lineHeight: '1.8',
                    minHeight: '700px',
                  }}
                  placeholder="在此编辑 Markdown 内容..."
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* 报告来源管理弹窗 */}
      {showReportSourceManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowReportSourceManager(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <BookOpen size={18} className="text-emerald-600" />
                来源材料管理
                <span className="text-sm font-normal text-gray-400">({reportSourceFiles.length} 个文件)</span>
              </h3>
              <button
                onClick={() => setShowReportSourceManager(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {/* 上传更多 */}
              <button
                onClick={() => reportFileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-emerald-200 rounded-xl p-4 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors mb-4"
              >
                <FileUp size={24} className="mx-auto text-emerald-400 mb-2" />
                <p className="text-sm font-medium text-gray-700">点击上传更多来源</p>
                <p className="text-xs text-gray-400 mt-1">支持 .txt、.md、.docx、.pdf、.pptx 格式</p>
              </button>

              {/* 已上传文件列表 */}
              {reportSourceFiles.length > 0 ? (
                <div className="space-y-2">
                  {reportSourceFiles.map((file, index) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow bg-white"
                    >
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-medium flex items-center justify-center">
                        {index + 1}
                      </span>
                      <FileText size={18} className="text-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{file.fileName}</p>
                        <p className="text-xs text-gray-400">
                          {file.content.length} 字符 &middot; {new Date(file.uploadTime).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteReportSource(file.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-gray-400 py-4">暂无来源文件</p>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <button
                onClick={() => {
                  setReportSourceFiles([]);
                }}
                className="px-4 py-2 text-gray-600 hover:text-red-500 text-sm transition-colors"
                disabled={reportSourceFiles.length === 0}
              >
                清空全部
              </button>
              <button
                onClick={() => setShowReportSourceManager(false)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 报告查看器 - 右侧半屏展示 */}
      {showReportViewer && (
        <div className="w-1/2 flex flex-col bg-white rounded-lg shadow-sm overflow-hidden">
          {/* 报告查看器顶部工具栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <BookOpen size={16} className="text-white" />
              </div>
              <div>
                <span className="font-medium text-gray-800 text-sm">研究报告</span>
                {isStreaming && (
                  <span className="ml-2 text-xs text-emerald-600 flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" />
                    生成中...
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `研究报告_${new Date().toLocaleDateString()}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="保存报告"
              >
                <Save size={14} />
                <span>保存</span>
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(reportContent);
                  message.success('已复制到剪贴板');
                }}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="复制全部内容"
              >
                <Copy size={14} />
                <span>复制</span>
              </button>
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <button
                onClick={() => setShowReportViewer(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="关闭"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* 报告内容区 */}
          <div ref={reportContainerRef} onScroll={handleReportScroll} className="flex-1 overflow-auto bg-gradient-to-b from-emerald-50/30 to-white p-6">
            <div className="bg-white shadow-sm rounded-xl mx-auto max-w-3xl p-8 border border-gray-100">
              <article className="prose prose-emerald prose-sm max-w-none prose-headings:text-gray-800 prose-h1:text-2xl prose-h1:font-bold prose-h1:border-b prose-h1:border-emerald-200 prose-h1:pb-3 prose-h1:mb-6 prose-h2:text-lg prose-h2:font-semibold prose-h2:text-emerald-800 prose-h2:mt-6 prose-h2:mb-3 prose-hr:border-emerald-200 prose-hr:my-6 prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-emerald-700 prose-ul:my-2 prose-li:my-1">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {reportContent || '报告生成中...'}
                </ReactMarkdown>
              </article>
            </div>
          </div>

          {/* 底部信息 */}
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400">{reportContent.length} 字符</span>
            <span className="text-xs text-gray-400">来源: {reportSourceFiles.length} 个文件</span>
          </div>
        </div>
      )}
    </div>
  );
}
