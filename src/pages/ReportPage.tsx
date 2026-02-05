import { useState, useRef } from 'react';
import {
  CalendarDays, FileText, Calendar, BarChart3, Upload, Trash2, Sparkles,
  Eye, X, Loader2, FileUp, CheckCircle2, AlertCircle
} from 'lucide-react';
import * as mammoth from 'mammoth';
import type { UploadedDailyFile } from '../types';

type Tab = 'daily' | 'weekly' | 'monthly';

const API_CONFIG = {
  url: 'http://183.252.196.133:38000/v1/chat/completions',
  key: 'sk-ycd03E09f7cG1',
  model: 'yantronic-o1-mini',
};

const MAX_FILES = 10;

export default function ReportPage() {
  const [activeTab, setActiveTab] = useState<Tab>('daily');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedDailyFile[]>([]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <div className="flex">
            <TabButton
              active={activeTab === 'daily'}
              onClick={() => setActiveTab('daily')}
              icon={<CalendarDays size={18} />}
              label="日报上传"
              badge={uploadedFiles.length}
            />
            <TabButton
              active={activeTab === 'weekly'}
              onClick={() => setActiveTab('weekly')}
              icon={<Calendar size={18} />}
              label="生成周报"
            />
            <TabButton
              active={activeTab === 'monthly'}
              onClick={() => setActiveTab('monthly')}
              icon={<BarChart3 size={18} />}
              label="生成月报"
            />
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'daily' && (
            <DailyTab files={uploadedFiles} setFiles={setUploadedFiles} />
          )}
          {activeTab === 'weekly' && (
            <WeeklyTab files={uploadedFiles} />
          )}
          {activeTab === 'monthly' && (
            <MonthlyTab files={uploadedFiles} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== Tab Button ============================== */

function TabButton({ active, onClick, icon, label, badge }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
          active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

/* ============================== 日报上传 Tab ============================== */

function DailyTab({ files, setFiles }: {
  files: UploadedDailyFile[];
  setFiles: (files: UploadedDailyFile[]) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewFile, setPreviewFile] = useState<UploadedDailyFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    await processFiles(droppedFiles);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    await processFiles(selectedFiles);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFiles = async (newFiles: File[]) => {
    setError(null);

    // 过滤 .docx 文件
    const docxFiles = newFiles.filter(f =>
      f.name.endsWith('.docx') || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    if (docxFiles.length !== newFiles.length) {
      setError('部分文件格式不支持，仅支持 .docx 格式的 Word 文件');
    }

    // 检查数量限制
    const remainingSlots = MAX_FILES - files.length;
    if (docxFiles.length > remainingSlots) {
      setError(`最多只能上传 ${MAX_FILES} 个文件，当前还可上传 ${remainingSlots} 个`);
      docxFiles.splice(remainingSlots);
    }

    if (docxFiles.length === 0) return;

    setIsProcessing(true);

    const newUploadedFiles: UploadedDailyFile[] = [];

    for (const file of docxFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });

        newUploadedFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          fileName: file.name,
          content: result.value,
          uploadTime: Date.now(),
        });
      } catch {
        setError(`文件 "${file.name}" 解析失败，请确保是有效的 Word 文档`);
      }
    }

    setFiles([...files, ...newUploadedFiles]);
    setIsProcessing(false);
  };

  const handleDelete = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const handleClearAll = () => {
    setFiles([]);
    setError(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">日报文件上传</h2>
          <p className="text-sm text-gray-500 mt-1">
            上传 Word 文档（.docx），最多 {MAX_FILES} 个，系统将提取文本内容用于生成周报和月报
          </p>
        </div>
        {files.length > 0 && (
          <button
            onClick={handleClearAll}
            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1"
          >
            <Trash2 size={14} />
            清空全部
          </button>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* 上传区域 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : files.length >= MAX_FILES
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer'
        }`}
        onClick={() => files.length < MAX_FILES && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={files.length >= MAX_FILES || isProcessing}
        />

        {isProcessing ? (
          <div className="flex flex-col items-center">
            <Loader2 size={40} className="text-blue-500 animate-spin mb-3" />
            <p className="text-gray-600 font-medium">正在解析文件...</p>
          </div>
        ) : files.length >= MAX_FILES ? (
          <div className="flex flex-col items-center text-gray-400">
            <FileUp size={40} className="mb-3 opacity-50" />
            <p className="font-medium">已达到最大上传数量（{MAX_FILES} 个）</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload size={40} className={`mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="text-gray-600 font-medium mb-1">
              {isDragging ? '松开以上传文件' : '拖拽 Word 文件到这里，或点击选择'}
            </p>
            <p className="text-sm text-gray-400">
              支持 .docx 格式，已上传 {files.length}/{MAX_FILES} 个
            </p>
          </div>
        )}
      </div>

      {/* 已上传文件列表 */}
      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <FileText size={16} />
            已上传文件（{files.length} 个）
          </h3>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow bg-white"
              >
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-medium flex items-center justify-center">
                  {index + 1}
                </span>
                <FileText size={18} className="text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{file.fileName}</p>
                  <p className="text-xs text-gray-400">
                    {file.content.length} 字符 &middot; {new Date(file.uploadTime).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setPreviewFile(file)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="预览内容"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => handleDelete(file.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {files.length === 0 && !isProcessing && (
        <div className="text-center py-8 text-gray-400 mt-4">
          <FileUp size={48} className="mx-auto mb-4 opacity-50" />
          <p>暂无上传文件</p>
          <p className="text-sm mt-1">上传日报 Word 文档后，可在周报/月报标签页生成汇总报告</p>
        </div>
      )}

      {/* 预览弹窗 */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 truncate">
                <FileText size={18} className="text-blue-600 shrink-0" />
                <span className="truncate">{previewFile.fileName}</span>
              </h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
                {previewFile.content}
              </pre>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-400">
                共 {previewFile.content.length} 字符
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== 周报生成 Tab ============================== */

function WeeklyTab({ files }: { files: UploadedDailyFile[] }) {
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const toggleFileSelection = (id: string) => {
    const newSet = new Set(selectedFileIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedFileIds(newSet);
  };

  const selectAll = () => {
    setSelectedFileIds(new Set(files.map(f => f.id)));
  };

  const deselectAll = () => {
    setSelectedFileIds(new Set());
  };

  const handleGenerate = async () => {
    if (selectedFileIds.size === 0) return;

    const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
    const combinedContent = selectedFiles
      .map((f, i) => `=== 日报 ${i + 1}/${selectedFiles.length}：${f.fileName} ===\n${f.content}\n=== 日报 ${i + 1} 结束 ===`)
      .join('\n\n');

    setIsGenerating(true);
    setResult('');
    setError(null);

    const systemPrompt = `你是一个专业的工作报告撰写助手。用户会提供多份日报内容，请根据这些内容生成一份周报。

重要规则（必须严格遵守）：
- 用户共提供了 ${selectedFiles.length} 份日报文件，你必须逐份完整阅读每一份日报，不得跳过或遗漏任何一份
- 每份日报的内容都用 "=== 日报 N ===" 标记了开始和结束，请确认你阅读了从日报 1 到日报 ${selectedFiles.length} 的全部内容
- 生成周报时，必须覆盖所有日报中提到的工作事项，不能因为内容多就省略部分日报

输出要求：
1. 提取并整合每一份日报中的关键工作内容，确保无遗漏
2. 按项目或工作类别进行归类汇总
3. 总结本周的主要成果和进展
4. 指出遇到的问题和下周计划（如有）
5. 语言要简洁专业，格式清晰

请直接输出周报内容，使用纯文本格式（不要使用 Markdown 格式）。`;

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch(API_CONFIG.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.key}`,
        },
        body: JSON.stringify({
          model: API_CONFIG.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `以下是本周的 ${selectedFiles.length} 份日报内容，请逐份完整阅读后生成周报。注意：每一份日报都不能遗漏。\n\n${combinedContent}` }
          ],
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
                setResult(fullContent);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 用户主动停止
      } else {
        const errorMsg = err instanceof Error ? err.message : '未知错误';
        setError(`生成失败: ${errorMsg}`);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">AI 智能生成周报</h2>
        <p className="text-sm text-gray-500 mt-1">选择日报文件，AI 将分析内容并生成周报汇总</p>
      </div>

      {files.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Calendar size={48} className="mx-auto mb-4 opacity-50" />
          <p>暂无上传的日报文件</p>
          <p className="text-sm mt-1">请先在"日报上传"标签页上传日报文件</p>
        </div>
      ) : (
        <>
          {/* 文件选择 */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">
                选择日报文件（已选 {selectedFileIds.size}/{files.length}）
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  全选
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={deselectAll}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  取消全选
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map(file => (
                <label
                  key={file.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedFileIds.has(file.id)
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-white border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFileIds.has(file.id)}
                    onChange={() => toggleFileSelection(file.id)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <FileText size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700 truncate flex-1">{file.fileName}</span>
                  <span className="text-xs text-gray-400">{file.content.length} 字</span>
                </label>
              ))}
            </div>
          </div>

          {/* 生成按钮 */}
          <div className="flex items-center gap-3 mb-6">
            {isGenerating ? (
              <button
                onClick={handleStop}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm"
              >
                <X size={16} />
                停止生成
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={selectedFileIds.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                <Sparkles size={16} />
                AI 生成周报
              </button>
            )}
            {selectedFileIds.size === 0 && !isGenerating && (
              <span className="text-sm text-gray-400">请先选择日报文件</span>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* 生成中动画 */}
          {isGenerating && !result && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
              <div className="flex items-center justify-center mb-4">
                <span className="ai-loading-dot"></span>
                <span className="ai-loading-dot"></span>
                <span className="ai-loading-dot"></span>
              </div>
              <p className="text-blue-700 font-medium">AI 正在分析日报内容...</p>
              <p className="text-sm text-blue-500 mt-2">整合多日工作内容 &middot; 提炼关键信息 &middot; 生成周报</p>
            </div>
          )}

          {/* 生成结果 */}
          {result && (
            <div className="border border-green-200 bg-green-50/50 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-green-100/50 border-b border-green-200">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-green-600" />
                  AI 生成周报
                  {isGenerating && <Loader2 size={14} className="animate-spin text-blue-500" />}
                </h3>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1 text-sm text-green-700 hover:bg-green-200 rounded-lg transition-colors"
                >
                  复制内容
                </button>
              </div>
              <div className="p-4">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
                  {result}
                </pre>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================== 月报生成 Tab ============================== */

function MonthlyTab({ files }: { files: UploadedDailyFile[] }) {
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const toggleFileSelection = (id: string) => {
    const newSet = new Set(selectedFileIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedFileIds(newSet);
  };

  const selectAll = () => {
    setSelectedFileIds(new Set(files.map(f => f.id)));
  };

  const deselectAll = () => {
    setSelectedFileIds(new Set());
  };

  const handleGenerate = async () => {
    if (selectedFileIds.size === 0) return;

    const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
    const combinedContent = selectedFiles
      .map((f, i) => `=== 日报 ${i + 1}/${selectedFiles.length}：${f.fileName} ===\n${f.content}\n=== 日报 ${i + 1} 结束 ===`)
      .join('\n\n');

    setIsGenerating(true);
    setResult('');
    setError(null);

    const systemPrompt = `你是一个专业的工作报告撰写助手。用户会提供多份日报内容，请根据这些内容生成一份月报。

重要规则（必须严格遵守）：
- 用户共提供了 ${selectedFiles.length} 份日报文件，你必须逐份完整阅读每一份日报，不得跳过或遗漏任何一份
- 每份日报的内容都用 "=== 日报 N ===" 标记了开始和结束，请确认你阅读了从日报 1 到日报 ${selectedFiles.length} 的全部内容
- 生成月报时，必须覆盖所有日报中提到的工作事项，不能因为内容多就省略部分日报

输出要求：
1. 全面梳理所有日报中的工作内容，按重要性和类别组织，确保无遗漏
2. 突出本月的重点项目和主要成果
3. 总结本月工作的整体情况（完成率、效率等）
4. 分析存在的问题和不足
5. 提出下月工作计划和改进措施
6. 语言要正式专业，适合作为月度工作汇报

请直接输出月报内容，使用纯文本格式（不要使用 Markdown 格式）。`;

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch(API_CONFIG.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.key}`,
        },
        body: JSON.stringify({
          model: API_CONFIG.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `以下是本月的 ${selectedFiles.length} 份日报内容，请逐份完整阅读后生成月报。注意：每一份日报都不能遗漏。\n\n${combinedContent}` }
          ],
          stream: true,
          temperature: 0.7,
          max_tokens: 8192,
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
                setResult(fullContent);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 用户主动停止
      } else {
        const errorMsg = err instanceof Error ? err.message : '未知错误';
        setError(`生成失败: ${errorMsg}`);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">AI 智能生成月报</h2>
        <p className="text-sm text-gray-500 mt-1">选择日报文件，AI 将综合分析并生成月度工作报告</p>
      </div>

      {files.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
          <p>暂无上传的日报文件</p>
          <p className="text-sm mt-1">请先在"日报上传"标签页上传日报文件</p>
        </div>
      ) : (
        <>
          {/* 文件选择 */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">
                选择日报文件（已选 {selectedFileIds.size}/{files.length}）
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  全选
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={deselectAll}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  取消全选
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map(file => (
                <label
                  key={file.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedFileIds.has(file.id)
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-white border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFileIds.has(file.id)}
                    onChange={() => toggleFileSelection(file.id)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <FileText size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700 truncate flex-1">{file.fileName}</span>
                  <span className="text-xs text-gray-400">{file.content.length} 字</span>
                </label>
              ))}
            </div>
          </div>

          {/* 生成按钮 */}
          <div className="flex items-center gap-3 mb-6">
            {isGenerating ? (
              <button
                onClick={handleStop}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm"
              >
                <X size={16} />
                停止生成
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={selectedFileIds.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                <Sparkles size={16} />
                AI 生成月报
              </button>
            )}
            {selectedFileIds.size === 0 && !isGenerating && (
              <span className="text-sm text-gray-400">请先选择日报文件</span>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* 生成中动画 */}
          {isGenerating && !result && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
              <div className="flex items-center justify-center mb-4">
                <span className="ai-loading-dot"></span>
                <span className="ai-loading-dot"></span>
                <span className="ai-loading-dot"></span>
              </div>
              <p className="text-blue-700 font-medium">AI 正在分析日报内容...</p>
              <p className="text-sm text-blue-500 mt-2">整合月度工作内容 &middot; 分析工作成果 &middot; 生成月报</p>
            </div>
          )}

          {/* 生成结果 */}
          {result && (
            <div className="border border-green-200 bg-green-50/50 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-green-100/50 border-b border-green-200">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-green-600" />
                  AI 生成月报
                  {isGenerating && <Loader2 size={14} className="animate-spin text-blue-500" />}
                </h3>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1 text-sm text-green-700 hover:bg-green-200 rounded-lg transition-colors"
                >
                  复制内容
                </button>
              </div>
              <div className="p-4">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
                  {result}
                </pre>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
