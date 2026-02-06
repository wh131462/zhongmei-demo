import type { KnowledgeBase, KBDocument, DocumentChunk } from '../types';

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

// 创建知识库
export function createKnowledgeBase(name: string, description: string): KnowledgeBase {
  const now = Date.now();
  const newKB: KnowledgeBase = {
    id: `kb_${now}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    documents: [],
    totalChunks: 0,
    totalSize: 0,
    createdAt: now,
    updatedAt: now,
  };

  const kbs = getAllKnowledgeBases();
  kbs.push(newKB);
  saveKnowledgeBases(kbs);

  return newKB;
}

// 添加文档到知识库
export function addDocumentToKB(
  kbId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  content: string
): KBDocument | null {
  const kbs = getAllKnowledgeBases();
  const kb = kbs.find(k => k.id === kbId);

  if (!kb) return null;

  const chunks = chunkDocument(content, fileName);

  const doc: KBDocument = {
    id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fileName,
    fileType,
    fileSize,
    content,
    chunks,
    uploadedAt: Date.now(),
    status: 'ready',
  };

  kb.documents.push(doc);
  kb.totalChunks = kb.documents.reduce((sum, d) => sum + d.chunks.length, 0);
  kb.totalSize = kb.documents.reduce((sum, d) => sum + d.fileSize, 0);
  kb.updatedAt = Date.now();

  saveKnowledgeBases(kbs);
  return doc;
}

// 从知识库删除文档
export function removeDocumentFromKB(kbId: string, docId: string): boolean {
  const kbs = getAllKnowledgeBases();
  const kb = kbs.find(k => k.id === kbId);

  if (!kb) return false;

  const index = kb.documents.findIndex(d => d.id === docId);
  if (index === -1) return false;

  kb.documents.splice(index, 1);
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

// 删除知识库
export function deleteKnowledgeBase(id: string): boolean {
  const kbs = getAllKnowledgeBases();
  const index = kbs.findIndex(kb => kb.id === id);

  if (index === -1) return false;

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

  if (chunks.length === 0) {
    return '';
  }

  const context = chunks.map((chunk, i) =>
    `[参考资料 ${i + 1}] 来源: ${chunk.metadata.source}\n${chunk.content}`
  ).join('\n\n---\n\n');

  return `请基于以下参考资料回答用户问题。如果参考资料中没有相关信息，请如实告知。

${context}

---

请用中文回答，保持专业、准确。`;
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
