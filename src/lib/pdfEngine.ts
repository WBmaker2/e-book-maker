import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export type PdfDocument = pdfjsLib.PDFDocumentProxy;

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export function validatePdfFile(file: File): string | null {
  const isPdfType = file.type === 'application/pdf' || file.type === '';
  const hasPdfExt = file.name.toLowerCase().endsWith('.pdf');
  if (!isPdfType || !hasPdfExt) return 'PDF 파일만 올릴 수 있어요.';
  if (file.size === 0) return '파일 내용이 비어 있어요.';
  if (file.size > MAX_FILE_SIZE_BYTES) return '파일이 100MB보다 커요. 더 작은 PDF를 올려주세요.';
  return null;
}

export async function loadPdf(buffer: ArrayBuffer): Promise<PdfDocument> {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  return loadingTask.promise;
}

export function toFriendlyError(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  if (name === 'PasswordException') return '암호가 있는 PDF는 열 수 없어요.';
  if (name === 'InvalidPDFException') return 'PDF 파일이 손상되었거나 열 수 없어요.';
  if (name === 'AbortException') return '열기를 취소했어요.';
  return 'PDF를 열 수 없어요. 다른 PDF로 시도해주세요.';
}

export interface PageSize {
  width: number;
  height: number;
}

export async function getPageSize(doc: PdfDocument, pageNumber: number): Promise<PageSize> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  page.cleanup();
  return { width: viewport.width, height: viewport.height };
}

export async function renderPageToDataUrl(
  doc: PdfDocument,
  pageNumber: number,
  scale: number,
): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  await page.render({ canvas, viewport, background: '#ffffff' }).promise;
  page.cleanup();
  return canvas.toDataURL('image/jpeg', 0.9);
}

export function renderScaleForZoom(zoom: number): number {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return Math.min(Math.max(1.5 * zoom * dpr, 1.5), 4);
}

export interface OutlineItem {
  title: string;
  page: number | null;
  items: OutlineItem[];
}

interface RawOutlineItem {
  title?: string;
  dest?: unknown;
  items?: RawOutlineItem[];
}

export async function getOutline(doc: PdfDocument): Promise<OutlineItem[]> {
  const outline = (await doc.getOutline()) as RawOutlineItem[] | null;
  if (!outline || outline.length === 0) return [];
  const walk = async (items: RawOutlineItem[]): Promise<OutlineItem[]> => {
    const result: OutlineItem[] = [];
    for (const item of items) {
      let page: number | null = null;
      if (item.dest !== undefined && item.dest !== null) {
        try {
          const dest = (await doc.getDestination(String(item.dest))) ?? item.dest;
          if (Array.isArray(dest) && dest.length > 0) {
            const ref = dest[0];
            if (ref !== null && typeof ref === 'object' && 'num' in ref) {
              page = (await doc.getPageIndex(ref as { num: number; gen: number })) + 1;
            }
          }
        } catch {
          page = null;
        }
      }
      result.push({
        title: item.title ?? '',
        page,
        items: item.items ? await walk(item.items) : [],
      });
    }
    return result;
  };
  return walk(outline);
}

export class PageImageCache {
  private entries = new Map<number, string>();
  private capacity: number;

  constructor(capacity = 40) {
    this.capacity = capacity;
  }

  get(page: number): string | null {
    const url = this.entries.get(page);
    if (url !== undefined) {
      this.entries.delete(page);
      this.entries.set(page, url);
    }
    return url ?? null;
  }

  has(page: number): boolean {
    return this.entries.has(page);
  }

  set(page: number, url: string): void {
    if (this.entries.has(page)) this.entries.delete(page);
    this.entries.set(page, url);
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
  }
}
