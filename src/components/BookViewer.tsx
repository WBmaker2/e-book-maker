import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { PageFlip } from 'page-flip';
import {
  PageImageCache,
  getPageSize,
  renderPageToDataUrl,
  renderScaleForZoom,
  type OutlineItem,
  type PdfDocument,
} from '../lib/pdfEngine';

interface BookViewerProps {
  doc: PdfDocument;
  pageCount: number;
  fileName: string;
  outline: OutlineItem[];
  onClose: () => void;
}

interface BookDims {
  w: number;
  h: number;
  pageW: number;
  pageH: number;
  portrait: boolean;
}

type Orientation = 'portrait' | 'landscape';

const ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5, 3];

function clampPage(n: number, total: number): number {
  return Math.min(Math.max(1, Math.round(n)), total);
}

function buildPageElements(
  pageCount: number,
  fileName: string,
): { els: HTMLElement[]; imgs: (HTMLImageElement | null)[] } {
  const els: HTMLElement[] = [];
  const imgs: (HTMLImageElement | null)[] = [];
  for (let i = 0; i <= pageCount + 1; i += 1) {
    const el = document.createElement('div');
    if (i === 0) {
      el.className = 'book-page book-page-cover';
      const inner = document.createElement('div');
      inner.className = 'cover-inner';
      const title = document.createElement('p');
      title.className = 'cover-title';
      title.textContent = '전자책';
      const sub = document.createElement('p');
      sub.className = 'cover-sub';
      sub.textContent = fileName;
      inner.append(title, sub);
      el.appendChild(inner);
      imgs.push(null);
    } else if (i === pageCount + 1) {
      el.className = 'book-page book-page-back';
      const inner = document.createElement('div');
      inner.className = 'cover-inner';
      const sub = document.createElement('p');
      sub.className = 'cover-sub';
      sub.textContent = `${pageCount}쪽 · ${fileName}`;
      inner.appendChild(sub);
      el.appendChild(inner);
      imgs.push(null);
    } else {
      el.className = 'book-page book-page-content';
      const frame = document.createElement('div');
      frame.className = 'page-frame';
      const img = document.createElement('img');
      img.className = 'page-img';
      img.alt = `${i}쪽`;
      img.draggable = false;
      const loader = document.createElement('div');
      loader.className = 'page-loader';
      const num = document.createElement('span');
      num.className = 'page-num';
      num.textContent = String(i);
      loader.appendChild(num);
      frame.append(img, loader);
      el.appendChild(frame);
      imgs.push(img);
    }
    els.push(el);
  }
  return { els, imgs };
}

export default function BookViewer({ doc, pageCount, fileName, outline, onClose }: BookViewerProps) {
  const viewerRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hostWrapRef = useRef<HTMLDivElement | null>(null);

  const flipRef = useRef<PageFlip | null>(null);
  const imgsRef = useRef<(HTMLImageElement | null)[]>([]);
  const cacheRef = useRef(new PageImageCache(40));
  const queueRef = useRef<number[]>([]);
  const processingRef = useRef(false);
  const cancelledRef = useRef(false);
  const currentIndexRef = useRef(0);
  const zoomRef = useRef(1);
  const pageCountRef = useRef(pageCount);
  useEffect(() => {
    pageCountRef.current = pageCount;
  });
  const aspectRef = useRef({ width: 595, height: 842 });
  const dimsRef = useRef<BookDims | null>(null);
  const skipZoomEffectRef = useRef(true);

  const [bookDims, setBookDims] = useState<BookDims | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [orientation, setOrientation] = useState<Orientation>('landscape');
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pageInput, setPageInput] = useState('');

  const applyRendered = useCallback((flipIndex: number, url: string) => {
    const img = imgsRef.current[flipIndex];
    if (!img) return;
    const preload = new Image();
    preload.onload = () => {
      if (cancelledRef.current) return;
      img.src = url;
      img.classList.add('page-img-loaded');
      img.closest('.page-frame')?.classList.add('page-loaded');
    };
    preload.src = url;
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (!cancelledRef.current && queueRef.current.length > 0) {
        const flipIndex = queueRef.current.shift();
        if (flipIndex === undefined) break;
        if (flipIndex < 1 || flipIndex > pageCountRef.current) continue;
        let url = cacheRef.current.get(flipIndex);
        if (!url) {
          try {
            url = await renderPageToDataUrl(doc, flipIndex, renderScaleForZoom(zoomRef.current));
          } catch {
            continue;
          }
          if (cancelledRef.current) return;
          cacheRef.current.set(flipIndex, url);
        }
        applyRendered(flipIndex, url);
      }
    } finally {
      processingRef.current = false;
    }
  }, [applyRendered, doc]);

  const enqueueAround = useCallback(
    (center: number) => {
      const total = pageCountRef.current;
      const candidates: number[] = [];
      for (let i = center - 4; i <= center + 4; i += 1) {
        if (i >= 1 && i <= total) candidates.push(i);
      }
      candidates.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
      for (const c of candidates) {
        if (!cacheRef.current.has(c) && !queueRef.current.includes(c)) {
          queueRef.current.push(c);
        }
      }
      void processQueue();
    },
    [processQueue],
  );

  const computeDims = useCallback((): BookDims => {
    const stage = stageRef.current;
    const stageW = stage?.clientWidth ?? 800;
    const stageH = stage?.clientHeight ?? 600;
    const ratio = aspectRef.current.height / Math.max(1, aspectRef.current.width);
    const pad = 64;
    const availW = Math.max(120, stageW - pad);
    const availH = Math.max(120, stageH - pad);
    const byHeight = availH / ratio;
    let pageW: number;
    let portrait: boolean;
    if (availW < 2 * byHeight) {
      portrait = true;
      pageW = Math.min(availW, byHeight);
    } else {
      portrait = false;
      pageW = Math.min(availW / 2, byHeight);
    }
    const safePageW = Math.max(40, Math.round(pageW));
    const safePageH = Math.max(40, Math.round(safePageW * ratio));
    return {
      w: portrait ? safePageW : safePageW * 2,
      h: safePageH,
      pageW: safePageW,
      pageH: safePageH,
      portrait,
    };
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    const host = hostWrapRef.current;
    const cache = cacheRef.current;
    const queue = queueRef.current;
    if (!host) return;
    let flip: PageFlip | null = null;
    let cancelledLocal = false;
    let resizeTimer: number | null = null;

    const start = (preserveIndex: number) => {
      if (flip) {
        try {
          flip.destroy();
        } catch {
          flip = null;
        }
        flip = null;
      }
      host.innerHTML = '';
      cache.clear();
      queue.length = 0;
      const dims = computeDims();
      dimsRef.current = dims;
      setBookDims(dims);
      setOrientation(dims.portrait ? 'portrait' : 'landscape');
      const { els, imgs } = buildPageElements(pageCountRef.current, fileName);
      imgsRef.current = imgs;
      const el = document.createElement('div');
      host.appendChild(el);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      flip = new PageFlip(el, {
        startPage: preserveIndex,
        size: 'fixed',
        width: dims.pageW,
        height: dims.pageH,
        usePortrait: true,
        showCover: true,
        drawShadow: true,
        flippingTime: reduced ? 1 : 800,
        maxShadowOpacity: 0.5,
        mobileScrollSupport: false,
      });
      flipRef.current = flip;
      flip.on('flip', (e) => {
        const idx = typeof e.data === 'number' ? e.data : preserveIndex;
        currentIndexRef.current = idx;
        setCurrentIndex(idx);
        enqueueAround(idx);
      });
      flip.on('changeOrientation', (e) => {
        if (e.data === 'portrait' || e.data === 'landscape') {
          setOrientation(e.data);
        }
      });
      flip.loadFromHTML(els);
      currentIndexRef.current = preserveIndex;
      setCurrentIndex(preserveIndex);
      enqueueAround(preserveIndex);
    };

    const run = async () => {
      try {
        aspectRef.current = await getPageSize(doc, 1);
      } catch {
        aspectRef.current = { width: 595, height: 842 };
      }
      if (cancelledLocal) return;
      start(0);
    };
    void run();

    const onResize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (cancelledLocal) return;
        const next = computeDims();
        const prev = dimsRef.current;
        if (!prev || next.w !== prev.w || next.h !== prev.h) {
          start(currentIndexRef.current);
        }
      }, 200);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelledLocal = true;
      cancelledRef.current = true;
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      if (flip) {
        try {
          flip.destroy();
        } catch {
          flip = null;
        }
        flip = null;
      }
      flipRef.current = null;
      cache.clear();
      queue.length = 0;
      host.innerHTML = '';
    };
  }, [computeDims, doc, enqueueAround, fileName]);

  useEffect(() => {
    zoomRef.current = zoom;
    if (skipZoomEffectRef.current) {
      skipZoomEffectRef.current = false;
      return;
    }
    cacheRef.current.clear();
    enqueueAround(currentIndexRef.current);
  }, [zoom, enqueueAround]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const goNext = useCallback(() => {
    const flip = flipRef.current;
    if (!flip) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) flip.turnToNextPage();
    else flip.flipNext('top');
  }, []);

  const goPrev = useCallback(() => {
    const flip = flipRef.current;
    if (!flip) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) flip.turnToPrevPage();
    else flip.flipPrev('top');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  const zoomIn = useCallback(() => {
    setZoom((z) => ZOOM_STEPS.find((s) => s > z + 0.001) ?? z);
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => [...ZOOM_STEPS].reverse().find((s) => s < z - 0.001) ?? z);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const root = viewerRef.current;
    if (!root) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch {
      return;
    }
  }, []);

  const submitJump = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(pageInput);
    const flip = flipRef.current;
    if (!flip || !Number.isFinite(n)) return;
    flip.turnToPage(clampPage(n, pageCount));
    setPageInput('');
  };

  const flatOutline = useMemo(() => {
    const flat: { title: string; page: number | null; depth: number }[] = [];
    const walk = (items: OutlineItem[], depth: number) => {
      for (const item of items) {
        flat.push({ title: item.title, page: item.page, depth });
        walk(item.items, depth + 1);
      }
    };
    walk(outline, 0);
    return flat.slice(0, 100);
  }, [outline]);

  const totalFlipPages = pageCount + 2;
  let indicator: string;
  if (currentIndex <= 0) {
    indicator = `표지 · 1/${pageCount}쪽`;
  } else if (currentIndex >= totalFlipPages - 1) {
    indicator = `뒷표지 · ${pageCount}/${pageCount}쪽`;
  } else if (orientation === 'portrait') {
    indicator = `${currentIndex}쪽 / ${pageCount}쪽`;
  } else {
    const left = currentIndex;
    const right = Math.min(currentIndex + 1, pageCount);
    indicator = left === right ? `${left}쪽 / ${pageCount}쪽` : `${left}–${right}쪽 / ${pageCount}쪽`;
  }
  const progress =
    currentIndex <= 0
      ? 0
      : currentIndex >= totalFlipPages - 1
        ? 1
        : Math.min(Math.max((currentIndex + (orientation === 'landscape' ? 1 : 0)) / pageCount, 0), 1);

  return (
    <section className="viewer" ref={viewerRef} aria-label="전자책 보기">
      <header className="viewer-topbar">
        <div className="viewer-title">
          <span className="viewer-filename">{fileName}</span>
          <span className="viewer-indicator">{indicator}</span>
        </div>
        <div className="viewer-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label="이전 페이지"
            title="이전 페이지 (←)"
            onClick={goPrev}
            disabled={currentIndex <= 0}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="다음 페이지"
            title="다음 페이지 (→)"
            onClick={goNext}
            disabled={currentIndex >= totalFlipPages - 1}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="viewer-divider" aria-hidden="true" />
          <button
            type="button"
            className="icon-btn"
            aria-label="축소"
            title="축소"
            onClick={zoomOut}
            disabled={zoom <= 1}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="zoom-label"
            aria-label="확대율 초기화"
            title="확대율 초기화"
            onClick={() => setZoom(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="확대"
            title="확대"
            onClick={zoomIn}
            disabled={zoom >= 3}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8h10M8 3v10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={isFullscreen ? '전체화면 종료' : '전체화면'}
            title={isFullscreen ? '전체화면 종료' : '전체화면'}
            onClick={() => void toggleFullscreen()}
          >
            {isFullscreen ? (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5.5 2H2v3.5M10.5 2H14v3.5M5.5 14H2V10.5M10.5 14H14V10.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M9 2h5v5M14 2 9.5 6.5M7 14H2V9M2 14l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <span className="viewer-divider" aria-hidden="true" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            새 PDF 열기
          </button>
        </div>
      </header>

      <div className="stage" ref={stageRef}>
        {bookDims === null && <p className="stage-loading">책을 펼치는 중…</p>}
        <div
          className="scale-space"
          style={{ width: (bookDims?.w ?? 100) * zoom, height: (bookDims?.h ?? 100) * zoom }}
        >
          <div
            className="book-scale"
            style={{ width: bookDims?.w ?? 100, height: bookDims?.h ?? 100, transform: `scale(${zoom})` }}
          >
            <div className="book-host" ref={hostWrapRef} />
          </div>
        </div>
      </div>

      <footer className="viewer-bottom">
        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="viewer-bottom-row">
          {flatOutline.length > 0 && (
            <details className="toc">
              <summary className="toc-summary">목차 {flatOutline.length}개</summary>
              <div className="toc-panel" role="list">
                {flatOutline.map((item, i) => (
                  <button
                    key={`${item.title}-${i}`}
                    type="button"
                    className="toc-item"
                    style={{ paddingLeft: `${12 + item.depth * 16}px` }}
                    disabled={item.page === null}
                    onClick={() => {
                      if (item.page) flipRef.current?.turnToPage(item.page);
                    }}
                  >
                    {item.title || `제목 없음`}{item.page ? ` · ${item.page}쪽` : ''}
                  </button>
                ))}
              </div>
            </details>
          )}
          <form className="page-jump" onSubmit={submitJump}>
            <label htmlFor="page-jump-input">페이지</label>
            <input
              id="page-jump-input"
              type="number"
              min={1}
              max={pageCount}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              inputMode="numeric"
            />
            <span>/ {pageCount}쪽</span>
            <button type="submit" className="btn btn-secondary btn-sm">
              이동
            </button>
          </form>
          <p className="viewer-hint">좌우 화살표 키나 드래그로 넘겨요</p>
        </div>
      </footer>
    </section>
  );
}
