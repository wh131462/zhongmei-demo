import type { Template, Approver, DailyReport, ApprovalRecord } from '../types';

export const templates: Template[] = [
  {
    id: 'formal',
    name: '公文模板',
    description: '标准公文格式，适用于正式文件、通知、报告',
    previewClass: 'preview-formal',
    thumbnail: '公文'
  },
  {
    id: 'modern',
    name: '现代商务',
    description: '现代简洁风格，适用于工作汇报、项目总结',
    previewClass: 'preview-modern',
    thumbnail: '商务'
  },
  {
    id: 'simple',
    name: '简约清晰',
    description: '简约风格，适用于内部沟通、日常汇报',
    previewClass: 'preview-simple',
    thumbnail: '简约'
  }
];

export const defaultApprovers: Approver[] = [
  { id: '1', name: '张伟', title: '部门经理', order: 1 },
  { id: '2', name: '李明', title: '副总监', order: 2 },
  { id: '3', name: '王芳', title: '总监', order: 3 },
];

export const allLeaders: Approver[] = [
  { id: '1', name: '张伟', title: '部门经理', order: 0 },
  { id: '2', name: '李明', title: '副总监', order: 0 },
  { id: '3', name: '王芳', title: '总监', order: 0 },
  { id: '4', name: '赵强', title: '副总经理', order: 0 },
  { id: '5', name: '陈静', title: '总经理', order: 0 },
  { id: '6', name: '刘洋', title: '项目主管', order: 0 },
];

export const mockApprovalRecords: ApprovalRecord[] = [
  {
    id: '1',
    documentTitle: '2024年度销售部工作总结报告',
    status: 'reviewing',
    currentStep: 1,
    approvers: defaultApprovers,
    createdAt: '2024-01-15 10:30',
    comments: [
      { approver: '张伟', content: '内容详实，同意通过', time: '2024-01-15 14:20', status: 'approved' }
    ]
  },
  {
    id: '2',
    documentTitle: '关于开展春季促销活动的请示',
    status: 'pending',
    currentStep: 0,
    approvers: defaultApprovers,
    createdAt: '2024-01-16 09:15',
    comments: []
  },
  {
    id: '3',
    documentTitle: '客户拜访工作汇报',
    status: 'approved',
    currentStep: 3,
    approvers: defaultApprovers,
    createdAt: '2024-01-10 11:00',
    comments: [
      { approver: '张伟', content: '同意', time: '2024-01-10 14:00', status: 'approved' },
      { approver: '李明', content: '建议补充客户反馈', time: '2024-01-10 16:30', status: 'approved' },
      { approver: '王芳', content: '同意，已批准', time: '2024-01-11 09:00', status: 'approved' }
    ]
  }
];

// Mock 错别字检查结果
export const mockTypoCheck = (text: string): { correctedText: string; typos: {original: string; correct: string; index: number}[] } => {
  let correctedText = text;
  const typos: {original: string; correct: string; index: number}[] = [];

  // 模拟检测一些"错别字"
  if (text.includes('工做')) {
    const index = text.indexOf('工做');
    typos.push({ original: '工做', correct: '工作', index });
    correctedText = correctedText.replace('工做', '工作');
  }
  if (text.includes('报高')) {
    const index = text.indexOf('报高');
    typos.push({ original: '报高', correct: '报告', index });
    correctedText = correctedText.replace('报高', '报告');
  }
  if (text.includes('销受')) {
    const index = text.indexOf('销受');
    typos.push({ original: '销受', correct: '销售', index });
    correctedText = correctedText.replace('销受', '销售');
  }
  if (text.includes('配和')) {
    const index = text.indexOf('配和');
    typos.push({ original: '配和', correct: '配合', index });
    correctedText = correctedText.replace('配和', '配合');
  }
  if (text.includes('既时')) {
    const index = text.indexOf('既时');
    typos.push({ original: '既时', correct: '及时', index });
    correctedText = correctedText.replace('既时', '及时');
  }

  return { correctedText, typos };
};

// Mock 日报数据
export const mockDailyReports: DailyReport[] = [
  {
    id: '1',
    date: '2024-01-15',
    content: '完成客户A方案讨论',
    items: [
      { project: '客户A项目', content: '完成需求沟通，确定方案框架', progress: 30, category: 'progress' },
      { project: '内部培训', content: '参加产品培训会议', category: 'completed' },
    ]
  },
  {
    id: '2',
    date: '2024-01-16',
    content: '客户B合同签订',
    items: [
      { project: '客户A项目', content: '完成方案初稿', progress: 50, category: 'progress' },
      { project: '客户B项目', content: '合同签订完成', category: 'completed' },
    ]
  },
  {
    id: '3',
    date: '2024-01-17',
    content: '项目推进与问题处理',
    items: [
      { project: '客户A项目', content: '方案修改优化', progress: 70, category: 'progress' },
      { project: '客户C项目', content: '前期沟通启动', progress: 10, category: 'progress' },
    ]
  },
  {
    id: '4',
    date: '2024-01-18',
    content: '周末前收尾工作',
    items: [
      { project: '客户A项目', content: '方案定稿，提交评审', progress: 90, category: 'progress' },
      { project: '客户C项目', content: '收集客户需求', progress: 20, category: 'progress' },
    ]
  },
  {
    id: '5',
    date: '2024-01-19',
    content: '评审反馈处理',
    items: [
      { project: '客户A项目', content: '完成最终定稿', progress: 100, category: 'completed' },
      { project: '客户C项目', content: '需求分析中', progress: 30, category: 'progress' },
    ]
  },
  {
    id: '6',
    date: '2024-01-22',
    content: '新一周工作启动',
    items: [
      { project: '客户C项目', content: '方案编写中', progress: 50, category: 'progress' },
      { project: '客户D项目', content: '新项目启动', progress: 10, category: 'progress' },
    ]
  },
  {
    id: '7',
    date: '2024-01-23',
    content: '多项目并行推进',
    items: [
      { project: '客户C项目', content: '方案初审', progress: 70, category: 'progress' },
      { project: '客户D项目', content: '需求调研', progress: 25, category: 'progress' },
    ]
  },
  {
    id: '8',
    date: '2024-01-24',
    content: '项目推进',
    items: [
      { project: '客户C项目', content: '方案修改', progress: 85, category: 'progress' },
      { project: '客户D项目', content: '完成调研报告', progress: 40, category: 'progress' },
      { project: '团队协作', content: '发现沟通流程问题', category: 'issue' },
    ]
  },
  {
    id: '9',
    date: '2024-01-25',
    content: '收尾与计划',
    items: [
      { project: '客户C项目', content: '项目完成交付', progress: 100, category: 'completed' },
      { project: '客户D项目', content: '方案编写启动', progress: 55, category: 'progress' },
    ]
  },
];

// 智能合并周报
export const generateWeeklyReport = (dailyReports: DailyReport[]): { items: {project: string; content: string; progress?: number; category: string}[]; summary: string } => {
  const projectMap = new Map<string, { contents: string[]; startProgress: number; endProgress: number; category: string }>();

  dailyReports.forEach(daily => {
    daily.items.forEach(item => {
      if (!projectMap.has(item.project)) {
        projectMap.set(item.project, {
          contents: [],
          startProgress: item.progress || 0,
          endProgress: item.progress || 0,
          category: item.category
        });
      }
      const proj = projectMap.get(item.project)!;
      proj.contents.push(item.content);
      if (item.progress !== undefined) {
        proj.endProgress = item.progress;
      }
      if (item.category === 'completed') {
        proj.category = 'completed';
      }
    });
  });

  const items: {project: string; content: string; progress?: number; category: string}[] = [];
  projectMap.forEach((value, project) => {
    const progressDiff = value.endProgress - value.startProgress;
    let content = '';

    if (value.category === 'completed') {
      content = `本周完成。主要工作：${value.contents.slice(-2).join('；')}`;
    } else if (progressDiff > 0) {
      content = `本周推进${progressDiff}%（当前进度${value.endProgress}%）。${value.contents.slice(-1)[0]}`;
    } else {
      content = value.contents.slice(-1)[0];
    }

    items.push({
      project,
      content,
      progress: value.endProgress,
      category: value.category
    });
  });

  const completedCount = items.filter(i => i.category === 'completed').length;
  const summary = `本周共推进${items.length}个项目，完成${completedCount}个，其余项目按计划推进中。`;

  return { items, summary };
};

// 智能合并月报
export const generateMonthlyReport = (weeklyData: { items: {project: string; content: string; progress?: number; category: string}[]; summary: string }[]): { items: {project: string; content: string; progress?: number; category: string}[]; summary: string } => {
  const projectMap = new Map<string, { weeklyContents: string[]; finalProgress: number; category: string }>();

  weeklyData.forEach(weekly => {
    weekly.items.forEach(item => {
      if (!projectMap.has(item.project)) {
        projectMap.set(item.project, { weeklyContents: [], finalProgress: 0, category: 'progress' });
      }
      const proj = projectMap.get(item.project)!;
      proj.weeklyContents.push(item.content);
      proj.finalProgress = item.progress || 0;
      if (item.category === 'completed') {
        proj.category = 'completed';
      }
    });
  });

  const items: {project: string; content: string; progress?: number; category: string}[] = [];
  projectMap.forEach((value, project) => {
    let content = '';
    if (value.category === 'completed') {
      content = `本月已完成。累计工作：${value.weeklyContents.join('；')}`;
    } else {
      content = `当前进度${value.finalProgress}%。本月工作：${value.weeklyContents.join('；')}`;
    }
    items.push({
      project,
      content,
      progress: value.finalProgress,
      category: value.category
    });
  });

  const completedCount = items.filter(i => i.category === 'completed').length;
  const inProgressCount = items.filter(i => i.category === 'progress').length;
  const summary = `本月共涉及${items.length}个项目：已完成${completedCount}个，进行中${inProgressCount}个。整体工作进展顺利，各项目按计划推进。`;

  return { items, summary };
};

// 示例原文（包含故意的错别字用于演示）
export const sampleDocument = `2024年销受部工作总结报高

一、工作概述

本年度，销售部在公司领导的正确带领下，紧紧围绕年初制定的销售目标，全体员工齐心协力，积极开拓市场，取得了显著成绩。全年累计实现销售收入1.2亿元，同比增长18%，超额完成年度任务。

二、主要工做成果

1. 市场开拓方面
积极拓展新客户，全年新增合作客户32家，其中重点客户8家。通过配和市场部的品牌推广活动，成功进入3个新区域市场。

2. 客户维护方面
建立客户分级管理制度，对重点客户进行既时跟进服务，客户满意度达到95%以上。全年客户流失率控制在3%以内。

3. 团队建设方面
完成销售团队扩充，新招聘销售人员12名，组织内部培训8次，团队整体业务能力显著提升。

三、下一步计划

继续深化市场开拓，预计明年销售目标增长20%。`;
