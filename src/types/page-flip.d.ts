declare module 'page-flip' {
  export type FlipCorner = 'top' | 'bottom';

  export interface PageFlipSettings {
    startPage?: number;
    size?: 'fixed' | 'stretch';
    width?: number;
    height?: number;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    drawShadow?: boolean;
    flippingTime?: number;
    usePortrait?: boolean;
    startZIndex?: number;
    autoSize?: boolean;
    maxShadowOpacity?: number;
    showCover?: boolean;
    mobileScrollSupport?: boolean;
    swipeDistance?: number;
    clickEventForward?: boolean;
    useMouseEvents?: boolean;
    showPageCorners?: boolean;
    disableFlipByClick?: boolean;
  }

  export interface BoundsRect {
    left: number;
    top: number;
    width: number;
    height: number;
    pageWidth: number;
  }

  export interface PageFlipEvent {
    data: unknown;
    object: PageFlip;
  }

  export type PageFlipEventHandler = (e: PageFlipEvent) => void;

  export class PageFlip {
    constructor(inBlock: HTMLElement, setting: PageFlipSettings);
    destroy(): void;
    loadFromHTML(items: HTMLElement[]): void;
    flipNext(corner?: FlipCorner): void;
    flipPrev(corner?: FlipCorner): void;
    flip(page: number, corner?: FlipCorner): void;
    turnToPage(page: number): void;
    turnToNextPage(): void;
    turnToPrevPage(): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    getBoundsRect(): BoundsRect;
    getOrientation(): string;
    on(event: string, handler: PageFlipEventHandler): PageFlip;
    off(event: string): void;
  }
}
