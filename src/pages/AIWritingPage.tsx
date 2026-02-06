import { useState, useRef } from 'react';

// API 配置
const API_CONFIG = {
  url: 'http://183.252.196.133:38000/v1/chat/completions',
  key: 'sk-ycd03E09f7cG1',
  model: 'yantronic-o1-mini',
};

// 上传的模板类型
interface UploadedTemplate {
  name: string;
  content: string;
  fileType: string;
}

// 主页面组件
const AIWritingPage: React.FC = () => {
  // 状态管理
  const [uploadedTemplate, setUploadedTemplate] = useState<UploadedTemplate | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [activeTab, setActiveTab] = useState<'template' | 'result'>('template');
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setGenerationProgress('正在读取文件...');

    try {
      const fileType = file.name.split('.').pop()?.toLowerCase() || '';
      let content = '';

      if (fileType === 'txt' || fileType === 'md') {
        // 纯文本文件
        content = await file.text();
      } else if (fileType === 'docx') {
        // Word 文档 - 使用 mammoth 解析
        const arrayBuffer = await file.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } else if (fileType === 'doc') {
        setGenerationProgress('⚠️ 不支持 .doc 格式，请转换为 .docx 格式后重试');
        setIsUploading(false);
        return;
      } else {
        setGenerationProgress('⚠️ 不支持的文件格式，请上传 .txt、.md 或 .docx 文件');
        setIsUploading(false);
        return;
      }

      setUploadedTemplate({
        name: file.name,
        content: content,
        fileType: fileType,
      });
      setGeneratedContent('');
      setGenerationProgress(`✅ 已上传模板：${file.name}`);
      setActiveTab('template');
    } catch (error) {
      console.error('文件读取错误:', error);
      setGenerationProgress(`❌ 文件读取失败: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
      // 清空 input 以便重复上传同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // AI 生成内容
  const handleGenerate = async () => {
    if (!uploadedTemplate || !userPrompt.trim()) return;

    setIsGenerating(true);
    setGenerationProgress('正在基于模板生成内容...');
    setGeneratedContent('');
    
    abortControllerRef.current = new AbortController();

    try {
      const systemPrompt = `你是一个专业的文档写作助手。用户上传了一个模板文档，请严格按照模板的格式和结构，根据用户的需求生成新的文档内容。

【重要要求】
1. 必须完全保持模板的格式、结构和排版
2. 识别模板中的占位符、空白处或需要填写的部分，根据用户需求填入相应内容
3. 保持模板中的固定文字不变，只替换需要填写的部分
4. 如果模板中有表格、列表等结构，保持这些结构不变
5. 语言风格要与模板保持一致
6. 直接输出完整的文档内容，不要添加任何额外说明

【模板内容】
${uploadedTemplate.content}

【结束模板】`;

      const response = await fetch(API_CONFIG.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.key}`,
        },
        body: JSON.stringify({
          model: API_CONFIG.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                setGeneratedContent(fullContent);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      setGeneratedContent(fullContent);
      setGenerationProgress('✅ 生成完成！');
      setActiveTab('result');
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setGenerationProgress('已取消生成');
      } else {
        console.error('生成错误:', error);
        setGenerationProgress(`❌ 生成失败: ${(error as Error).message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // 取消生成
  const handleCancelGenerate = () => {
    abortControllerRef.current?.abort();
  };

  // 清除上传的模板
  const handleClearTemplate = () => {
    setUploadedTemplate(null);
    setGeneratedContent('');
    setUserPrompt('');
    setGenerationProgress('');
  };

  // 导出为文本
  const handleExportText = () => {
    if (!generatedContent) return;
    
    const fileName = `${uploadedTemplate?.name.replace(/\.[^/.]+$/, '') || '文档'}_生成_${new Date().toISOString().slice(0, 10)}.txt`;
    
    const blob = new Blob([generatedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 复制到剪贴板
  const handleCopy = async () => {
    if (!generatedContent) return;
    try {
      await navigator.clipboard.writeText(generatedContent);
      setGenerationProgress('✅ 已复制到剪贴板');
      setTimeout(() => setGenerationProgress(''), 2000);
    } catch {
      setGenerationProgress('❌ 复制失败');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-xl">✍️</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AI 模板写作</h1>
                <p className="text-sm text-gray-500">上传模板，AI 帮你快速填写生成文档</p>
              </div>
            </div>
            <a 
              href="/"
              className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              返回首页
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {!uploadedTemplate ? (
          // 未上传模板时显示上传区域
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12">
            <div className="max-w-md mx-auto text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.docx"
                onChange={handleFileUpload}
                className="hidden"
                id="template-upload"
              />
              <label 
                htmlFor="template-upload"
                className="block cursor-pointer"
              >
                <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 hover:from-blue-200 hover:to-purple-200 transition-colors">
                  <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">上传文档模板</h2>
                <p className="text-gray-500 mb-6">支持 .txt、.md、.docx 格式</p>
                <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  选择文件
                </div>
              </label>
              
              {generationProgress && (
                <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                  {generationProgress}
                </div>
              )}

              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-4">使用说明</h3>
                <div className="text-left space-y-3 text-sm text-gray-600">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                    <span>上传您的文档模板（合同、申请表、报告等）</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    <span>描述您需要填写的内容和要求</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                    <span>AI 会按照模板格式自动生成完整文档</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // 已上传模板时显示编辑界面
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* 模板信息 */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">📄</span>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{uploadedTemplate.name}</h2>
                    <p className="text-sm text-gray-600">{uploadedTemplate.fileType.toUpperCase()} 模板 · {uploadedTemplate.content.length} 字符</p>
                  </div>
                </div>
                <button
                  onClick={handleClearTemplate}
                  className="px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  更换模板
                </button>
              </div>
            </div>

            {/* AI 生成区域 */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                告诉 AI 你需要填写什么内容
              </label>
              <div className="flex gap-4">
                <textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="例如：请帮我填写这份合同，甲方是XX公司，乙方是YY公司，合同金额10万元，服务期限1年..."
                  rows={3}
                  disabled={isGenerating}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 resize-none"
                />
                <div className="flex flex-col gap-2">
                  {isGenerating ? (
                    <button
                      onClick={handleCancelGenerate}
                      className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2 h-full"
                    >
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      取消
                    </button>
                  ) : (
                    <button
                      onClick={handleGenerate}
                      disabled={!userPrompt.trim()}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-full"
                    >
                      <span>✨</span>
                      生成文档
                    </button>
                  )}
                </div>
              </div>
              {generationProgress && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  {generationProgress}
                </div>
              )}
            </div>

            {/* 标签页切换 */}
            <div className="px-6 py-2 border-b border-gray-200 flex gap-4">
              <button
                onClick={() => setActiveTab('template')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
                  ${activeTab === 'template' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                📝 原始模板
              </button>
              <button
                onClick={() => setActiveTab('result')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
                  ${activeTab === 'result' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                ✨ 生成结果
                {generatedContent && <span className="ml-1 text-green-500">●</span>}
              </button>
              <div className="flex-1"></div>
              {generatedContent && (
                <>
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                  >
                    📋 复制
                  </button>
                  <button
                    onClick={handleExportText}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                  >
                    📥 导出
                  </button>
                </>
              )}
            </div>

            {/* 内容区域 */}
            <div className="p-6 min-h-[400px]">
              {activeTab === 'template' ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700">模板内容预览</h3>
                    <span className="text-xs text-gray-500">{uploadedTemplate.content.length} 字符</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 max-h-[500px] overflow-auto">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                      {uploadedTemplate.content}
                    </pre>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700">AI 生成结果</h3>
                    {generatedContent && (
                      <span className="text-xs text-gray-500">{generatedContent.length} 字符</span>
                    )}
                  </div>
                  {generatedContent ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm max-h-[500px] overflow-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                        {generatedContent}
                      </pre>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-12 text-center">
                      <div className="text-5xl mb-4">✨</div>
                      <h4 className="text-lg font-medium text-gray-700 mb-2">等待生成</h4>
                      <p className="text-gray-500 text-sm">在上方输入您的需求，点击"生成文档"按钮</p>
                      <p className="text-gray-400 text-xs mt-2">AI 将按照模板格式为您生成完整文档</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIWritingPage;