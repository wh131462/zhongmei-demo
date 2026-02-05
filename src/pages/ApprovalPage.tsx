import { useState } from 'react';
import { Settings, Users, FileCheck, Plus, GripVertical, Trash2, Check, X, Clock, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { defaultApprovers, allLeaders, mockApprovalRecords } from '../mock/data';
import type { Approver, ApprovalRecord } from '../types';

type Tab = 'config' | 'process';

export default function ApprovalPage() {
  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [approvers, setApprovers] = useState<Approver[]>(defaultApprovers);
  const [records, setRecords] = useState<ApprovalRecord[]>(mockApprovalRecords);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // 添加审批人
  const handleAddApprover = (leader: Approver) => {
    if (approvers.find(a => a.id === leader.id)) return;
    setApprovers([...approvers, { ...leader, order: approvers.length + 1 }]);
    setShowAddModal(false);
  };

  // 移除审批人
  const handleRemoveApprover = (id: string) => {
    const newApprovers = approvers.filter(a => a.id !== id);
    setApprovers(newApprovers.map((a, idx) => ({ ...a, order: idx + 1 })));
  };

  // 移动审批人顺序
  const handleMoveApprover = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === approvers.length - 1) return;

    const newApprovers = [...approvers];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newApprovers[index], newApprovers[targetIndex]] = [newApprovers[targetIndex], newApprovers[index]];
    setApprovers(newApprovers.map((a, idx) => ({ ...a, order: idx + 1 })));
  };

  // 模拟审批操作
  const handleApprove = (recordId: string, approved: boolean, comment: string) => {
    setRecords(records.map(record => {
      if (record.id !== recordId) return record;

      const newComments = [...record.comments, {
        approver: record.approvers[record.currentStep].name,
        content: comment || (approved ? '同意' : '需要修改'),
        time: new Date().toLocaleString('zh-CN'),
        status: approved ? 'approved' as const : 'rejected' as const
      }];

      if (!approved) {
        return { ...record, status: 'rejected' as const, comments: newComments };
      }

      const nextStep = record.currentStep + 1;
      if (nextStep >= record.approvers.length) {
        return { ...record, status: 'approved' as const, currentStep: nextStep, comments: newComments };
      }

      return { ...record, currentStep: nextStep, comments: newComments };
    }));
  };

  const availableLeaders = allLeaders.filter(l => !approvers.find(a => a.id === l.id));

  return (
    <div className="space-y-6">
      {/* Tab切换 */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('config')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'config'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Settings size={18} />
              审批流程配置
            </button>
            <button
              onClick={() => setActiveTab('process')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'process'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileCheck size={18} />
              审批进度
            </button>
          </div>
        </div>

        {/* 审批流程配置 */}
        {activeTab === 'config' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">审批流程设置</h2>
                <p className="text-sm text-gray-500 mt-1">配置文档审批的领导顺序，可拖动调整顺序</p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
              >
                <Plus size={16} />
                添加审批人
              </button>
            </div>

            {/* 审批流程链 */}
            <div className="relative">
              {/* 连接线 */}
              {approvers.length > 1 && (
                <div className="absolute left-6 top-12 bottom-12 w-0.5 bg-blue-200" />
              )}

              <div className="space-y-4">
                {approvers.map((approver, index) => (
                  <div key={approver.id} className="flex items-center gap-4">
                    {/* 序号 */}
                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg z-10">
                      {index + 1}
                    </div>

                    {/* 审批人卡片 */}
                    <div className="flex-1 bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GripVertical size={20} className="text-gray-400 cursor-move" />
                        <div>
                          <p className="font-medium text-gray-800">{approver.name}</p>
                          <p className="text-sm text-gray-500">{approver.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMoveApprover(index, 'up')}
                          disabled={index === 0}
                          className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ChevronUp size={18} />
                        </button>
                        <button
                          onClick={() => handleMoveApprover(index, 'down')}
                          disabled={index === approvers.length - 1}
                          className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ChevronDown size={18} />
                        </button>
                        <button
                          onClick={() => handleRemoveApprover(approver.id)}
                          className="p-1.5 text-red-400 hover:text-red-600"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* 箭头指示 */}
                    {index < approvers.length - 1 && (
                      <div className="absolute left-6 translate-y-12" style={{ top: `${index * 80 + 48}px` }}>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {approvers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Users size={48} className="mx-auto mb-4 text-gray-300" />
                <p>暂无审批人，请点击"添加审批人"按钮</p>
              </div>
            )}

            {/* 保存提示 */}
            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>提示：</strong>审批流程配置将应用于所有新提交的文档。当前配置：文档需经过 {approvers.length} 级审批。
              </p>
            </div>
          </div>
        )}

        {/* 审批进度 */}
        {activeTab === 'process' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-6">审批进度跟踪</h2>
            <div className="space-y-4">
              {records.map(record => (
                <div key={record.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* 记录头部 */}
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedRecord(expandedRecord === record.id ? null : record.id)}
                  >
                    <div className="flex items-center gap-4">
                      <StatusBadge status={record.status} />
                      <div>
                        <p className="font-medium text-gray-800">{record.documentTitle}</p>
                        <p className="text-sm text-gray-500">提交时间：{record.createdAt}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-500">
                        审批进度：{Math.min(record.currentStep, record.approvers.length)}/{record.approvers.length}
                      </div>
                      {expandedRecord === record.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>

                  {/* 展开详情 */}
                  {expandedRecord === record.id && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      {/* 审批步骤 */}
                      <div className="flex items-center justify-between mb-6">
                        {record.approvers.map((approver, index) => (
                          <div key={approver.id} className="flex items-center">
                            <div className="flex flex-col items-center">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                index < record.currentStep
                                  ? 'bg-green-500 text-white'
                                  : index === record.currentStep && record.status !== 'approved' && record.status !== 'rejected'
                                  ? 'bg-blue-600 text-white animate-pulse'
                                  : 'bg-gray-200 text-gray-500'
                              }`}>
                                {index < record.currentStep ? <Check size={18} /> : index + 1}
                              </div>
                              <p className="text-xs mt-1 text-gray-600">{approver.name}</p>
                              <p className="text-xs text-gray-400">{approver.title}</p>
                            </div>
                            {index < record.approvers.length - 1 && (
                              <div className={`w-16 h-0.5 mx-2 ${
                                index < record.currentStep ? 'bg-green-500' : 'bg-gray-200'
                              }`} />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* 审批记录 */}
                      {record.comments.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <MessageSquare size={16} />
                            审批记录
                          </h4>
                          <div className="space-y-2">
                            {record.comments.map((comment, index) => (
                              <div key={index} className="bg-white rounded-lg p-3 text-sm">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium">{comment.approver}</span>
                                  <span className="text-gray-400 text-xs">{comment.time}</span>
                                </div>
                                <p className="text-gray-600">{comment.content}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 当前审批操作 */}
                      {record.status === 'pending' || (record.status === 'reviewing' && record.currentStep < record.approvers.length) ? (
                        <ApprovalActions
                          currentApprover={record.approvers[record.currentStep]}
                          onApprove={(approved, comment) => handleApprove(record.id, approved, comment)}
                        />
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 添加审批人弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-auto">
            <h3 className="text-lg font-semibold mb-4">选择审批人</h3>
            {availableLeaders.length > 0 ? (
              <div className="space-y-2">
                {availableLeaders.map(leader => (
                  <div
                    key={leader.id}
                    onClick={() => handleAddApprover(leader)}
                    className="p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <p className="font-medium">{leader.name}</p>
                    <p className="text-sm text-gray-500">{leader.title}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">所有领导已添加到审批流程中</p>
            )}
            <button
              onClick={() => setShowAddModal(false)}
              className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ApprovalRecord['status'] }) {
  const config = {
    pending: { label: '待审批', className: 'bg-yellow-100 text-yellow-700', icon: Clock },
    reviewing: { label: '审批中', className: 'bg-blue-100 text-blue-700', icon: Clock },
    approved: { label: '已通过', className: 'bg-green-100 text-green-700', icon: Check },
    rejected: { label: '已驳回', className: 'bg-red-100 text-red-700', icon: X },
  };

  const { label, className, icon: Icon } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

function ApprovalActions({ currentApprover, onApprove }: { currentApprover: Approver; onApprove: (approved: boolean, comment: string) => void }) {
  const [comment, setComment] = useState('');

  return (
    <div className="bg-white rounded-lg p-4">
      <p className="text-sm text-gray-600 mb-3">
        当前待审批人：<strong>{currentApprover.name}</strong>（{currentApprover.title}）
      </p>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="请输入审批意见（可选）"
        className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex gap-3 mt-3">
        <button
          onClick={() => onApprove(true, comment)}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
        >
          <Check size={16} />
          通过
        </button>
        <button
          onClick={() => onApprove(false, comment)}
          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
        >
          <X size={16} />
          驳回
        </button>
      </div>
    </div>
  );
}
