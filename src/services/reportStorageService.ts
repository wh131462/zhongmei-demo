import type { UploadedDailyFile, GeneratedWeeklyReport, GeneratedMonthlyReport } from '../types';

const STORAGE_KEYS = {
  DAILY_FILES: 'report_daily_files',
  WEEKLY_REPORTS: 'report_weekly_history',
  MONTHLY_REPORTS: 'report_monthly_history',
};

const MAX_HISTORY = 20; // 最多保留 20 条历史记录

// 日报文件存储
export function saveDailyFiles(files: UploadedDailyFile[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DAILY_FILES, JSON.stringify(files));
  } catch (e) {
    console.error('保存日报文件失败:', e);
    // 存储空间不足时尝试清理旧数据
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      clearOldData();
      try {
        localStorage.setItem(STORAGE_KEYS.DAILY_FILES, JSON.stringify(files));
      } catch {
        console.error('清理后仍无法保存');
      }
    }
  }
}

export function loadDailyFiles(): UploadedDailyFile[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DAILY_FILES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 周报历史存储
export function saveWeeklyReports(reports: GeneratedWeeklyReport[]): void {
  try {
    // 限制数量
    const trimmed = reports.slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEYS.WEEKLY_REPORTS, JSON.stringify(trimmed));
  } catch (e) {
    console.error('保存周报历史失败:', e);
  }
}

export function loadWeeklyReports(): GeneratedWeeklyReport[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.WEEKLY_REPORTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 月报历史存储
export function saveMonthlyReports(reports: GeneratedMonthlyReport[]): void {
  try {
    const trimmed = reports.slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEYS.MONTHLY_REPORTS, JSON.stringify(trimmed));
  } catch (e) {
    console.error('保存月报历史失败:', e);
  }
}

export function loadMonthlyReports(): GeneratedMonthlyReport[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MONTHLY_REPORTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 清理旧数据
function clearOldData(): void {
  const weeklyReports = loadWeeklyReports();
  const monthlyReports = loadMonthlyReports();

  // 保留最近一半的历史
  if (weeklyReports.length > MAX_HISTORY / 2) {
    saveWeeklyReports(weeklyReports.slice(0, Math.floor(MAX_HISTORY / 2)));
  }
  if (monthlyReports.length > MAX_HISTORY / 2) {
    saveMonthlyReports(monthlyReports.slice(0, Math.floor(MAX_HISTORY / 2)));
  }
}

// 清空所有数据
export function clearAllReportData(): void {
  localStorage.removeItem(STORAGE_KEYS.DAILY_FILES);
  localStorage.removeItem(STORAGE_KEYS.WEEKLY_REPORTS);
  localStorage.removeItem(STORAGE_KEYS.MONTHLY_REPORTS);
}

// 获取存储使用情况
export function getStorageUsage(): { used: number; total: number; percentage: number } {
  let used = 0;
  for (const key of Object.values(STORAGE_KEYS)) {
    const item = localStorage.getItem(key);
    if (item) {
      used += item.length * 2; // UTF-16 每字符 2 字节
    }
  }
  const total = 5 * 1024 * 1024; // 约 5MB
  return {
    used,
    total,
    percentage: Math.round((used / total) * 100),
  };
}
