import { useState } from 'react';
import { FileText, Wand2, Check, AlertCircle, ChevronRight } from 'lucide-react';
import { templates, mockTypoCheck, sampleDocument } from '../mock/data';
import type { Template } from '../types';

type Step = 'input' | 'select-template' | 'preview';

export default function DocumentPage() {
  const [step, setStep] = useState<Step>('input');
  const [inputText, setInputText] = useState(sampleDocument);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedResult, setProcessedResult] = useState<{
    correctedText: string;
    typos: { original: string; correct: string; index: number }[];
    formattedContent: { title: string; sections: { subtitle: string; body: string }[] };
  } | null>(null);

  const handleSelectTemplate = () => {
    if (!inputText.trim()) return;
    setStep('select-template');
  };

  const handleApplyTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setIsProcessing(true);

    // 模拟AI处理延迟
    setTimeout(() => {
      const { correctedText, typos } = mockTypoCheck(inputText);

      // 解析文本结构
      const lines = correctedText.split('\n').filter(line => line.trim());
      const title = lines[0] || '文档标题';
      const sections: { subtitle: string; body: string }[] = [];

      let currentSection = { subtitle: '', body: '' };
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.match(/^[一二三四五六七八九十]+、/)) {
          if (currentSection.subtitle) {
            sections.push(currentSection);
          }
          currentSection = { subtitle: line, body: '' };
        } else if (line.match(/^\d+\./)) {
          currentSection.body += (currentSection.body ? '\n' : '') + line;
        } else {
          currentSection.body += (currentSection.body ? '\n' : '') + line;
        }
      }
      if (currentSection.subtitle || currentSection.body) {
        sections.push(currentSection);
      }

      setProcessedResult({
        correctedText,
        typos,
        formattedContent: { title, sections }
      });
      setIsProcessing(false);
      setStep('preview');
    }, 1500);
  };

  const handleBack = () => {
    if (step === 'select-template') {
      setStep('input');
    } else if (step === 'preview') {
      setStep('select-template');
      setProcessedResult(null);
    }
  };

  const handleSubmit = () => {
    alert('文档已提交！在实际应用中，这里会将文档发送到审批流程。');
  };

  const renderTypoHighlight = (text: string) => {
    if (!processedResult) return text;

    let result = text;
    const originalTypos = mockTypoCheck(inputText).typos;

    originalTypos.forEach(typo => {
      result = result.replace(
        typo.correct,
        `<span class="typo-highlight" data-correct="原文：${typo.original}">${typo.correct}</span>`
      );
    });

    return result;
  };

  return (
    <div className="space-y-6">
      {/* 步骤指示器 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-center space-x-4">
          <StepIndicator step={1} current={step === 'input'} completed={step !== 'input'} label="输入原文" />
          <ChevronRight className="text-gray-300" size={20} />
          <StepIndicator step={2} current={step === 'select-template'} completed={step === 'preview'} label="选择模板" />
          <ChevronRight className="text-gray-300" size={20} />
          <StepIndicator step={3} current={step === 'preview'} completed={false} label="预览结果" />
        </div>
      </div>

      {/* 步骤1：输入原文 */}
      {step === 'input' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText size={20} className="text-blue-600" />
            输入文档内容
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            请输入或粘贴您的文档内容，系统将自动检查错别字并按模板格式化。
            <span className="text-orange-500">（示例文档包含故意的错别字用于演示）</span>
          </p>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full h-96 p-4 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm leading-relaxed"
            placeholder="在此输入文档内容..."
          />
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSelectTemplate}
              disabled={!inputText.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Wand2 size={16} />
              选择模板
            </button>
          </div>
        </div>
      )}

      {/* 步骤2：选择模板 */}
      {step === 'select-template' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Wand2 size={20} className="text-blue-600" />
              选择文档模板
            </h2>
            <button
              onClick={handleBack}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              返回修改
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-6">选择一个模板，系统将自动整理文档格式并检查错别字。</p>
          <div className="grid grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => handleApplyTemplate(template)}
                className="border border-gray-200 rounded-lg p-6 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all group"
              >
                <div className={`w-full h-32 rounded-lg mb-4 flex items-center justify-center text-2xl font-bold ${
                  template.id === 'formal' ? 'bg-gray-100 text-gray-600' :
                  template.id === 'modern' ? 'bg-blue-50 text-blue-600' :
                  'bg-green-50 text-green-600'
                }`}>
                  {template.thumbnail}
                </div>
                <h3 className="font-semibold text-gray-800 group-hover:text-blue-600">{template.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{template.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 步骤3：预览结果 */}
      {step === 'preview' && (
        <div className="space-y-6">
          {isProcessing ? (
            <div className="bg-white rounded-lg shadow-sm p-12 flex flex-col items-center justify-center">
              <div className="flex items-center mb-4">
                <span className="ai-loading-dot"></span>
                <span className="ai-loading-dot"></span>
                <span className="ai-loading-dot"></span>
              </div>
              <p className="text-gray-600">AI正在处理您的文档...</p>
              <p className="text-sm text-gray-400 mt-2">检查错别字 · 整理格式 · 应用模板</p>
            </div>
          ) : (
            <>
              {/* 错别字检查结果 */}
              {processedResult && processedResult.typos.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h3 className="font-semibold text-orange-800 flex items-center gap-2 mb-3">
                    <AlertCircle size={18} />
                    发现 {processedResult.typos.length} 处错别字（已自动修正）
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {processedResult.typos.map((typo, index) => (
                      <span key={index} className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-sm">
                        <span className="text-red-500 line-through">{typo.original}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-green-600 font-medium">{typo.correct}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 格式化预览 */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Check size={20} className="text-green-600" />
                    格式化预览
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      模板：{selectedTemplate?.name}
                    </span>
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handleBack}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      更换模板
                    </button>
                  </div>
                </div>

                <div className={`border border-gray-200 rounded-lg p-8 ${selectedTemplate?.previewClass} bg-white min-h-[400px]`}>
                  {processedResult && (
                    <>
                      <div
                        className="doc-title"
                        dangerouslySetInnerHTML={{
                          __html: renderTypoHighlight(processedResult.formattedContent.title)
                        }}
                      />
                      {processedResult.formattedContent.sections.map((section, index) => (
                        <div key={index} className="mb-6">
                          {section.subtitle && (
                            <div
                              className="doc-subtitle"
                              dangerouslySetInnerHTML={{
                                __html: renderTypoHighlight(section.subtitle)
                              }}
                            />
                          )}
                          {section.body.split('\n').map((para, pIndex) => (
                            <p
                              key={pIndex}
                              className="doc-body"
                              dangerouslySetInnerHTML={{
                                __html: renderTypoHighlight(para)
                              }}
                            />
                          ))}
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setStep('input')}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    重新编辑
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Check size={16} />
                    提交文档
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step, current, completed, label }: { step: number; current: boolean; completed: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
        completed ? 'bg-green-500 text-white' :
        current ? 'bg-blue-600 text-white' :
        'bg-gray-200 text-gray-500'
      }`}>
        {completed ? <Check size={16} /> : step}
      </div>
      <span className={`text-sm ${current ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>{label}</span>
    </div>
  );
}
