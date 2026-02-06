import { useState, useRef, useEffect } from 'react';
import {
  Database, Plus, Trash2, Edit3, X, Check, Upload,
  FileText, Search, FolderOpen, File, Layers, Clock,
  HardDrive, ChevronRight, AlertCircle, Loader2, Eye
} from 'lucide-react';
import { message } from 'antd';
import type { KnowledgeBase, KBDocument } from '../types';
import {
  getAllKnowledgeBases,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  addDocumentToKB,
  removeDocumentFromKB,
  formatFileSize,
} from '../services/knowledgeBaseService';

interface KBFormData {
  name: string;
  description: string;
}

const initialFormData: KBFormData = {
  name: '',
  description: '',
};

export default function KnowledgeBasePage() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingKB, setEditingKB] = useState<KnowledgeBase | null>(null);
  const [formData, setFormData] = useState<KBFormData>(initialFormData);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [previewDoc, setPreviewDoc] = useState<KBDocument | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  const loadKnowledgeBases = () => {
    const kbs = getAllKnowledgeBases();
    setKnowledgeBases(kbs);
    // 如果有选中的知识库，更新它
    if (selectedKB) {
      const updated = kbs.find(kb => kb.id === selectedKB.id);
      if (updated) {
        setSelectedKB(updated);
      }
    }
  };

  const filteredKBs = knowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kb.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenCreate = () => {
    setEditingKB(null);
    setFormData(initialFormData);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (kb: KnowledgeBase) => {
    setEditingKB(kb);
    setFormData({
      name: kb.name,
      description: kb.description,
    });
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      message.warning('请输入知识库名称');
      return;
    }

    if (editingKB) {
      updateKnowledgeBase(editingKB.id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
      });
    } else {
      const newKB = await createKnowledgeBase(
        formData.name.trim(),
        formData.description.trim()
      );
      setSelectedKB(newKB);
    }

    loadKnowledgeBases();
    setShowCreateModal(false);
  };

  const handleDelete = async (id: string) => {
    await deleteKnowledgeBase(id);
    if (selectedKB?.id === id) {
      setSelectedKB(null);
    }
    loadKnowledgeBases();
    setShowDeleteConfirm(null);
  };

  // 处理文档上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedKB) return;

    setUploadingDoc(true);
    setProcessingStatus('正在读取文件...');

    try {
      const fileType = file.name.split('.').pop()?.toLowerCase() || '';
      let content = '';

      if (fileType === 'txt' || fileType === 'md') {
        content = await file.text();
      } else if (fileType === 'docx') {
        setProcessingStatus('正在解析 Word 文档...');
        const arrayBuffer = await file.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } else {
        message.warning('不支持的文件格式，请上传 .txt、.md 或 .docx 文件');
        setUploadingDoc(false);
        setProcessingStatus('');
        return;
      }

      if (!content.trim()) {
        message.warning('文件内容为空');
        setUploadingDoc(false);
        setProcessingStatus('');
        return;
      }

      setProcessingStatus('正在分块处理...');
      await new Promise(resolve => setTimeout(resolve, 300)); // 模拟处理延迟

      setProcessingStatus('正在同步到 RAGFlow...');
      await addDocumentToKB(selectedKB.id, file.name, fileType, file.size, content, file);

      setProcessingStatus('处理完成');
      await new Promise(resolve => setTimeout(resolve, 300));

      loadKnowledgeBases();
    } catch (error) {
      console.error('文件处理错误:', error);
      message.error('文件处理失败');
    } finally {
      setUploadingDoc(false);
      setProcessingStatus('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveDocument = async (docId: string) => {
    if (!selectedKB) return;
    await removeDocumentFromKB(selectedKB.id, docId);
    loadKnowledgeBases();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Database size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">知识库管理</h1>
                <p className="text-sm text-gray-500">上传文档构建RAG检索知识库</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* 左侧：知识库列表 */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* 搜索和新建 */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索知识库"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <button
                    onClick={handleOpenCreate}
                    className="p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                    title="新建知识库"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="text-xs text-gray-400">
                  共 {knowledgeBases.length} 个知识库
                </div>
              </div>

              {/* 知识库列表 */}
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
                {filteredKBs.length === 0 ? (
                  <div className="p-8 text-center">
                    <FolderOpen size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-400">暂无知识库</p>
                    <button
                      onClick={handleOpenCreate}
                      className="mt-3 text-sm text-indigo-500 hover:text-indigo-600"
                    >
                      创建第一个知识库
                    </button>
                  </div>
                ) : (
                  filteredKBs.map(kb => (
                    <div
                      key={kb.id}
                      onClick={() => setSelectedKB(kb)}
                      className={`p-4 border-b border-gray-50 cursor-pointer transition-colors ${
                        selectedKB?.id === kb.id
                          ? 'bg-indigo-50 border-l-2 border-l-indigo-500'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">{kb.name}</h3>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{kb.description || '无描述'}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <File size={12} />
                              {kb.documents.length} 个文档
                            </span>
                            <span className="flex items-center gap-1">
                              <Layers size={12} />
                              {kb.totalChunks} 个分块
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={16} className={`text-gray-400 flex-shrink-0 ${selectedKB?.id === kb.id ? 'text-indigo-500' : ''}`} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 右侧：知识库详情 */}
          <div className="flex-1">
            {selectedKB ? (
              <div className="bg-white rounded-lg border border-gray-200">
                {/* 知识库信息 */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">{selectedKB.name}</h2>
                      <p className="text-sm text-gray-500 mt-1">{selectedKB.description || '无描述'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(selectedKB)}
                        className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="编辑"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(selectedKB.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* 统计信息 */}
                  <div className="grid grid-cols-4 gap-4 mt-6">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                        <File size={14} />
                        文档数
                      </div>
                      <div className="text-lg font-semibold text-gray-900">{selectedKB.documents.length}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                        <Layers size={14} />
                        分块数
                      </div>
                      <div className="text-lg font-semibold text-gray-900">{selectedKB.totalChunks}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                        <HardDrive size={14} />
                        总大小
                      </div>
                      <div className="text-lg font-semibold text-gray-900">{formatFileSize(selectedKB.totalSize)}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                        <Clock size={14} />
                        更新时间
                      </div>
                      <div className="text-sm font-medium text-gray-900">{formatDate(selectedKB.updatedAt)}</div>
                    </div>
                  </div>
                </div>

                {/* 文档列表 */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-gray-900">文档列表</h3>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.md,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="doc-upload"
                        disabled={uploadingDoc}
                      />
                      <label
                        htmlFor="doc-upload"
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
                          uploadingDoc
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-indigo-500 text-white hover:bg-indigo-600'
                        }`}
                      >
                        {uploadingDoc ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            {processingStatus}
                          </>
                        ) : (
                          <>
                            <Upload size={16} />
                            上传文档
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  {selectedKB.documents.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
                      <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500 mb-2">暂无文档</p>
                      <p className="text-sm text-gray-400">上传 .txt、.md 或 .docx 文件开始构建知识库</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedKB.documents.map((doc: KBDocument) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg group"
                        >
                          <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                            <FileText size={20} className="text-indigo-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900 truncate">{doc.fileName}</h4>
                              <span className={`px-2 py-0.5 text-xs rounded ${
                                doc.status === 'ready'
                                  ? 'bg-green-100 text-green-600'
                                  : doc.status === 'processing'
                                  ? 'bg-yellow-100 text-yellow-600'
                                  : 'bg-red-100 text-red-600'
                              }`}>
                                {doc.status === 'ready' ? '已就绪' : doc.status === 'processing' ? '处理中' : '错误'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                              <span>{formatFileSize(doc.fileSize)}</span>
                              <span>{doc.chunks.length} 个分块</span>
                              <span>{formatDate(doc.uploadedAt)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={() => setPreviewDoc(doc)}
                              className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg"
                              title="查看分块"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => handleRemoveDocument(doc.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                              title="删除文档"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* RAG流程说明 */}
                  <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={18} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-indigo-700">
                        <p className="font-medium mb-1">RAG 检索增强生成</p>
                        <p className="text-indigo-600">
                          上传的文档会自动分块并建立索引。在对话中选择此知识库后，系统会根据问题检索相关内容，作为上下文提供给AI，从而生成更准确的回答。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <Database size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">选择一个知识库</h3>
                <p className="text-sm text-gray-500">从左侧列表选择知识库查看详情，或创建新的知识库</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 新建/编辑弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">
                {editingKB ? '编辑知识库' : '新建知识库'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="输入知识库名称"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="简要描述知识库的用途"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 rounded-b-lg">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors flex items-center gap-2"
              >
                <Check size={16} />
                {editingKB ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
              <p className="text-gray-500 text-sm mb-6">删除后无法恢复，知识库中的所有文档也将被删除。</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 分块预览弹窗 */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Layers size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">文档分块预览</h3>
                  <p className="text-sm text-gray-500">{previewDoc.fileName}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* 统计信息 */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-6 text-sm">
                <span className="text-gray-600">
                  共 <span className="font-semibold text-indigo-600">{previewDoc.chunks.length}</span> 个分块
                </span>
                <span className="text-gray-600">
                  文件大小：<span className="font-medium">{formatFileSize(previewDoc.fileSize)}</span>
                </span>
                <span className="text-gray-600">
                  平均分块：<span className="font-medium">
                    {previewDoc.chunks.length > 0
                      ? Math.round(previewDoc.content.length / previewDoc.chunks.length)
                      : 0} 字符
                  </span>
                </span>
              </div>
            </div>

            {/* 分块列表 */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {previewDoc.chunks.map((chunk, index) => (
                  <div
                    key={chunk.id}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* 分块头部 */}
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-indigo-500 text-white text-xs font-medium rounded flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          分块 {index + 1} / {previewDoc.chunks.length}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {chunk.content.length} 字符
                      </span>
                    </div>
                    {/* 分块内容 */}
                    <div className="p-4 bg-white">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                        {chunk.content}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 底部操作 */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
