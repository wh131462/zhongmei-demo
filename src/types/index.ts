export interface Template {
  id: string;
  name: string;
  description: string;
  previewClass: string;
  thumbnail: string;
}

export interface Approver {
  id: string;
  name: string;
  title: string;
  order: number;
}

export interface ApprovalRecord {
  id: string;
  documentTitle: string;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  currentStep: number;
  approvers: Approver[];
  createdAt: string;
  comments: { approver: string; content: string; time: string; status: 'approved' | 'rejected' }[];
}

export interface TypoItem {
  original: string;
  correct: string;
  position: number;
}

export interface DailyReport {
  id: string;
  date: string;
  content: string;
  items: ReportItem[];
}

export interface ReportItem {
  project: string;
  content: string;
  progress?: number;
  category: 'progress' | 'completed' | 'issue' | 'plan';
}

export interface WeeklyReport {
  id: string;
  startDate: string;
  endDate: string;
  items: ReportItem[];
  summary: string;
}

export interface MonthlyReport {
  id: string;
  month: string;
  items: ReportItem[];
  summary: string;
}

// 上传的日报文件
export interface UploadedDailyFile {
  id: string;
  fileName: string;
  content: string;
  uploadTime: number;
  workDate?: string; // 工作日期 YYYY-MM-DD
}

// 报告模板类型
export type ReportTemplate = 'concise' | 'detailed' | 'formal';

// AI 生成的周报历史记录
export interface GeneratedWeeklyReport {
  id: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  sourceFileIds: string[];
  template: ReportTemplate;
  dateRange: { start: string; end: string };
}

// AI 生成的月报历史记录
export interface GeneratedMonthlyReport {
  id: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  template: ReportTemplate;
  month: string; // YYYY-MM
  sourceType: 'daily' | 'weekly' | 'multi-weekly';
  sourceFileIds?: string[];
  sourceWeeklyIds?: string[];
}

// 知识库文档分块
export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string; // 来源文件名
    chunkIndex: number;
    totalChunks: number;
  };
}

// 知识库文档
export interface KBDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  content: string; // 原始内容
  chunks: DocumentChunk[]; // 分块后的内容
  uploadedAt: number;
  status: 'processing' | 'ready' | 'error';
  // RAGFlow 关联
  ragflowDocId?: string; // RAGFlow 文档 ID
  ragflowStatus?: 'pending' | 'uploading' | 'parsing' | 'ready' | 'error';
}

// 知识库类型
export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  documents: KBDocument[];
  totalChunks: number;
  totalSize: number;
  createdAt: number;
  updatedAt: number;
  // RAGFlow 关联
  ragflowDatasetId?: string; // RAGFlow 知识库 ID
}

// RAGFlow 知识库类型（后端服务）
export interface RAGFlowKnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  chunkCount: number;
  documentCount: number;
  tokenNum: number;
  createDate: string;
  updateDate: string;
}

// 统一的知识库选择项（本地或RAGFlow）
export interface KnowledgeBaseOption {
  id: string;
  name: string;
  description: string;
  source: 'local' | 'ragflow';
  chunkCount: number;
  documentCount: number;
}
