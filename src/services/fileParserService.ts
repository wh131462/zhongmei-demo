import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';

// 配置 PDF.js worker（使用本地文件）
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export type ParseResult = {
  success: boolean;
  content: string;
  error?: string;
};

/**
 * 解析 DOCX 文件
 */
export async function parseDocx(file: File): Promise<ParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return {
      success: true,
      content: result.value.trim(),
    };
  } catch (e) {
    return {
      success: false,
      content: '',
      error: `DOCX 解析失败: ${e instanceof Error ? e.message : '未知错误'}`,
    };
  }
}

/**
 * 解析 PDF 文件
 */
export async function parsePdf(file: File): Promise<ParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      textParts.push(pageText);
    }

    return {
      success: true,
      content: textParts.join('\n\n').trim(),
    };
  } catch (e) {
    return {
      success: false,
      content: '',
      error: `PDF 解析失败: ${e instanceof Error ? e.message : '未知错误'}`,
    };
  }
}

/**
 * 解析 PPTX 文件 (OpenXML 格式)
 */
export async function parsePptx(file: File): Promise<ParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const textParts: string[] = [];

    // PPTX 幻灯片存储在 ppt/slides/slide*.xml 中
    const slideFiles = Object.keys(zip.files)
      .filter((name) => name.match(/^ppt\/slides\/slide\d+\.xml$/))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0');
        const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0');
        return numA - numB;
      });

    for (const slideFile of slideFiles) {
      const xmlContent = await zip.files[slideFile].async('string');
      // 提取 <a:t> 标签中的文本（PowerPoint 文本内容）
      const textMatches = xmlContent.match(/<a:t>([^<]*)<\/a:t>/g);
      if (textMatches) {
        const slideText = textMatches
          .map((match) => match.replace(/<\/?a:t>/g, ''))
          .filter((text) => text.trim())
          .join(' ');
        if (slideText.trim()) {
          textParts.push(slideText);
        }
      }
    }

    return {
      success: true,
      content: textParts.join('\n\n').trim(),
    };
  } catch (e) {
    return {
      success: false,
      content: '',
      error: `PPTX 解析失败: ${e instanceof Error ? e.message : '未知错误'}`,
    };
  }
}

/**
 * 解析 PPT 文件 (旧版二进制格式)
 * 注意：浏览器端无法解析旧版 PPT 格式，建议用户转换为 PPTX
 */
export async function parsePpt(_file: File): Promise<ParseResult> {
  return {
    success: false,
    content: '',
    error: '旧版 PPT 格式（.ppt）暂不支持，请将文件另存为 .pptx 格式后重新上传',
  };
}

/**
 * 根据文件类型自动选择解析器
 */
export async function parseFile(file: File): Promise<ParseResult> {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type;

  if (
    fileName.endsWith('.docx') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return parseDocx(file);
  }

  if (fileName.endsWith('.pdf') || mimeType === 'application/pdf') {
    return parsePdf(file);
  }

  if (
    fileName.endsWith('.pptx') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return parsePptx(file);
  }

  if (fileName.endsWith('.ppt') || mimeType === 'application/vnd.ms-powerpoint') {
    return parsePpt(file);
  }

  return {
    success: false,
    content: '',
    error: `不支持的文件格式: ${fileName}`,
  };
}
