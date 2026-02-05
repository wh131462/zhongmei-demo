import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Database, Pen, FileText, Trash2,
  ChevronDown, Loader2, Square, RotateCcw, Copy, Check, X,
  Presentation, ChevronLeft, ChevronRight, Maximize2, Minimize2
} from 'lucide-react';

/* ============================== 配置与数据 ============================== */

const API_CONFIG = {
  url: 'http://183.252.196.133:38000/v1/chat/completions',
  key: 'sk-ycd03E09f7cG1',
  model: 'yantronic-o1-mini',
};

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
}

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

const knowledgeBases: KnowledgeBase[] = [
  {
    id: 'general',
    name: '通用知识库',
    description: '不限定领域，通用AI对话',
    icon: '🌐',
    systemPrompt: '你是一个智能助手，能够帮助用户回答各类问题。请用中文回复。',
  },
  {
    id: 'company',
    name: '企业制度',
    description: '公司规章制度、流程规范',
    icon: '🏢',
    systemPrompt: '你是企业内部的制度咨询助手，熟悉公司各项规章制度、考勤管理、报销流程、绩效考核等。请基于企业管理的专业知识来回答问题。请用中文回复。',
  },
  {
    id: 'legal',
    name: '法律法规',
    description: '法律条文、合规咨询',
    icon: '⚖️',
    systemPrompt: '你是法律咨询助手，熟悉中国法律法规。请基于法律专业知识为用户提供合规建议和法律解读。注意声明你的回答不构成正式法律意见。请用中文回复。',
  },
  {
    id: 'tech',
    name: '技术文档',
    description: '技术开发、API文档、最佳实践',
    icon: '💻',
    systemPrompt: '你是技术文档助手，擅长软件开发、系统架构、API设计等技术领域。请提供准确的技术解答和代码示例。请用中文回复。',
  },
  {
    id: 'sales',
    name: '销售话术',
    description: '销售技巧、客户沟通',
    icon: '💼',
    systemPrompt: '你是销售培训助手，擅长销售技巧、客户沟通、商务谈判等。请提供实用的销售策略和话术建议。请用中文回复。',
  },
];

const writingModes: WritingMode[] = [
  {
    id: 'normal',
    name: '标准对话',
    description: '正常的对话模式',
    systemPrompt: '',
  },
  {
    id: 'formal',
    name: '正式公文',
    description: '严谨、正式的公文写作风格',
    systemPrompt: '请使用正式、严谨的公文写作风格回复。语言要规范、用词准确、逻辑清晰，符合公文写作规范。',
  },
  {
    id: 'creative',
    name: '创意写作',
    description: '富有创意和文学性的表达',
    systemPrompt: '请使用富有创意和文学性的风格回复。可以适当使用修辞手法、比喻、排比等，让文字生动有感染力。',
  },
  {
    id: 'concise',
    name: '简洁精炼',
    description: '言简意赅，直击要点',
    systemPrompt: '请用最简洁的语言回复，直击要点，不要废话。每个要点用一句话概括，使用列表或编号格式。',
  },
  {
    id: 'explain',
    name: '详细解释',
    description: '深入浅出，循序渐进',
    systemPrompt: '请用深入浅出的方式详细解释，可以举例说明，确保即使是非专业人士也能理解。分步骤、分层次讲解。',
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

/* ============================== 主组件 ============================== */

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase>(knowledgeBases[0]);
  const [selectedMode, setSelectedMode] = useState<WritingMode>(writingModes[0]);
  const [showKBModal, setShowKBModal] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const buildSystemPrompt = () => {
    const parts = [selectedKB.systemPrompt];
    if (selectedMode.systemPrompt) {
      parts.push(selectedMode.systemPrompt);
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
        { role: 'system', content: buildSystemPrompt() },
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

  const templateCategories = [...new Set(promptTemplates.map(t => t.category))];

  return (
    <div className="flex justify-center h-[calc(100vh-110px)]">
      {/* 对话区 - 居中且限制最大宽度 */}
      <div className="w-full max-w-4xl flex flex-col bg-white rounded-lg shadow-sm overflow-hidden">
        {/* 对话头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-blue-600" />
            <span className="font-medium text-gray-800">AI 助手</span>
          </div>
          <div className="flex items-center gap-2">
            {/* 右上角模板按钮 */}
            <div className="relative">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  showTemplates
                    ? 'bg-green-100 text-green-700'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <FileText size={16} />
                模板
              </button>

              {/* 模板下拉面板 */}
              {showTemplates && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-30 overflow-hidden">
                  <div className="p-3 border-b border-gray-100 bg-gray-50">
                    <h4 className="font-medium text-gray-700 text-sm">提示词模板</h4>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2">
                    {templateCategories.map(category => (
                      <div key={category} className="mb-2">
                        <p className="text-xs text-gray-400 font-medium px-2 py-1">{category}</p>
                        {promptTemplates.filter(t => t.category === category).map(template => (
                          <button
                            key={template.id}
                            onClick={() => handleTemplateSelect(template)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-green-50 hover:text-green-700 rounded-lg transition-colors"
                          >
                            {template.name}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

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
                    <div className="whitespace-pre-wrap">
                      {message.content || (
                        <span className="flex items-center gap-2 text-gray-400">
                          <Loader2 size={14} className="animate-spin" />
                          正在思考...
                        </span>
                      )}
                    </div>
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
                placeholder="输入消息，Shift+Enter 换行..."
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
              onClick={() => setShowKBModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors border border-blue-200"
            >
              <Database size={14} />
              <span>{selectedKB.icon} {selectedKB.name}</span>
              <ChevronDown size={14} />
            </button>

            {/* 写作模式胶囊按钮 */}
            <div className="relative" ref={modeDropdownRef}>
              <button
                onClick={() => setShowModeDropdown(!showModeDropdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 transition-colors border border-purple-200"
              >
                <Pen size={14} />
                <span>{selectedMode.name}</span>
                <ChevronDown size={14} className={`transition-transform ${showModeDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* 写作模式下拉框 */}
              {showModeDropdown && (
                <div className="absolute bottom-full mb-2 left-0 w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-30 overflow-hidden">
                  {writingModes.map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => { setSelectedMode(mode); setShowModeDropdown(false); }}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-purple-50 transition-colors ${
                        selectedMode.id === mode.id ? 'bg-purple-50 text-purple-700' : ''
                      }`}
                    >
                      <p className="font-medium">{mode.name}</p>
                      <p className="text-xs text-gray-400">{mode.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1" />

            <p className="text-xs text-gray-400">
              模型: {API_CONFIG.model}
            </p>
          </div>
        </div>
      </div>

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
              {knowledgeBases.map(kb => (
                <button
                  key={kb.id}
                  onClick={() => { setSelectedKB(kb); setShowKBModal(false); }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-start gap-3 mb-1 ${
                    selectedKB.id === kb.id
                      ? 'bg-blue-50 border-2 border-blue-300'
                      : 'hover:bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <span className="text-2xl">{kb.icon}</span>
                  <div>
                    <p className={`font-medium ${selectedKB.id === kb.id ? 'text-blue-700' : 'text-gray-800'}`}>
                      {kb.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{kb.description}</p>
                  </div>
                  {selectedKB.id === kb.id && (
                    <Check size={18} className="text-blue-600 ml-auto shrink-0" />
                  )}
                </button>
              ))}
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
    </div>
  );
}
