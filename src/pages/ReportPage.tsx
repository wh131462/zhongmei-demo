import { useState, useRef, useEffect } from 'react';
import {
  CalendarDays, FileText, Calendar, BarChart3, Trash2, Sparkles,
  Eye, X, Loader2, FileUp, CheckCircle2, AlertCircle, Download, Save, History, ChevronDown, ChevronUp, Edit3,
  ChevronLeft, ChevronRight, Plus
} from 'lucide-react';
import { message } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { marked } from 'marked';
import { parseFile } from '../services/fileParserService';
import {
  saveDailyFiles, loadDailyFiles,
  saveWeeklyReports, loadWeeklyReports,
  saveMonthlyReports, loadMonthlyReports
} from '../services/reportStorageService';
import type { UploadedDailyFile, GeneratedWeeklyReport, GeneratedMonthlyReport, ReportTemplate } from '../types';

type Tab = 'daily' | 'weekly' | 'monthly';

const API_CONFIG = {
  url: 'http://183.252.196.133:38000/v1/chat/completions',
  key: 'sk-ycd03E09f7cG1',
  model: 'yantronic-o1-mini',
};

const MAX_FILES = 10;

const ACCEPTED_FILE_TYPES = [
  '.docx', '.pdf'
];
const ACCEPTED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/pdf', // pdf
];

// 报告模板配置
const TEMPLATE_CONFIG: Record<ReportTemplate, { name: string; description: string }> = {
  concise: { name: '简洁版', description: '重点突出，条目清晰' },
  detailed: { name: '详细版', description: '保留所有细节' },
  formal: { name: '正式版', description: '正式公文风格' },
};

// 模板对应的 prompt 修饰
const TEMPLATE_PROMPTS: Record<ReportTemplate, string> = {
  concise: `
【输出风格要求 - 简洁版】
- 采用简洁明了的条目式结构
- 每个工作项不超过2句话
- 突出关键成果和数据
- 省略过程性描述，只保留结论
- 总字数控制在原始内容的30%以内`,
  detailed: `
【输出风格要求 - 详细版】
- 保留所有工作细节和过程描述
- 包含具体的时间节点、人员、系统名称
- 详细说明每项工作的背景、过程、结果
- 保持与原始日报相近的详细程度`,
  formal: `
【输出风格要求 - 正式版】
- 采用正式公文风格
- 使用规范的书面语言，避免口语化表达
- 结构严谨：概述→分项汇报→总结
- 适当使用"本周/本月"、"顺利完成"、"稳步推进"等正式用语
- 适合向上级领导汇报`,
};

/**
 * 导出文本内容为 Word 文档（支持 Markdown 格式渲染）
 */
const exportToWord = (content: string, filename: string) => {
  const htmlBody = marked(content, { async: false }) as string;

  const htmlContent = `
    <!DOCTYPE html>
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
      <style>
        body {
          font-family: "Microsoft YaHei", "SimSun", Arial, sans-serif;
          font-size: 14px;
          line-height: 1.8;
          padding: 40px;
        }
        h1 { font-size: 22px; font-weight: bold; margin: 16px 0 8px; }
        h2 { font-size: 18px; font-weight: bold; margin: 14px 0 6px; }
        h3 { font-size: 16px; font-weight: bold; margin: 12px 0 4px; }
        p { margin: 0 0 8px 0; }
        ul, ol { margin: 4px 0 8px 20px; }
        li { margin: 2px 0; }
        table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        th, td { border: 1px solid #999; padding: 6px 10px; text-align: left; }
        th { background-color: #f0f0f0; font-weight: bold; }
        strong { font-weight: bold; }
        em { font-style: italic; }
        blockquote { margin: 8px 0; padding-left: 12px; border-left: 3px solid #ccc; color: #555; }
      </style>
    </head>
    <body>
      ${htmlBody}
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + htmlContent], {
    type: 'application/msword'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function ReportPage() {
  const [activeTab, setActiveTab] = useState<Tab>('daily');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedDailyFile[]>([]);
  const [weeklyResult, setWeeklyResult] = useState<string>('');
  const [monthlyResult, setMonthlyResult] = useState<string>('');
  const [weeklyHistory, setWeeklyHistory] = useState<GeneratedWeeklyReport[]>([]);
  const [monthlyHistory, setMonthlyHistory] = useState<GeneratedMonthlyReport[]>([]);

  // 初始化时从 localStorage 加载数据
  useEffect(() => {
    setUploadedFiles(loadDailyFiles());
    setWeeklyHistory(loadWeeklyReports());
    setMonthlyHistory(loadMonthlyReports());
  }, []);

  // 日报文件变化时保存
  useEffect(() => {
    if (uploadedFiles.length > 0 || loadDailyFiles().length > 0) {
      saveDailyFiles(uploadedFiles);
    }
  }, [uploadedFiles]);

  // 周报历史变化时保存
  useEffect(() => {
    if (weeklyHistory.length > 0 || loadWeeklyReports().length > 0) {
      saveWeeklyReports(weeklyHistory);
    }
  }, [weeklyHistory]);

  // 月报历史变化时保存
  useEffect(() => {
    if (monthlyHistory.length > 0 || loadMonthlyReports().length > 0) {
      saveMonthlyReports(monthlyHistory);
    }
  }, [monthlyHistory]);

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
              badge={weeklyResult ? 1 : undefined}
            />
            <TabButton
              active={activeTab === 'monthly'}
              onClick={() => setActiveTab('monthly')}
              icon={<BarChart3 size={18} />}
              label="生成月报"
              badge={monthlyResult ? 1 : undefined}
            />
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'daily' && (
            <DailyTab files={uploadedFiles} setFiles={setUploadedFiles} />
          )}
          {activeTab === 'weekly' && (
            <WeeklyTab
              files={uploadedFiles}
              result={weeklyResult}
              setResult={setWeeklyResult}
              history={weeklyHistory}
              setHistory={setWeeklyHistory}
            />
          )}
          {activeTab === 'monthly' && (
            <MonthlyTab
              files={uploadedFiles}
              result={monthlyResult}
              setResult={setMonthlyResult}
              weeklyHistory={weeklyHistory}
              history={monthlyHistory}
              setHistory={setMonthlyHistory}
            />
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewFile, setPreviewFile] = useState<UploadedDailyFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 生成当前月的所有日期
  const getDaysInMonth = (month: Dayjs) => {
    const startOfMonth = month.startOf('month');
    const endOfMonth = month.endOf('month');
    const days: Dayjs[] = [];
    let current = startOfMonth;
    while (current.isBefore(endOfMonth) || current.isSame(endOfMonth, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }
    return days;
  };

  const daysInMonth = getDaysInMonth(currentMonth);

  // 获取某个日期的日报列表
  const getFilesForDate = (dateStr: string) => {
    return files.filter(f => f.workDate === dateStr);
  };

  // 上传文件处理
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (selectedFiles.length === 0) return;

    setError(null);
    const validFiles = selectedFiles.filter(f =>
      ACCEPTED_MIME_TYPES.includes(f.type) ||
      ACCEPTED_FILE_TYPES.some(ext => f.name.toLowerCase().endsWith(ext))
    );

    if (validFiles.length !== selectedFiles.length) {
      setError('部分文件格式不支持，仅支持 .docx、.pdf 格式');
    }

    const remainingSlots = MAX_FILES - files.length;
    if (validFiles.length > remainingSlots) {
      setError(`最多只能上传 ${MAX_FILES} 个文件，当前还可上传 ${remainingSlots} 个`);
      validFiles.splice(remainingSlots);
    }

    if (validFiles.length === 0) return;

    setIsProcessing(true);
    const newUploadedFiles: UploadedDailyFile[] = [];

    for (const file of validFiles) {
      const result = await parseFile(file);
      if (result.success) {
        newUploadedFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          fileName: file.name,
          content: result.content,
          uploadTime: Date.now(),
          workDate: selectedDate,
        });
      } else {
        setError(result.error || `文件 "${file.name}" 解析失败`);
      }
    }

    setFiles([...files, ...newUploadedFiles]);
    setIsProcessing(false);
  };

  const handleDelete = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  // 横向滚动
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  // 月份切换
  const prevMonth = () => setCurrentMonth(currentMonth.subtract(1, 'month'));
  const nextMonth = () => setCurrentMonth(currentMonth.add(1, 'month'));

  // 星期几标签
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">日报管理</h2>
        <p className="text-sm text-gray-500 mt-1">
          点击日期上传日报，支持 .docx、.pdf 格式，最多 {MAX_FILES} 个
        </p>
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

      {/* 月份切换头部 */}
      <div className="flex items-center justify-between mb-4 px-2">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <h3 className="text-lg font-medium text-gray-800">
          {currentMonth.format('YYYY年M月')}
        </h3>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      {/* 横向日期滚动条 */}
      <div className="relative mb-6">
        <button
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white shadow-md rounded-full flex items-center justify-center hover:bg-gray-50"
        >
          <ChevronLeft size={18} className="text-gray-600" />
        </button>

        <div
          ref={scrollContainerRef}
          className="overflow-x-auto scrollbar-hide mx-10 flex gap-2 py-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {daysInMonth.map((day) => {
            const dateStr = day.format('YYYY-MM-DD');
            const dayFiles = getFilesForDate(dateStr);
            const isToday = day.isSame(dayjs(), 'day');
            const isSelected = dateStr === selectedDate;
            const isWeekend = day.day() === 0 || day.day() === 6;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`flex-shrink-0 w-14 h-16 rounded-lg flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-lg scale-105'
                    : isToday
                      ? 'bg-blue-50 border-2 border-blue-300 text-blue-600'
                      : dayFiles.length > 0
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : isWeekend
                          ? 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                          : 'bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                <span className="text-xs">{weekDays[day.day()]}</span>
                <span className="text-lg font-semibold">{day.date()}</span>
                {dayFiles.length > 0 && !isSelected && (
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-0.5"></span>
                )}
                {dayFiles.length > 0 && isSelected && (
                  <span className="text-xs">{dayFiles.length}份</span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={scrollRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white shadow-md rounded-full flex items-center justify-center hover:bg-gray-50"
        >
          <ChevronRight size={18} className="text-gray-600" />
        </button>
      </div>

      {/* 当天日报时间线 */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-800 flex items-center gap-2">
            <CalendarDays size={18} className="text-blue-600" />
            {dayjs(selectedDate).format('M月D日')} {weekDays[dayjs(selectedDate).day()]}
            {dayjs(selectedDate).isSame(dayjs(), 'day') && (
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">今天</span>
            )}
          </h3>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES.join(',')}
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={files.length >= MAX_FILES || isProcessing}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= MAX_FILES || isProcessing}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isProcessing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <Plus size={14} />
                上传日报
              </>
            )}
          </button>
        </div>

        {/* 当天的日报列表 */}
        {getFilesForDate(selectedDate).length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FileUp size={40} className="mx-auto mb-3 opacity-50" />
            <p>该日暂无日报</p>
            <p className="text-sm mt-1">点击上方"上传日报"添加</p>
          </div>
        ) : (
          <div className="space-y-2">
            {getFilesForDate(selectedDate).map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
              >
                <FileText size={18} className="text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{file.fileName}</p>
                  <p className="text-xs text-gray-400">
                    {file.content.length} 字符 &middot; {new Date(file.uploadTime).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={() => setPreviewFile(file)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="预览"
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
        )}
      </div>

      {/* 全部日报汇总 */}
      {files.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">
              全部日报（{files.length}/{MAX_FILES}）
            </h3>
            <button
              onClick={() => setFiles([])}
              className="text-xs text-red-500 hover:text-red-600"
            >
              清空全部
            </button>
          </div>
          <div className="text-xs text-gray-500 flex flex-wrap gap-2">
            {Array.from(new Set(files.map(f => f.workDate).filter(Boolean))).sort().map(date => (
              <span
                key={date}
                onClick={() => setSelectedDate(date!)}
                className="px-2 py-1 bg-green-50 text-green-700 rounded cursor-pointer hover:bg-green-100"
              >
                {dayjs(date).format('M/D')} ({files.filter(f => f.workDate === date).length})
              </span>
            ))}
            {files.filter(f => !f.workDate).length > 0 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded">
                未设置日期 ({files.filter(f => !f.workDate).length})
              </span>
            )}
          </div>
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
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
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
              <p className="text-xs text-gray-400">共 {previewFile.content.length} 字符</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== 周报生成 Tab ============================== */

function WeeklyTab({ files, result, setResult, history, setHistory }: {
  files: UploadedDailyFile[];
  result: string;
  setResult: (value: string) => void;
  history: GeneratedWeeklyReport[];
  setHistory: (reports: GeneratedWeeklyReport[]) => void;
}) {
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template] = useState<ReportTemplate>('detailed');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(dayjs().startOf('isoWeek'));
  const [previewFile, setPreviewFile] = useState<UploadedDailyFile | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 获取当前周的日期列表（周一到周日）
  const getWeekDays = (weekStart: Dayjs) => {
    const days: Dayjs[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(weekStart.add(i, 'day'));
    }
    return days;
  };

  const weekDays = getWeekDays(currentWeekStart);
  const weekDayLabels = ['一', '二', '三', '四', '五', '六', '日'];

  // 获取某个日期的日报
  const getFilesForDate = (dateStr: string) => {
    return files.filter(f => f.workDate === dateStr);
  };

  // 选择某天的所有日报
  const toggleDateSelection = (dateStr: string) => {
    const dateFiles = getFilesForDate(dateStr);
    const newSet = new Set(selectedFileIds);
    const allSelected = dateFiles.every(f => selectedFileIds.has(f.id));

    if (allSelected) {
      dateFiles.forEach(f => newSet.delete(f.id));
    } else {
      dateFiles.forEach(f => newSet.add(f.id));
    }
    setSelectedFileIds(newSet);
  };

  // 切换单个文件选择
  const toggleFileSelection = (id: string) => {
    const newSet = new Set(selectedFileIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedFileIds(newSet);
  };

  // 选择整周
  const selectAllWeek = () => {
    const allIds = new Set<string>();
    weekDays.forEach(day => {
      getFilesForDate(day.format('YYYY-MM-DD')).forEach(f => allIds.add(f.id));
    });
    setSelectedFileIds(allIds);
  };

  // 取消选择
  const deselectAll = () => {
    setSelectedFileIds(new Set());
  };

  // 周切换
  const prevWeek = () => {
    setCurrentWeekStart(currentWeekStart.subtract(1, 'week'));
    setSelectedFileIds(new Set());
  };
  const nextWeek = () => {
    setCurrentWeekStart(currentWeekStart.add(1, 'week'));
    setSelectedFileIds(new Set());
  };
  const goToThisWeek = () => {
    setCurrentWeekStart(dayjs().startOf('isoWeek'));
    setSelectedFileIds(new Set());
  };

  // 计算本周有多少日报
  const weekFileCount = weekDays.reduce((sum, day) => sum + getFilesForDate(day.format('YYYY-MM-DD')).length, 0);

  const handleGenerate = async () => {
    if (selectedFileIds.size === 0) return;

    const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
    const combinedContent = selectedFiles
      .map((f, i) => `=== 日报 ${i + 1}/${selectedFiles.length}：${f.fileName}${f.workDate ? ` (${f.workDate})` : ''} ===\n${f.content}\n=== 日报 ${i + 1} 结束 ===`)
      .join('\n\n');

    setIsGenerating(true);
    setResult('');
    setError(null);
    setIsEditing(false);

    const systemPrompt = `你是一个专业的工作报告撰写助手。用户会提供多份日报内容，请根据这些内容生成一份周报。

【核心原则 - 必须严格遵守】
1. 完整性原则：用户共提供了 ${selectedFiles.length} 份日报，你必须逐份完整阅读每一份，从"日报 1"到"日报 ${selectedFiles.length}"，不得���过或遗漏任何一份
2. 真实性原则：所有内容必须100%来源于日报原文，严禁编造、推测或添加日报中未提及的任何信息
3. 信息密度原则：保留日报中的具体细节（项目名称、任务描述、数据指标、人员等），避免空泛概括
4. 风格一致性原则：保持与日报原文相近的表述风格和专业术语，不要过度改写

【输出要求】
1. 按项目或工作类别归类整合所有日报内容，确保每份日报的工作事项都被覆盖
2. 保留关键细节：具体任务名称、进度百分比、数量指标、涉及人员/系统等
3. 总结本周主要成果和进展（必须有日报依据）
4. 列出遇到的问题和下周计划（仅当日报中有提及时才写，没有则不写）
5. 语言简洁专业，格式清晰

【禁止事项】
- 禁止添加日报中没有的工作内容
- 禁止使用"等"、"若干"等模糊词汇替代具体信息
- 禁止编造数据、进度或结论
- 禁止遗漏任何一份日报的内容
${TEMPLATE_PROMPTS[template]}
请直接输出周报内容，使用 Markdown 格式（支持标题、列表、加粗等）。`;

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
          temperature: 0.3,
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
    const content = isEditing ? editContent : result;
    navigator.clipboard.writeText(content);
    message.success('已复制到剪贴板');
  };

  // 进入编辑模式
  const handleEdit = () => {
    setEditContent(result);
    setIsEditing(true);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  // 保存编辑
  const handleSaveEdit = () => {
    setResult(editContent);
    setIsEditing(false);
  };

  // 保存到历史
  const handleSaveToHistory = () => {
    const content = isEditing ? editContent : result;
    if (!content.trim()) return;

    // 计算日期范围
    const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
    const dates = selectedFiles
      .map(f => f.workDate)
      .filter((d): d is string => !!d)
      .sort();

    const dateRange = dates.length > 0
      ? { start: dates[0], end: dates[dates.length - 1] }
      : { start: new Date().toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10) };

    const newReport: GeneratedWeeklyReport = {
      id: `weekly-${Date.now()}`,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sourceFileIds: Array.from(selectedFileIds),
      template,
      dateRange,
    };

    setHistory([newReport, ...history]);
    message.success('已保存到历史记录');
  };

  // 从历史加载
  const handleLoadFromHistory = (report: GeneratedWeeklyReport) => {
    setResult(report.content);
    setIsEditing(false);
    setShowHistory(false);
  };

  // 删除历史记录
  const handleDeleteHistory = (id: string) => {
    setHistory(history.filter(r => r.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">AI 智能生成周报</h2>
          <p className="text-sm text-gray-500 mt-1">选择日报文件，AI 将分析内容并生成周报汇总</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600"
          >
            <History size={16} />
            历史记录 ({history.length})
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* 历史记录面板 */}
      {showHistory && history.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">历史周报</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {history.map(report => (
              <div key={report.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {report.dateRange.start} ~ {report.dateRange.end}
                  </p>
                  <p className="text-xs text-gray-400">
                    {TEMPLATE_CONFIG[report.template].name} &middot; {new Date(report.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleLoadFromHistory(report)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="加载"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteHistory(report.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 周切换头部 */}
      <div className="flex items-center justify-between mb-4 px-2">
        <button onClick={prevWeek} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-medium text-gray-800">
            {currentWeekStart.format('YYYY年M月D日')} - {currentWeekStart.add(6, 'day').format('M月D日')}
          </h3>
          {!currentWeekStart.isSame(dayjs().startOf('isoWeek'), 'day') && (
            <button onClick={goToThisWeek} className="text-xs text-blue-600 hover:text-blue-700">
              返回本周
            </button>
          )}
        </div>
        <button onClick={nextWeek} className="p-2 hover:bg-gray-100 rounded-lg">
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      {/* 周时间线 */}
      <div className="mb-6 bg-gray-50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-700">
            本周日报（已选 {selectedFileIds.size} 份，共 {weekFileCount} 份）
          </span>
          <div className="flex gap-2">
            <button
              onClick={selectAllWeek}
              disabled={weekFileCount === 0}
              className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400"
            >
              全选本周
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

        {/* 时间线列表 */}
        <div className="space-y-2">
          {weekDays.map((day, index) => {
            const dateStr = day.format('YYYY-MM-DD');
            const dayFiles = getFilesForDate(dateStr);
            const isToday = day.isSame(dayjs(), 'day');
            const isWeekend = index >= 5;
            const allSelected = dayFiles.length > 0 && dayFiles.every(f => selectedFileIds.has(f.id));
            const someSelected = dayFiles.some(f => selectedFileIds.has(f.id));

            return (
              <div
                key={dateStr}
                className={`p-3 rounded-lg border transition-all ${
                  allSelected
                    ? 'bg-blue-50 border-blue-200'
                    : someSelected
                      ? 'bg-blue-50/50 border-blue-100'
                      : isToday
                        ? 'bg-white border-blue-300'
                        : isWeekend
                          ? 'bg-gray-100/50 border-gray-200'
                          : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* 日期信息 */}
                  <div className="flex items-center gap-2 min-w-[100px]">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => toggleDateSelection(dateStr)}
                      disabled={dayFiles.length === 0}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-30"
                    />
                    <div className="flex flex-col">
                      <span className={`text-sm font-medium ${isToday ? 'text-blue-600' : isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>
                        周{weekDayLabels[index]}
                      </span>
                      <span className="text-xs text-gray-400">{day.format('M/D')}</span>
                    </div>
                    {isToday && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">今天</span>
                    )}
                  </div>

                  {/* 日报文件列表 */}
                  <div className="flex-1 flex flex-wrap gap-2">
                    {dayFiles.length === 0 ? (
                      <span className="text-sm text-gray-400 italic">暂无日报</span>
                    ) : (
                      dayFiles.map(file => (
                        <div
                          key={file.id}
                          className={`flex items-center gap-2 px-2 py-1 rounded text-sm cursor-pointer transition-colors ${
                            selectedFileIds.has(file.id)
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          onClick={() => toggleFileSelection(file.id)}
                        >
                          <FileText size={14} />
                          <span className="truncate max-w-[150px]">{file.fileName}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }}
                            className="text-gray-400 hover:text-blue-600"
                            title="预览"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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

      {/* 文件预览弹窗 */}
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
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
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
              <p className="text-xs text-gray-400">共 {previewFile.content.length} 字符</p>
            </div>
          </div>
        </div>
      )}

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
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-3 py-1 text-sm text-blue-700 hover:bg-blue-200 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Save size={14} />
                        保存修改
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleEdit}
                        className="px-3 py-1 text-sm text-green-700 hover:bg-green-200 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Edit3 size={14} />
                        编辑
                      </button>
                      <button
                        onClick={handleSaveToHistory}
                        className="px-3 py-1 text-sm text-green-700 hover:bg-green-200 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Save size={14} />
                        保存
                      </button>
                      <button
                        onClick={handleCopy}
                        className="px-3 py-1 text-sm text-green-700 hover:bg-green-200 rounded-lg transition-colors"
                      >
                        复制
                      </button>
                      <button
                        onClick={() => exportToWord(result, `周报_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}`)}
                        className="px-3 py-1 text-sm text-green-700 hover:bg-green-200 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Download size={14} />
                        导出
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="p-4">
                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-96 p-3 text-sm text-gray-700 leading-relaxed font-sans border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                ) : (
                  <article className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-h1:text-lg prose-h1:font-bold prose-h2:text-base prose-h2:font-semibold prose-h3:text-sm prose-h3:font-semibold prose-hr:my-3 prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-1.5 prose-strong:text-gray-800 prose-ul:my-1.5 prose-li:my-0.5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                  </article>
                )}
              </div>
            </div>
          )}
    </div>
  );
}

/* ============================== 月报生成 Tab ============================== */

function MonthlyTab({ files, result, setResult, weeklyHistory, history, setHistory }: {
  files: UploadedDailyFile[];
  result: string;
  setResult: (value: string) => void;
  weeklyHistory: GeneratedWeeklyReport[];
  history: GeneratedMonthlyReport[];
  setHistory: (reports: GeneratedMonthlyReport[]) => void;
}) {
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [selectedWeeklyIds, setSelectedWeeklyIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<'daily' | 'multi-weekly'>('daily');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 生成当前月的所有日期
  const getDaysInMonth = (month: Dayjs) => {
    const startOfMonth = month.startOf('month');
    const endOfMonth = month.endOf('month');
    const days: Dayjs[] = [];
    let current = startOfMonth;
    while (current.isBefore(endOfMonth) || current.isSame(endOfMonth, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }
    return days;
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const weekDayLabels = ['日', '一', '二', '三', '四', '五', '六'];

  // 获取某个日期的日报
  const getFilesForDate = (dateStr: string) => {
    return files.filter(f => f.workDate === dateStr);
  };

  // 获取当月所有有日报的日期
  const getMonthFiles = () => {
    const monthStart = currentMonth.startOf('month').format('YYYY-MM-DD');
    const monthEnd = currentMonth.endOf('month').format('YYYY-MM-DD');
    return files.filter(f => {
      if (!f.workDate) return false;
      return f.workDate >= monthStart && f.workDate <= monthEnd;
    });
  };

  const monthFiles = getMonthFiles();
  const monthFileCount = monthFiles.length;

  // 选择某天的所有日报
  const toggleDateSelection = (dateStr: string) => {
    const dateFiles = getFilesForDate(dateStr);
    const newSet = new Set(selectedFileIds);
    const allSelected = dateFiles.every(f => selectedFileIds.has(f.id));

    if (allSelected) {
      dateFiles.forEach(f => newSet.delete(f.id));
    } else {
      dateFiles.forEach(f => newSet.add(f.id));
    }
    setSelectedFileIds(newSet);
  };

  // 切换单个文件选择
  const toggleFileSelection = (id: string) => {
    const newSet = new Set(selectedFileIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedFileIds(newSet);
  };

  // 选择整月
  const selectAllMonth = () => {
    const allIds = new Set(monthFiles.map(f => f.id));
    setSelectedFileIds(allIds);
  };

  // 取消选择
  const deselectAll = () => {
    setSelectedFileIds(new Set());
  };

  // 月份切换
  const prevMonth = () => {
    setCurrentMonth(currentMonth.subtract(1, 'month'));
    setSelectedFileIds(new Set());
  };
  const nextMonth = () => {
    setCurrentMonth(currentMonth.add(1, 'month'));
    setSelectedFileIds(new Set());
  };
  const goToThisMonth = () => {
    setCurrentMonth(dayjs());
    setSelectedFileIds(new Set());
  };

  // 横向滚动
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };
  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  const toggleWeeklySelection = (id: string) => {
    const newSet = new Set(selectedWeeklyIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedWeeklyIds(newSet);
  };

  const selectAllWeekly = () => {
    setSelectedWeeklyIds(new Set(weeklyHistory.map(w => w.id)));
  };

  const deselectAllWeekly = () => {
    setSelectedWeeklyIds(new Set());
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setResult('');
    setError(null);
    setIsEditing(false);

    let systemPrompt = '';
    let userContent = '';

    if (sourceType === 'multi-weekly' && selectedWeeklyIds.size > 0) {
      // 基于多周报生成
      const selectedWeeklies = weeklyHistory.filter(w => selectedWeeklyIds.has(w.id));
      const combinedContent = selectedWeeklies
        .map((w, i) => `=== 周报 ${i + 1}/${selectedWeeklies.length}：${w.dateRange.start} ~ ${w.dateRange.end} ===\n${w.content}\n=== 周报 ${i + 1} 结束 ===`)
        .join('\n\n');

      systemPrompt = `你是一个专业的工作报告撰写助手。用户会提供多份周报内容，请根据这些内容生成一份月报。

【核心原则 - 必须严格遵守】
1. 完整性原则：用户共提供了 ${selectedWeeklies.length} 份周报，你必须逐份完整阅读每一份，不得跳过或遗漏任何一份
2. 真实性原则：所有内容必须100%来源于周报原文，严禁编造、推测或添加周报中未提及的任何信息
3. 信息密度原则：保留周报中的具体细节（项目名称、任务描述、数据指标、人员等），避免空泛概括
4. 风格一致性原则：保持与周报原文相近的表述风格和专业术语，不要过度改写

【输出要求】
1. 全面整合所有周报内容，按项目或类别组织，确保每份周报的内容都被覆盖
2. 保留关键细节：具体任务名称、进度百分比、数量指标、涉及人员/系统、时间节点等
3. 突出本月重点项目和主要成果（必须有周报依据）
4. 列出存在的问题和下月计划（仅当周报中有提及时才写）
5. 语言正式专业，适合作为月度工作汇报

【禁止事项】
- 禁止添加周报中没有的工作内容
- 禁止使用"等"、"若干"、"部分"等模糊词汇替代具体信息
- 禁止编造数据、进度、完成率或任何结论
- 禁止遗漏任何一份周报的内容
请直接输出月报内容，使用 Markdown 格式（支持标题、列表、加粗等）。`;

      userContent = `以下是本月的 ${selectedWeeklies.length} 份周报内容，请逐份完整阅读后生成月报。\n\n${combinedContent}`;
    } else {
      // 基于日报生成
      if (selectedFileIds.size === 0) {
        setIsGenerating(false);
        return;
      }

      const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
      const combinedContent = selectedFiles
        .map((f, i) => `=== 日报 ${i + 1}/${selectedFiles.length}：${f.fileName}${f.workDate ? ` (${f.workDate})` : ''} ===\n${f.content}\n=== 日报 ${i + 1} 结束 ===`)
        .join('\n\n');

      systemPrompt = `你是一个专业的工作报告撰写助手。用户会提供多份日报内容，请根据这些内容生成一份月报。

【核心原则 - 必须严格遵守】
1. 完整性原则：用户共提供了 ${selectedFiles.length} 份日报，你必须逐份完整阅读每一份，不得跳过或遗漏任何一份
2. 真实性原则：所有内容必须100%来源于日报原文，严禁编造、推测或添加日报中未提及的任何信息
3. 信息密度原则：保留日报中的具体细节（项目名称、任务描述、数据指标、人员等），避免空泛概括
4. 风格一致性原则：保持与日报原文相近的表述风格和专业术语，不要过度改写

【输出要求】
1. 全面梳理所有日报中的工作内容，按项目或类别组织，确保每份日报的内容都被覆盖
2. 保留关键细节：具体任务名称、进度百分比、数量指标、涉及人员/系统、时间节点等
3. 突出本月重点项目和主要成果（必须有日报依据）
4. 列出存在的问题和下月计划（仅当日报中有提及时才写）
5. 语言正式专业，适合作为月度工作汇报

【禁止事项】
- 禁止添加日报中没有的工作内容
- 禁止使用"等"、"若干"、"部分"等模糊词汇替代具体信息
- 禁止编造数据、进度、完成率或任何结论
- 禁止遗漏任何一份日报的内容
请直接输出月报内容，使用 Markdown 格式（支持标题、列表、加粗等）。`;

      userContent = `以下是本月的 ${selectedFiles.length} 份日报内容，请逐份完整阅读后生成月报。\n\n${combinedContent}`;
    }

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
            { role: 'user', content: userContent }
          ],
          stream: true,
          temperature: 0.3,
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
    const content = isEditing ? editContent : result;
    navigator.clipboard.writeText(content);
    message.success('已复制到剪贴板');
  };

  const handleEdit = () => {
    setEditContent(result);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const handleSaveEdit = () => {
    setResult(editContent);
    setIsEditing(false);
  };

  const handleSaveToHistory = () => {
    const content = isEditing ? editContent : result;
    if (!content.trim()) return;

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const newReport: GeneratedMonthlyReport = {
      id: `monthly-${Date.now()}`,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      template: 'detailed' as ReportTemplate,
      month,
      sourceType,
      sourceFileIds: sourceType === 'daily' ? Array.from(selectedFileIds) : undefined,
      sourceWeeklyIds: sourceType !== 'daily' ? Array.from(selectedWeeklyIds) : undefined,
    };

    setHistory([newReport, ...history]);
    message.success('已保存到历史记录');
  };

  const handleLoadFromHistory = (report: GeneratedMonthlyReport) => {
    setResult(report.content);
    setIsEditing(false);
    setShowHistory(false);
  };

  const handleDeleteHistory = (id: string) => {
    setHistory(history.filter(r => r.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">AI 智能生成月报</h2>
          <p className="text-sm text-gray-500 mt-1">选择数据来源，AI 将综合分析并生成月度工作报告</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600"
          >
            <History size={16} />
            历史记录 ({history.length})
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* 历史记录面板 */}
      {showHistory && history.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">历史月报</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {history.map(report => (
              <div key={report.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{report.month} 月报</p>
                  <p className="text-xs text-gray-400">
                    {report.sourceType === 'daily' ? '基于日报' : '基于周报'} &middot; {new Date(report.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleLoadFromHistory(report)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="加载"><Eye size={14} /></button>
                  <button onClick={() => handleDeleteHistory(report.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="删除"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 数据来源选择 */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <span className="text-sm font-medium text-gray-700 block mb-3">选择数据来源</span>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setSourceType('daily')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${sourceType === 'daily' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
            <FileText size={16} />基于日报生成
          </button>
          <button onClick={() => weeklyHistory.length > 0 && setSourceType('multi-weekly')} disabled={weeklyHistory.length === 0} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${sourceType === 'multi-weekly' ? 'bg-blue-600 text-white' : weeklyHistory.length > 0 ? 'bg-white text-gray-700 hover:bg-gray-50' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
            <BarChart3 size={16} />多周报合成{weeklyHistory.length === 0 && <span className="text-xs">（需先保存周报）</span>}
          </button>
        </div>
      </div>

      {/* 基于多周报合成 */}
      {sourceType === 'multi-weekly' && weeklyHistory.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">
              选择周报（已选 {selectedWeeklyIds.size}/{weeklyHistory.length}）
            </span>
            <div className="flex gap-2">
              <button onClick={selectAllWeekly} className="text-xs text-blue-600 hover:text-blue-700">全选</button>
              <span className="text-gray-300">|</span>
              <button onClick={deselectAllWeekly} className="text-xs text-gray-500 hover:text-gray-700">取消全选</button>
            </div>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {weeklyHistory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">暂无周报</p>
            ) : (
              weeklyHistory.map(weekly => (
                <label key={weekly.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedWeeklyIds.has(weekly.id) ? 'bg-blue-50 border border-blue-200' : 'hover:bg-white border border-transparent'}`}>
                  <input type="checkbox" checked={selectedWeeklyIds.has(weekly.id)} onChange={() => toggleWeeklySelection(weekly.id)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                  <Calendar size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700 flex-1">{weekly.dateRange.start} ~ {weekly.dateRange.end}</span>
                  <span className="text-xs text-gray-400">{weekly.content.length} 字</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      {/* 基于日报 - 月份时间线视图 */}
      {sourceType === 'daily' && (files.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
          <p>暂无上传的日报文件</p>
          <p className="text-sm mt-1">请先在"日报上传"标签页上传日报文件</p>
        </div>
      ) : (
        <div className="mb-6">
          {/* 月份切换头部 */}
          <div className="flex items-center justify-between mb-4 px-2">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-gray-800">
                {currentMonth.format('YYYY年M月')}
              </h3>
              {!currentMonth.isSame(dayjs(), 'month') && (
                <button onClick={goToThisMonth} className="text-xs text-blue-600 hover:text-blue-700">
                  返回本月
                </button>
              )}
            </div>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronRight size={20} className="text-gray-600" />
            </button>
          </div>

          {/* 横向日期滚动条 */}
          <div className="relative mb-4">
            <button
              onClick={scrollLeft}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white shadow-md rounded-full flex items-center justify-center hover:bg-gray-50"
            >
              <ChevronLeft size={18} className="text-gray-600" />
            </button>

            <div
              ref={scrollContainerRef}
              className="overflow-x-auto scrollbar-hide mx-10 flex gap-2 py-2"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {daysInMonth.map((day) => {
                const dateStr = day.format('YYYY-MM-DD');
                const dayFiles = getFilesForDate(dateStr);
                const isToday = day.isSame(dayjs(), 'day');
                const isWeekend = day.day() === 0 || day.day() === 6;
                const allSelected = dayFiles.length > 0 && dayFiles.every(f => selectedFileIds.has(f.id));
                const someSelected = dayFiles.some(f => selectedFileIds.has(f.id));

                return (
                  <button
                    key={dateStr}
                    onClick={() => dayFiles.length > 0 && toggleDateSelection(dateStr)}
                    className={`flex-shrink-0 w-12 h-14 rounded-lg flex flex-col items-center justify-center transition-all ${
                      allSelected
                        ? 'bg-blue-600 text-white shadow-lg scale-105'
                        : someSelected
                          ? 'bg-blue-100 border-2 border-blue-300 text-blue-600'
                          : isToday
                            ? 'bg-blue-50 border-2 border-blue-300 text-blue-600'
                            : dayFiles.length > 0
                              ? 'bg-green-50 border border-green-200 text-green-700 hover:bg-green-100'
                              : isWeekend
                                ? 'bg-gray-50 text-gray-400'
                                : 'bg-white border border-gray-200 text-gray-400'
                    }`}
                    disabled={dayFiles.length === 0}
                  >
                    <span className="text-xs">{weekDayLabels[day.day()]}</span>
                    <span className="text-lg font-semibold">{day.date()}</span>
                    {dayFiles.length > 0 && !allSelected && (
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={scrollRight}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white shadow-md rounded-full flex items-center justify-center hover:bg-gray-50"
            >
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>

          {/* 选择状态栏 */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                已选择 {selectedFileIds.size} / {monthFileCount} 份日报（{currentMonth.format('M')}月）
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAllMonth}
                  disabled={monthFileCount === 0}
                  className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                >
                  全选本月
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
          </div>

          {/* 已选择的日报列表 */}
          {selectedFileIds.size > 0 && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-700 mb-2">已选择的日报：</p>
              <div className="flex flex-wrap gap-2">
                {files.filter(f => selectedFileIds.has(f.id)).map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1 px-2 py-1 bg-white rounded text-sm border border-blue-200"
                  >
                    <FileText size={14} className="text-blue-500" />
                    <span className="text-gray-700 truncate max-w-[120px]">{file.fileName}</span>
                    {file.workDate && <span className="text-xs text-gray-400">({dayjs(file.workDate).format('M/D')})</span>}
                    <button
                      onClick={() => toggleFileSelection(file.id)}
                      className="text-gray-400 hover:text-red-500 ml-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      {/* 生成按钮 */}
      {(sourceType !== 'daily' || files.length > 0) && (
        <div className="flex items-center gap-3 mb-6">
          {isGenerating ? (
            <button onClick={handleStop} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm"><X size={16} />停止生成</button>
          ) : (
            <button onClick={handleGenerate} disabled={(sourceType === 'daily' && selectedFileIds.size === 0) || (sourceType === 'multi-weekly' && selectedWeeklyIds.size === 0)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 text-sm"><Sparkles size={16} />AI 生成月报</button>
          )}
          {sourceType === 'daily' && selectedFileIds.size === 0 && !isGenerating && <span className="text-sm text-gray-400">请先选择日报文件</span>}
          {sourceType === 'multi-weekly' && selectedWeeklyIds.size === 0 && !isGenerating && <span className="text-sm text-gray-400">请先选择周报</span>}
        </div>
      )}

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
            <span className="ai-loading-dot"></span><span className="ai-loading-dot"></span><span className="ai-loading-dot"></span>
          </div>
          <p className="text-blue-700 font-medium">AI 正在分析内容...</p>
          <p className="text-sm text-blue-500 mt-2">整合工作内容 &middot; 分析工作成果 &middot; 生成月报</p>
        </div>
      )}

      {/* 生成结果 */}
      {result && (
        <div className="border border-green-200 bg-green-50/50 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-green-100/50 border-b border-green-200">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-green-600" />AI 生成月报{isGenerating && <Loader2 size={14} className="animate-spin text-blue-500" />}
            </h3>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button onClick={handleCancelEdit} className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">取消</button>
                  <button onClick={handleSaveEdit} className="px-3 py-1 text-sm text-blue-700 hover:bg-blue-200 rounded-lg transition-colors flex items-center gap-1"><Save size={14} />保存修改</button>
                </>
              ) : (
                <>
                  <button onClick={handleEdit} className="px-3 py-1 text-sm text-green-700 hover:bg-green-200 rounded-lg transition-colors flex items-center gap-1"><Edit3 size={14} />编辑</button>
                  <button onClick={handleSaveToHistory} className="px-3 py-1 text-sm text-green-700 hover:bg-green-200 rounded-lg transition-colors flex items-center gap-1"><Save size={14} />保存</button>
                  <button onClick={handleCopy} className="px-3 py-1 text-sm text-green-700 hover:bg-green-200 rounded-lg transition-colors">复制</button>
                  <button onClick={() => exportToWord(result, `月报_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}`)} className="px-3 py-1 text-sm text-green-700 hover:bg-green-200 rounded-lg transition-colors flex items-center gap-1"><Download size={14} />导出</button>
                </>
              )}
            </div>
          </div>
          <div className="p-4">
            {isEditing ? (
              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full h-96 p-3 text-sm text-gray-700 leading-relaxed font-sans border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            ) : (
              <article className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-h1:text-lg prose-h1:font-bold prose-h2:text-base prose-h2:font-semibold prose-h3:text-sm prose-h3:font-semibold prose-hr:my-3 prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-1.5 prose-strong:text-gray-800 prose-ul:my-1.5 prose-li:my-0.5">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
              </article>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

