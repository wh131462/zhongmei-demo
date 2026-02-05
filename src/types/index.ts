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
