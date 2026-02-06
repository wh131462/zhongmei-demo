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
}
