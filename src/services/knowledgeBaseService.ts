import type { KnowledgeBase, KBDocument, DocumentChunk, KnowledgeBaseOption } from '../types';
import {
  getRAGFlowDatasets,
  buildRAGFlowPrompt,
  createDataset,
  deleteDataset,
  uploadDocument,
  parseDocuments,
  getDocuments,
  deleteDocuments,
  type RAGFlowDataset
} from './ragflowService';

const STORAGE_KEY = 'knowledge_bases_v2';
const CHUNK_SIZE = 500; // 每个分块的字符数
const CHUNK_OVERLAP = 50; // 分块重叠字符数

// 获取所有知识库
export function getAllKnowledgeBases(): KnowledgeBase[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load knowledge bases:', e);
  }
  return [];
}

// 保存知识库
function saveKnowledgeBases(kbs: KnowledgeBase[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kbs));
  } catch (e) {
    console.error('Failed to save knowledge bases:', e);
  }
}

// 根据ID获取知识库
export function getKnowledgeBaseById(id: string): KnowledgeBase | undefined {
  return getAllKnowledgeBases().find(kb => kb.id === id);
}

// 文档分块 - 模拟真实RAG的chunking过程
export function chunkDocument(content: string, fileName: string): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];

  // 先按段落分割
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());

  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    // 如果当前段落本身就超过 CHUNK_SIZE，需要进一步分割
    if (paragraph.length > CHUNK_SIZE) {
      // 先保存当前累积的内容
      if (currentChunk.trim()) {
        chunks.push({
          id: `chunk_${Date.now()}_${chunkIndex}`,
          content: currentChunk.trim(),
          metadata: {
            source: fileName,
            chunkIndex,
            totalChunks: 0, // 稍后更新
          },
        });
        chunkIndex++;
        currentChunk = '';
      }

      // 按句子分割长段落
      const sentences = paragraph.split(/(?<=[。！？.!?])\s*/);
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > CHUNK_SIZE && currentChunk) {
          chunks.push({
            id: `chunk_${Date.now()}_${chunkIndex}`,
            content: currentChunk.trim(),
            metadata: {
              source: fileName,
              chunkIndex,
              totalChunks: 0,
            },
          });
          chunkIndex++;
          // 保留重叠部分
          currentChunk = currentChunk.slice(-CHUNK_OVERLAP) + sentence;
        } else {
          currentChunk += sentence;
        }
      }
    } else if ((currentChunk + '\n\n' + paragraph).length > CHUNK_SIZE) {
      // 当前chunk已满，保存并开始新chunk
      if (currentChunk.trim()) {
        chunks.push({
          id: `chunk_${Date.now()}_${chunkIndex}`,
          content: currentChunk.trim(),
          metadata: {
            source: fileName,
            chunkIndex,
            totalChunks: 0,
          },
        });
        chunkIndex++;
      }
      // 保留重叠部分
      currentChunk = currentChunk.slice(-CHUNK_OVERLAP) + paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  // 保存最后一个chunk
  if (currentChunk.trim()) {
    chunks.push({
      id: `chunk_${Date.now()}_${chunkIndex}`,
      content: currentChunk.trim(),
      metadata: {
        source: fileName,
        chunkIndex,
        totalChunks: 0,
      },
    });
  }

  // 更新totalChunks
  const totalChunks = chunks.length;
  chunks.forEach(chunk => {
    chunk.metadata.totalChunks = totalChunks;
  });

  return chunks;
}

// 创建知识库（同步到 RAGFlow）
export async function createKnowledgeBase(name: string, description: string): Promise<KnowledgeBase> {
  const now = Date.now();
  const newKB: KnowledgeBase = {
    id: `kb_${now}_${Math.random().toString(36).substring(2, 11)}`,
    name,
    description,
    documents: [],
    totalChunks: 0,
    totalSize: 0,
    createdAt: now,
    updatedAt: now,
  };

  // 同步创建 RAGFlow 知识库
  try {
    const ragflowDataset = await createDataset(name, description);
    newKB.ragflowDatasetId = ragflowDataset.id;
  } catch (error) {
    console.error('创建 RAGFlow 知识库失败，仅使用本地存储:', error);
  }

  const kbs = getAllKnowledgeBases();
  kbs.push(newKB);
  saveKnowledgeBases(kbs);

  return newKB;
}

// 添加文档到知识库（同步到 RAGFlow）
export async function addDocumentToKB(
  kbId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  content: string,
  file?: File // 原始文件，用于上传到 RAGFlow
): Promise<KBDocument | null> {
  const kbs = getAllKnowledgeBases();
  const kb = kbs.find(k => k.id === kbId);

  if (!kb) return null;

  const chunks = chunkDocument(content, fileName);

  const doc: KBDocument = {
    id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    fileName,
    fileType,
    fileSize,
    content,
    chunks,
    uploadedAt: Date.now(),
    status: 'ready',
    ragflowStatus: 'pending',
  };

  kb.documents.push(doc);
  kb.totalChunks = kb.documents.reduce((sum, d) => sum + d.chunks.length, 0);
  kb.totalSize = kb.documents.reduce((sum, d) => sum + d.fileSize, 0);
  kb.updatedAt = Date.now();

  saveKnowledgeBases(kbs);

  // 同步上传到 RAGFlow（如果有关联的 RAGFlow 知识库）
  if (kb.ragflowDatasetId && file) {
    syncDocumentToRAGFlow(kb.ragflowDatasetId, doc.id, file).catch(error => {
      console.error('同步文档到 RAGFlow 失败:', error);
    });
  }

  return doc;
}

// 同步文档到 RAGFlow（后台执行）
async function syncDocumentToRAGFlow(
  datasetId: string,
  localDocId: string,
  file: File
): Promise<void> {
  const kbs = getAllKnowledgeBases();
  const kb = kbs.find(k => k.ragflowDatasetId === datasetId);
  if (!kb) return;

  const doc = kb.documents.find(d => d.id === localDocId);
  if (!doc) return;

  try {
    // 更新状态为上传中
    doc.ragflowStatus = 'uploading';
    saveKnowledgeBases(kbs);

    // 上传文档
    const ragflowDoc = await uploadDocument(datasetId, file);
    doc.ragflowDocId = ragflowDoc.id;
    doc.ragflowStatus = 'parsing';
    saveKnowledgeBases(kbs);

    // 触发解析
    await parseDocuments(datasetId, [ragflowDoc.id]);

    // 轮询等待解析完成
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const docs = await getDocuments(datasetId);
      const updatedDoc = docs.find(d => d.id === ragflowDoc.id);

      if (updatedDoc) {
        if (updatedDoc.run === 'DONE') {
          doc.ragflowStatus = 'ready';
          saveKnowledgeBases(kbs);
          return;
        } else if (updatedDoc.run === 'FAIL') {
          doc.ragflowStatus = 'error';
          saveKnowledgeBases(kbs);
          return;
        }
      }
    }

    // 超时
    doc.ragflowStatus = 'error';
    saveKnowledgeBases(kbs);
  } catch (error) {
    doc.ragflowStatus = 'error';
    saveKnowledgeBases(kbs);
    throw error;
  }
}

// 从知识库删除文档（同步删除 RAGFlow 文档）
export async function removeDocumentFromKB(kbId: string, docId: string): Promise<boolean> {
  const kbs = getAllKnowledgeBases();
  const kb = kbs.find(k => k.id === kbId);

  if (!kb) return false;

  const docIndex = kb.documents.findIndex(d => d.id === docId);
  if (docIndex === -1) return false;

  const doc = kb.documents[docIndex];

  // 同步删除 RAGFlow 文档
  if (kb.ragflowDatasetId && doc.ragflowDocId) {
    try {
      await deleteDocuments(kb.ragflowDatasetId, [doc.ragflowDocId]);
    } catch (error) {
      console.error('删除 RAGFlow 文档失败:', error);
      // 继续删除本地文档
    }
  }

  kb.documents.splice(docIndex, 1);
  kb.totalChunks = kb.documents.reduce((sum, d) => sum + d.chunks.length, 0);
  kb.totalSize = kb.documents.reduce((sum, d) => sum + d.fileSize, 0);
  kb.updatedAt = Date.now();

  saveKnowledgeBases(kbs);
  return true;
}

// 更新知识库信息
export function updateKnowledgeBase(id: string, updates: { name?: string; description?: string }): KnowledgeBase | null {
  const kbs = getAllKnowledgeBases();
  const index = kbs.findIndex(kb => kb.id === id);

  if (index === -1) return null;

  kbs[index] = {
    ...kbs[index],
    ...updates,
    updatedAt: Date.now(),
  };

  saveKnowledgeBases(kbs);
  return kbs[index];
}

// 删除知识库（同步删除 RAGFlow 知识库）
export async function deleteKnowledgeBase(id: string): Promise<boolean> {
  const kbs = getAllKnowledgeBases();
  const index = kbs.findIndex(kb => kb.id === id);

  if (index === -1) return false;

  const kb = kbs[index];

  // 同步删除 RAGFlow 知识库
  if (kb.ragflowDatasetId) {
    try {
      await deleteDataset(kb.ragflowDatasetId);
    } catch (error) {
      console.error('删除 RAGFlow 知识库失败:', error);
      // 继续删除本地知识库
    }
  }

  kbs.splice(index, 1);
  saveKnowledgeBases(kbs);
  return true;
}

// 模拟检索 - 简单的关键词匹配（真实RAG会用向量相似度）
export function retrieveChunks(kbId: string, query: string, topK: number = 3): DocumentChunk[] {
  const kb = getKnowledgeBaseById(kbId);
  if (!kb) return [];

  const allChunks = kb.documents.flatMap(d => d.chunks);

  // 简单的关键词匹配评分
  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 1);

  const scored = allChunks.map(chunk => {
    const contentLower = chunk.content.toLowerCase();
    let score = 0;
    for (const keyword of keywords) {
      const matches = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
      score += matches;
    }
    return { chunk, score };
  });

  // 按分数排序，取前K个
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter(s => s.score > 0).map(s => s.chunk);
}

// 构建包含知识库检索结果的提示词
export function buildPromptWithRAG(kb: KnowledgeBase, userQuery: string): string {
  const chunks = retrieveChunks(kb.id, userQuery, 5);

  // 构建知识库元信息
  const kbInfo = `## 当前知识库信息
- 知识库名称：${kb.name}
- 描述：${kb.description || '无'}
- 文档数量：${kb.documents.length}
- 总分块数：${kb.totalChunks}
- 包含文档：${kb.documents.map(d => d.fileName).join('、') || '无'}`;

  if (chunks.length === 0) {
    // 没有匹配的分块时，提供知识库概览和部分内容预览
    const preview = kb.documents.slice(0, 2).map(doc => {
      const previewContent = doc.content.slice(0, 500);
      return `### ${doc.fileName}\n${previewContent}${doc.content.length > 500 ? '...' : ''}`;
    }).join('\n\n');

    return `你正在使用知识库"${kb.name}"来回答用户问题。

${kbInfo}

## 知识库内容预览
${preview || '知识库暂无文档'}

---

请基于知识库的内容回答用户问题。如果用户询问知识库的内容概述，请根据以上信息进行说明。
请用中文回答，保持专业、准确。`;
  }

  // 有匹配的分块时，提供检索结果
  const context = chunks.map((chunk, i) =>
    `[参考资料 ${i + 1}] 来源: ${chunk.metadata.source}\n${chunk.content}`
  ).join('\n\n---\n\n');

  return `你正在使用知识库"${kb.name}"来回答用户问题。

${kbInfo}

## 检索到的相关内容
${context}

---

请基于以上检索到的参考资料回答用户问题。优先使用检索到的内容，如果检索结果不足以回答问题，可以结合知识库的整体信息进行回答。
请用中文回答，保持专业、准确。`;
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ==================== RAGFlow 集成 ====================

/**
 * 获取 RAGFlow 知识库列表（转换为统一格式）
 */
export async function getRAGFlowKnowledgeBases(): Promise<KnowledgeBaseOption[]> {
  try {
    const datasets = await getRAGFlowDatasets();
    return datasets.map((d: RAGFlowDataset) => ({
      id: d.id,
      name: d.name,
      description: d.description || '',
      source: 'ragflow' as const,
      chunkCount: d.chunk_count,
      documentCount: d.document_count,
    }));
  } catch (error) {
    console.error('获取 RAGFlow 知识库失败:', error);
    return [];
  }
}

/**
 * 获取所有知识库（本地 + RAGFlow）
 */
export async function getAllKnowledgeBaseOptions(): Promise<KnowledgeBaseOption[]> {
  const localKBs = getAllKnowledgeBases();
  const localOptions: KnowledgeBaseOption[] = localKBs.map(kb => ({
    id: kb.id,
    name: kb.name,
    description: kb.description,
    source: 'local' as const,
    chunkCount: kb.totalChunks,
    documentCount: kb.documents.length,
  }));

  try {
    const ragflowOptions = await getRAGFlowKnowledgeBases();
    return [...localOptions, ...ragflowOptions];
  } catch {
    return localOptions;
  }
}

/**
 * 使用 RAGFlow 构建 RAG 提示词
 */
export async function buildPromptWithRAGFlow(
  datasetIds: string[],
  userQuery: string,
  topK: number = 5
): Promise<string> {
  return buildRAGFlowPrompt(userQuery, datasetIds, topK);
}
