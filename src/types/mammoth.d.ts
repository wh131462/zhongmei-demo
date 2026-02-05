declare module 'mammoth' {
  interface ConversionResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  interface Options {
    arrayBuffer: ArrayBuffer;
  }

  export function extractRawText(options: Options): Promise<ConversionResult>;
  export function convertToHtml(options: Options): Promise<ConversionResult>;
}
