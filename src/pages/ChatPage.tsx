import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Database, Pen, FileText, Trash2,
  ChevronDown, Loader2, Square, RotateCcw, Copy, Check, X,
  Presentation, ChevronLeft, ChevronRight, Maximize2, Minimize2,
  Upload, Download, Eye, FileEdit, Save, Printer,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Type
} from 'lucide-react';
import type { KnowledgeBase } from '../types';
import { getAllKnowledgeBases, buildPromptWithRAG } from '../services/knowledgeBaseService';

/* ============================== 配置与数据 ============================== */

const API_CONFIG = {
  url: 'http://183.252.196.133:38000/v1/chat/completions',
  key: 'sk-ycd03E09f7cG1',
  model: 'yantronic-o1-mini',
};

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

const PPT_SYSTEM_PROMPT = `你是一个专业的PPT制作助手。用户会给你一个主题，你需要生成一个精美的HTML格式PPT。

重要：PPT基于1920x1080分辨率(16:9)设计，所有尺寸按此标准。

请严格按照以下格式输出PPT内容，每一页用 ===SLIDE=== 分隔：

===SLIDE===
<div class="slide-content" style="width: 1920px; height: 1080px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px; box-sizing: border-box;">
  <h1 style="color: white; font-size: 72px; text-align: center; margin-bottom: 40px; font-weight: bold;">标题</h1>
  <p style="color: rgba(255,255,255,0.9); font-size: 36px; text-align: center;">副标题或描述</p>
</div>
===SLIDE===

要求：
1. 每页PPT必须设置 width: 1920px; height: 1080px; 这是1080p标准尺寸
2. 使用 display: flex; flex-direction: column; 来布局内容
3. 设置合适的 padding: 80px; 确保内容不贴边
4. 使用现代渐变背景，每页可以不同配色
5. 字体大小要大：
   - 封面标题: 80-96px
   - 页面标题: 56-72px
   - 副标题: 36-48px
   - 正文内容: 28-36px
   - 列表项: 28-32px
6. 内容要有层次感，使用合适的间距(margin/gap)
7. 一般生成5-8页PPT
8. 每页内容不要太多，保持简洁易读
9. 列表项使用 text-align: left; 并设置合适的宽度
10. 可以使用图标符号（如 ✓ ★ → • ◆ ▸）来美化列表
11. 可以使用的背景色方案：
    - 蓝紫渐变: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
    - 青蓝渐变: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)
    - 橙红渐变: linear-gradient(135deg, #fa709a 0%, #fee140 100%)
    - 绿青渐变: linear-gradient(135deg, #11998e 0%, #38ef7d 100%)
    - 深蓝渐变: linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)
    - 紫粉渐变: linear-gradient(135deg, #c471f5 0%, #fa71cd 100%)
    - 深色商务: linear-gradient(135deg, #232526 0%, #414345 100%)
    - 白色简约: #ffffff (配合深色文字)

直接输出PPT内容，不要有其他解释文字。`;

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

2. 然后，使用特殊标识包裹文档内容：
===DOCUMENT_START===
[完整的文档内容]
===DOCUMENT_END===

3. 最后，用1-2句话做简短的完成说明（例如：文档已按照模板格式生成完成，您可以在右侧编辑器中查看和修改。）

标识说明：
- ===DOCUMENT_START=== 和 ===DOCUMENT_END=== 必须各占一行
- 只有生成完整文档时才使用这个格式
- 如果只是回答问题或给建议，直接回复即可，不需要使用标识

请根据用户的输入，生成符合模板格式的文档内容。`;

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

/* ============================== 主组件 ============================== */

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>(() => getAllKnowledgeBases());
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(() => getAllKnowledgeBases()[0] || null);
  const [selectedMode, setSelectedMode] = useState<WritingMode>(writingModes[0]);
  const [selectedStyle, setSelectedStyle] = useState<WritingStyle>(writingStyles[0]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [showKBModal, setShowKBModal] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pptMode, setPptMode] = useState(false);
  const [showPPTModal, setShowPPTModal] = useState(false);
  const [currentPPT, setCurrentPPT] = useState<PPTData | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  const documentEditorRef = useRef<HTMLTextAreaElement>(null);
  const documentEditorContainerRef = useRef<HTMLDivElement>(null);
  const userScrollPausedRef = useRef(false); // 用户手动滚动时暂停自动滚动
  const scrollResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollTopRef = useRef(0); // 记录上次滚动位置
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const templateFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  // 流式结束时重置滚动暂停状态
  useEffect(() => {
    if (!isStreaming) {
      userScrollPausedRef.current = false;
      if (scrollResumeTimerRef.current) {
        clearTimeout(scrollResumeTimerRef.current);
        scrollResumeTimerRef.current = null;
      }
    }
  }, [isStreaming]);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
        setShowModeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buildSystemPrompt = (userQuery: string) => {
    if (pptMode) {
      return PPT_SYSTEM_PROMPT;
    }
    // 获取知识库RAG上下文
    const ragContext = selectedKB ? buildPromptWithRAG(selectedKB, userQuery) : '';

    // 模板写作模式
    if (templateMode && templateData) {
      const parts: string[] = [];
      if (ragContext) {
        parts.push(ragContext);
      }
      parts.push(TEMPLATE_WRITING_PROMPT.replace('{TEMPLATE_CONTENT}', templateData.content));
      if (enableTypoFix) {
        parts.push(TYPO_FIX_PROMPT);
      }
      parts.push('重要约束：你的回复不能使用任何Markdown格式（包括但不限于标题#、加粗**、列表-/*、代码块```、链接[]()等）。请使用纯文本格式回复，用换行和空格来组织内容结构。');
      return parts.join('\n\n');
    }
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
    parts.push('重要约束：你的回复不能使用任何Markdown格式（包括但不限于标题#、加粗**、列表-/*、代码块```、链接[]()等）。请使用纯文本格式回复，用换行和空格来组织内容结构。');
    return parts.join('\n\n');
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

      const apiMessages = [
        { role: 'system', content: buildSystemPrompt(text) },
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
          max_tokens: 2048,
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
    setSelectedTemplate(template);
    setShowTemplates(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
        alert('不支持的文件格式，请上传 .txt、.md 或 .docx 文件');
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
        setTemplateData(newTemplate);
        setTemplateMode(true);
        setPptMode(false); // 退出PPT模式
        setMessages([]); // 清空对话
        setShowTemplateManager(false); // 关闭弹窗
      } else {
        alert('文件内容为空');
      }
    } catch (error) {
      console.error('文件读取失败:', error);
      alert('文件读取失败，请重试');
    }

    // 清空 input 以便再次选择同一文件
    e.target.value = '';
  };

  // 退出模板写作模式
  const exitTemplateMode = () => {
    setTemplateMode(false);
    setTemplateData(null);
    setMessages([]);
  };

  // 导出生成的内容
  const handleExportContent = () => {
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistantMsg?.content) {
      alert('没有可导出的内容');
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

  return (
    <div className="flex h-[calc(100vh-110px)] gap-4">
      {/* 对话区 - 根据编辑器状态调整宽度 */}
      <div className={`flex flex-col bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-300 ${
        showDocumentEditor ? 'w-1/2' : 'w-full max-w-4xl mx-auto'
      }`}>
        {/* 对话头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
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
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
                            <div className="flex items-center gap-2 text-purple-600">
                              <Presentation size={18} />
                              <span className="font-medium">
                                {isStreaming ? 'PPT生成中: ' : 'PPT已生成: '}
                                {pptData.title}
                              </span>
                              <span className="text-gray-400 text-xs">({pptData.slides.length}页)</span>
                              {isStreaming && <Loader2 size={14} className="animate-spin text-purple-500" />}
                            </div>
                            <div
                              className={`relative bg-gray-900 rounded-lg overflow-hidden ${isStreaming ? 'cursor-wait' : 'cursor-pointer group'}`}
                              style={{ width: '480px', height: '270px' }}
                              onClick={() => {
                                if (isStreaming) return;
                                setCurrentPPT(pptData);
                                setCurrentSlideIndex(0);
                                setShowPPTModal(true);
                              }}
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
                              {isStreaming ? (
                                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                                  <Loader2 size={32} className="text-white animate-spin mb-2" />
                                  <span className="text-white text-sm">PPT生成中...</span>
                                  <span className="text-gray-400 text-xs mt-1">已生成 {pptData.slides.length} 页</span>
                                </div>
                              ) : (
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-4 py-2 rounded-lg flex items-center gap-2 text-gray-800">
                                    <Maximize2 size={16} />
                                    <span>点击查看完整PPT</span>
                                  </div>
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
                              <div className="whitespace-pre-wrap">{docData.afterText}</div>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div className="whitespace-pre-wrap">
                          {message.content || (
                            <span className="flex items-center gap-2 text-gray-400">
                              <Loader2 size={14} className="animate-spin" />
                              {pptMode ? '正在生成PPT...' : templateMode ? '正在生成文档...' : '正在思考...'}
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
        <div className="border-t border-gray-200 px-4 py-3">
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
          {selectedMode.id === 'quick_writing' && !templateMode && (
            <div className="flex items-center gap-2 mb-2">
              {/* 模板按钮 */}
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  showTemplates || selectedTemplate
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700 border border-gray-200'
                }`}
              >
                <FileText size={14} />
                {selectedTemplate ? selectedTemplate.name : '模板'}
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

          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  handleTextareaInput();
                }}
                onKeyDown={handleKeyDown}
                placeholder={pptMode ? "输入PPT主题，如：人工智能发展趋势..." : templateMode ? "输入写作需求，AI将根据模板格式生成内容..." : selectedMode.id === 'quick_writing' ? "选择模板或直接输入内容..." : "输入消息，Shift+Enter 换行..."}
                rows={2}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[60px] max-h-[200px] overflow-y-auto"
                disabled={isStreaming}
              />
            </div>

            {isStreaming ? (
              <button
                onClick={handleStop}
                className="p-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shrink-0"
                title="停止生成"
              >
                <Square size={18} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!inputText.trim()}
                className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shrink-0"
                title="发送"
              >
                <Send size={18} />
              </button>
            )}
          </div>

          {/* 底部胶囊按钮区域 */}
          <div className="flex items-center gap-2 mt-3">
            {/* 知识库胶囊按钮 */}
            <button
              onClick={() => { setKnowledgeBases(getAllKnowledgeBases()); setShowKBModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors border border-blue-200"
            >
              <Database size={14} />
              <span>{selectedKB ? selectedKB.name : '不使用知识库'}</span>
              <ChevronDown size={14} />
            </button>

            {/* 快速写作按钮 */}
            <button
              onClick={() => {
                if (selectedMode.id === 'quick_writing') {
                  setSelectedMode(writingModes[0]); // 退出时切换到普通对话
                } else {
                  setSelectedMode(writingModes[1]); // 进入快速写作模式
                }
                setShowTemplates(false);
                setShowModeDropdown(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors border ${
                selectedMode.id === 'quick_writing'
                  ? 'bg-green-100 text-green-700 border-green-300'
                  : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
              }`}
            >
              <Pen size={14} />
              <span>{selectedMode.id === 'quick_writing' ? '退出快速写作' : '快速写作'}</span>
            </button>

            {/* 模板写作按钮 */}
            <button
              onClick={() => {
                if (templateMode) {
                  exitTemplateMode();
                } else {
                  setShowTemplateManager(true);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors border ${
                templateMode
                  ? 'bg-cyan-100 text-cyan-700 border-cyan-300'
                  : 'bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100'
              }`}
            >
              <Upload size={14} />
              <span>{templateMode ? '退出模板写作' : '模板写作'}</span>
            </button>

            {/* PPT工具按钮 */}
            <button
              onClick={() => {
                setPptMode(!pptMode);
                if (!pptMode) {
                  setMessages([]);
                  setTemplateMode(false);
                  setTemplateData(null);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors border ${
                pptMode
                  ? 'bg-orange-100 text-orange-700 border-orange-300'
                  : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
              }`}
            >
              <Presentation size={14} />
              <span>{pptMode ? '退出PPT模式' : '制作PPT'}</span>
            </button>

            <div className="flex-1" />

            <p className="text-xs text-gray-400">
              {pptMode ? '🎨 PPT模式' : templateMode ? '📝 模板写作' : `模型: ${API_CONFIG.model}`}
            </p>
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

      {/* 知识库选择弹窗 */}
      {showKBModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Database size={18} className="text-blue-600" />
                选择知识库
              </h3>
              <button
                onClick={() => setShowKBModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-3 max-h-80 overflow-y-auto">
              {/* 不使用知识库选项 */}
              <button
                onClick={() => { setSelectedKB(null); setShowKBModal(false); }}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-start gap-3 mb-1 ${
                  selectedKB === null
                    ? 'bg-gray-100 border-2 border-gray-300'
                    : 'hover:bg-gray-50 border-2 border-transparent'
                }`}
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                  <X size={16} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${selectedKB === null ? 'text-gray-700' : 'text-gray-600'}`}>
                    不使用知识库
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">AI 将仅基于自身知识回答</p>
                </div>
                {selectedKB === null && (
                  <Check size={18} className="text-gray-500 shrink-0" />
                )}
              </button>

              {/* 知识库列表 */}
              {knowledgeBases.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <p className="text-xs text-gray-400">暂无知识库，可在知识库管理中创建</p>
                </div>
              ) : (
                knowledgeBases.map(kb => (
                  <button
                    key={kb.id}
                    onClick={() => { setSelectedKB(kb); setShowKBModal(false); }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-start gap-3 mb-1 ${
                      selectedKB?.id === kb.id
                        ? 'bg-blue-50 border-2 border-blue-300'
                        : 'hover:bg-gray-50 border-2 border-transparent'
                    }`}
                  >
                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                      <Database size={16} className="text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${selectedKB?.id === kb.id ? 'text-blue-700' : 'text-gray-800'}`}>
                        {kb.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{kb.description || '无描述'}</p>
                      <p className="text-xs text-gray-400 mt-1">{kb.documents.length} 个文档 · {kb.totalChunks} 个分块</p>
                    </div>
                    {selectedKB?.id === kb.id && (
                      <Check size={18} className="text-blue-600 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setShowKBModal(false)}
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PPT预览弹窗 */}
      {showPPTModal && currentPPT && (
        <div className={`fixed inset-0 bg-black flex flex-col z-50 ${isFullscreen ? '' : 'p-4 md:p-8'}`}>
          {/* 顶部控制栏 */}
          <div className={`flex items-center justify-between px-4 py-3 bg-gray-900/80 backdrop-blur ${isFullscreen ? '' : 'rounded-t-xl'}`}>
            <div className="flex items-center gap-3">
              <Presentation size={20} className="text-white" />
              <span className="text-white font-medium">{currentPPT.title}</span>
              <span className="text-gray-400 text-sm">
                {currentSlideIndex + 1} / {currentPPT.slides.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title={isFullscreen ? '退出全屏' : '全屏'}
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button
                onClick={() => {
                  setShowPPTModal(false);
                  setIsFullscreen(false);
                }}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="关闭"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* PPT内容区 */}
          <div className={`flex-1 flex items-center justify-center bg-gray-900 relative ${isFullscreen ? '' : 'rounded-b-xl overflow-hidden'}`}>
            {/* 左箭头 */}
            <button
              onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
              disabled={currentSlideIndex === 0}
              className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-full transition-colors z-10"
            >
              <ChevronLeft size={24} className="text-white" />
            </button>

            {/* 幻灯片 - 1920x1080 缩放到 960x540 显示 */}
            <div
              className="mx-16 rounded-lg overflow-hidden shadow-2xl bg-gray-800 relative"
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
              className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-full transition-colors z-10"
            >
              <ChevronRight size={24} className="text-white" />
            </button>
          </div>

          {/* 底部缩略图 */}
          <div className={`flex items-center gap-2 px-4 py-3 bg-gray-900/80 backdrop-blur overflow-x-auto ${isFullscreen ? '' : 'rounded-b-xl'}`}>
            {currentPPT.slides.map((slide, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlideIndex(index)}
                className={`flex-shrink-0 rounded border-2 overflow-hidden transition-all relative ${
                  index === currentSlideIndex
                    ? 'border-blue-500 ring-2 ring-blue-500/50'
                    : 'border-gray-600 hover:border-gray-400'
                }`}
                style={{ width: '128px', height: '72px' }}
              >
                <div
                  className="origin-top-left absolute top-0 left-0"
                  style={{
                    width: '1920px',
                    height: '1080px',
                    transform: 'scale(0.0667)',
                  }}
                >
                  <div
                    style={{ width: '100%', height: '100%' }}
                    dangerouslySetInnerHTML={{ __html: slide }}
                  />
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
                        onClick={() => {
                          setTemplateData(tpl);
                          setTemplateMode(true);
                          setPptMode(false);
                          setMessages([]);
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
                    exitTemplateMode();
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
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                {templateData.content}
              </pre>
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
                    alert('已复制到剪贴板');
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
                  fontFamily: 'SimSun, "宋体", serif',
                  fontSize: '13px',
                  lineHeight: '1.8',
                  minHeight: '700px',
                }}
                placeholder="文档内容将显示在这里..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
