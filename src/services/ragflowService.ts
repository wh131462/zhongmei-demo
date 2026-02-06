/**
 * RAGFlow 后端服务
 * Demo 专用知识库管理和语义检索
 */

import { appFetch } from '../utils/tauriFetch';

const RAGFLOW_CONFIG = {
  baseUrl: 'http://114.247.37.103:8084',
  apiKey: 'ragflow-U5YTJjMmVjNDVjMjExZjA5ZTFiMjJlM2',
  // Demo 专用知识库名称前缀
  demoKBPrefix: 'text-demo-kb-',
};

// 本地存储键
const DEMO_KB_STORAGE_KEY = 'ragflow_demo_kb_id';

// RAGFlow 知识库类型
export interface RAGFlowDataset {
  id: string;
  name: string;
  description: string | null;
  chunk_count: number;
  document_count: number;
  token_num: number;
  create_date: string;
  update_date: string;
  language: string;
  embedding_model: string;
  similarity_threshold: number;
  vector_similarity_weight: number;
}

// RAGFlow 文档类型
export interface RAGFlowDocument {
  id: string;
  name: string;
  location: string;
  size: number;
  type: string;
  run: 'UNSTART' | 'RUNNING' | 'CANCEL' | 'DONE' | 'FAIL';
  progress: number;
  progress_msg: string;
  chunk_count?: number;
  created_by: string;
  dataset_id: string;
}

// RAGFlow 检索结果块
export interface RAGFlowChunk {
  id: string;
  content: string;
  similarity: number;
  vector_similarity: number;
  term_similarity: number;
  document_id: string;
  document_keyword: string;
  dataset_id: string;
  highlight: string;
  positions: number[][];
}

// 通用响应类型
interface RAGFlowResponse<T> {
  code: number;
  message?: string;
  data: T;
}

// 通用请求头
function getHeaders(isFormData = false): HeadersInit {
  const headers: HeadersInit = {
    'Authorization': `Bearer ${RAGFLOW_CONFIG.apiKey}`,
  };
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

// ==================== Demo 专用知识库管理 ====================

/**
 * 获取或创建 Demo 专用知识库
 */
export async function getOrCreateDemoKB(): Promise<RAGFlowDataset> {
  // 先检查本地存储的知识库 ID
  const storedId = localStorage.getItem(DEMO_KB_STORAGE_KEY);

  if (storedId) {
    try {
      const dataset = await getDatasetById(storedId);
      if (dataset) {
        return dataset;
      }
    } catch {
      // 知识库可能已被删除，继续创建新的
    }
  }

  // 创建新的 Demo 知识库
  const timestamp = Date.now();
  const dataset = await createDataset(
    `${RAGFLOW_CONFIG.demoKBPrefix}${timestamp}`,
    'Text Demo 专用知识库 - 自动创建'
  );

  // 保存知识库 ID
  localStorage.setItem(DEMO_KB_STORAGE_KEY, dataset.id);

  return dataset;
}

/**
 * 获取 Demo 知识库 ID
 */
export function getDemoKBId(): string | null {
  return localStorage.getItem(DEMO_KB_STORAGE_KEY);
}

/**
 * 获取 Demo 知识库的所有文档
 */
export async function getDemoDocuments(): Promise<RAGFlowDocument[]> {
  const kbId = getDemoKBId();
  if (!kbId) return [];

  return getDocuments(kbId);
}

/**
 * 上传文档到 Demo 知识库
 */
export async function uploadDocumentToDemo(
  file: File,
  onProgress?: (status: string) => void
): Promise<RAGFlowDocument> {
  onProgress?.('准备上传...');

  // 确保知识库存在
  const kb = await getOrCreateDemoKB();

  onProgress?.('上传文档中...');

  // 上传文档
  const doc = await uploadDocument(kb.id, file);

  onProgress?.('解析文档中...');

  // 触发解析
  await parseDocuments(kb.id, [doc.id]);

  // 轮询等待解析完成
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const docs = await getDocuments(kb.id);
    const updatedDoc = docs.find(d => d.id === doc.id);

    if (updatedDoc) {
      if (updatedDoc.run === 'DONE') {
        onProgress?.('解析完成');
        return updatedDoc;
      } else if (updatedDoc.run === 'FAIL') {
        throw new Error('文档解析失败');
      } else if (updatedDoc.run === 'RUNNING') {
        onProgress?.(`解析中... ${updatedDoc.progress || 0}%`);
      }
    }
  }

  throw new Error('文档解析超时');
}

/**
 * 从 Demo 知识库删除文档
 */
export async function deleteDocumentFromDemo(docId: string): Promise<void> {
  const kbId = getDemoKBId();
  if (!kbId) throw new Error('Demo 知识库不存在');

  await deleteDocuments(kbId, [docId]);
}

/**
 * 使用 Demo 知识库进行检索
 */
export async function searchDemo(question: string, topK: number = 5): Promise<RAGFlowChunk[]> {
  const kbId = getDemoKBId();
  if (!kbId) return [];

  return ragflowRetrieval(question, [kbId], topK);
}

/**
 * 构建 Demo 知识库的 RAG 提示词
 */
export async function buildDemoRAGPrompt(question: string, topK: number = 5): Promise<string> {
  const chunks = await searchDemo(question, topK);

  if (chunks.length === 0) {
    return '';
  }

  const context = chunks
    .map((chunk, i) => {
      const similarity = (chunk.similarity * 100).toFixed(1);
      return `[参考资料 ${i + 1}] 来源: ${chunk.document_keyword} (相关度: ${similarity}%)\n${chunk.content}`;
    })
    .join('\n\n---\n\n');

  return `请基于以下参考资料回答用户问题。如果参考资料中没有相关信息，请如实告知。

${context}

---

请用中文回答，保持专业、准确。`;
}

// ==================== 底层 API 封装 ====================

/**
 * 创建知识库
 */
export async function createDataset(name: string, description?: string): Promise<RAGFlowDataset> {
  const response = await appFetch(`${RAGFLOW_CONFIG.baseUrl}/api/v1/datasets`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, description }),
  });

  const result: RAGFlowResponse<RAGFlowDataset> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || '创建知识库失败');
  }

  return result.data;
}

/**
 * 获取知识库详情
 */
export async function getDatasetById(id: string): Promise<RAGFlowDataset | null> {
  const response = await appFetch(`${RAGFLOW_CONFIG.baseUrl}/api/v1/datasets?id=${id}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  const result: RAGFlowResponse<RAGFlowDataset[]> = await response.json();

  if (result.code !== 0 || !result.data || result.data.length === 0) {
    return null;
  }

  return result.data.find(d => d.id === id) || null;
}

/**
 * 获取知识库文档列表
 */
export async function getDocuments(datasetId: string): Promise<RAGFlowDocument[]> {
  const response = await appFetch(`${RAGFLOW_CONFIG.baseUrl}/api/v1/datasets/${datasetId}/documents`, {
    method: 'GET',
    headers: getHeaders(),
  });

  const result: RAGFlowResponse<RAGFlowDocument[]> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || '获取文档列表失败');
  }

  return result.data || [];
}

/**
 * 上传文档
 */
export async function uploadDocument(datasetId: string, file: File): Promise<RAGFlowDocument> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await appFetch(`${RAGFLOW_CONFIG.baseUrl}/api/v1/datasets/${datasetId}/documents`, {
    method: 'POST',
    headers: getHeaders(true),
    body: formData,
  });

  const result: RAGFlowResponse<RAGFlowDocument[]> = await response.json();

  if (result.code !== 0 || !result.data || result.data.length === 0) {
    throw new Error(result.message || '上传文档失败');
  }

  return result.data[0];
}

/**
 * 触发文档解析
 */
export async function parseDocuments(datasetId: string, documentIds: string[]): Promise<void> {
  const response = await appFetch(`${RAGFLOW_CONFIG.baseUrl}/api/v1/datasets/${datasetId}/chunks`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ document_ids: documentIds }),
  });

  const result: RAGFlowResponse<null> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || '触发解析失败');
  }
}

/**
 * 删除文档
 */
export async function deleteDocuments(datasetId: string, documentIds: string[]): Promise<void> {
  const response = await appFetch(`${RAGFLOW_CONFIG.baseUrl}/api/v1/datasets/${datasetId}/documents`, {
    method: 'DELETE',
    headers: getHeaders(),
    body: JSON.stringify({ ids: documentIds }),
  });

  const result: RAGFlowResponse<null> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || '删除文档失败');
  }
}

/**
 * 删除知识库
 */
export async function deleteDataset(datasetId: string): Promise<void> {
  const response = await appFetch(`${RAGFLOW_CONFIG.baseUrl}/api/v1/datasets`, {
    method: 'DELETE',
    headers: getHeaders(),
    body: JSON.stringify({ ids: [datasetId] }),
  });

  const result: RAGFlowResponse<null> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || '删除知识库失败');
  }
}

/**
 * 语义检索
 */
export async function ragflowRetrieval(
  question: string,
  datasetIds: string[],
  topK: number = 5
): Promise<RAGFlowChunk[]> {
  const response = await appFetch(`${RAGFLOW_CONFIG.baseUrl}/api/v1/retrieval`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      question,
      dataset_ids: datasetIds,
      top_k: topK,
    }),
  });

  const result: RAGFlowResponse<{ chunks: RAGFlowChunk[]; total: number }> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || '检索失败');
  }

  return result.data?.chunks || [];
}

/**
 * 检查 RAGFlow 服务是否可用
 */
export async function checkRAGFlowHealth(): Promise<boolean> {
  try {
    const response = await appFetch(`${RAGFLOW_CONFIG.baseUrl}/api/v1/datasets`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const result = await response.json();
    return result.code === 0;
  } catch {
    return false;
  }
}

// ==================== 兼容旧 API ====================

export async function getRAGFlowDatasets(): Promise<RAGFlowDataset[]> {
  const response = await appFetch(`${RAGFLOW_CONFIG.baseUrl}/api/v1/datasets`, {
    method: 'GET',
    headers: getHeaders(),
  });

  const result: RAGFlowResponse<RAGFlowDataset[]> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message || '获取知识库列表失败');
  }

  return result.data || [];
}

export async function buildRAGFlowPrompt(
  question: string,
  datasetIds: string[],
  topK: number = 5
): Promise<string> {
  const chunks = await ragflowRetrieval(question, datasetIds, topK);

  if (chunks.length === 0) {
    return '';
  }

  const context = chunks
    .map((chunk, i) => {
      const similarity = (chunk.similarity * 100).toFixed(1);
      return `[参考资料 ${i + 1}] 来源: ${chunk.document_keyword} (相关度: ${similarity}%)\n${chunk.content}`;
    })
    .join('\n\n---\n\n');

  return `请基于以下参考资料回答用户问题。如果参考资料中没有相关信息，请如实告知。

${context}

---

请用中文回答，保持专业、准确。`;
}
