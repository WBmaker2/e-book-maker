# 전자책 메이커 — 구현계획

- 상태: 승인됨 (2026-11-09)
- 결정: PDF 업로드 → 실제 책처럼 넘기는 웹 전자책 뷰어

## 1. 확정된 요구사항

| 항목 | 결정 |
|---|---|
| PDF 처리 | 브라우저만 (클라이언트 전용, 서버 없음) |
| 책 넘기기 | 3D 책 넘김 + 두 페이지 펼침 (모바일은 한 장) |
| 부가 기능 | 확대/축소, 전체화면 |
| 배포 | GitHub Pages (정적) |

제외(후속 확장): 목차/검색, 썸네일/북마크, 텍스트 복사, 서버 저장·공유 링크.

## 2. 기술 스택

- Vite + React + TypeScript
- pdfjs-dist (PDF.js) — PDF 렌더링
- page-flip (StPageFlip) — 3D 책 넘김
- GitHub Actions → GitHub Pages

## 3. 아키텍처

```
PDF 업로드 → ArrayBuffer → PDF.js 파싱
→ 현재 펼침 ± N 페이지만 고해상도 렌더링 (지연 로딩 + LRU 캐시)
→ page-flip 책 뷰어로 이미지 전달
→ 넘김 / 확대 / 전체화면
```

전 페이지 일괄 렌더링 금지. PDF.js 워커는 CDN이 아닌 번들에 포함해 Pages 배포에서 CORS 문제 방지.
렌더링 배율은 devicePixelRatio 기준 2배, 줌 100%~300%.

## 4. 구현 단계

1. Vite 프로젝트 스캐폴딩, GitHub Pages용 base 경로 + Actions 워크플로
2. PDF 업로드 랜딩 (드래그&드롭, 다음 단계 버튼 `btn-pulse`, 업데이트 내역 버튼+모달)
3. PDF 렌더링 엔진 (`src/lib/pdfEngine.ts`) — 지연 렌더링/캐시/목차 데이터 확보
4. 3D 책 뷰어 (`src/components/BookViewer.tsx`) — 표지 + 펼침, 키보드/스와이프, 좁은 화면 한 장 모드
5. 조작 UI — 확대/축소, 전체화면, 페이지 번호/이동, 진행 바
6. 배포 & 검증 — 빌드/lint/typecheck, 샘플 PDF 테스트, ego-browser 화면 확인

## 5. 검증 방법

- `npm run build`, lint, typecheck 통과
- 샘플 PDF 3종: 텍스트형 / 스캔형 / 300페이지 대형
- ego-browser로 실제 화면 테스트 (Chrome/headless 금지)

## 6. 리스크

| 리스크 | 대응 |
|---|---|
| page-flip + React 19 충돌 가능 | React 18 고정 또는 ref 기반 격리 |
| 대형 PDF 메모리 부족 | 지연 렌더링 + 캐시 제한 + 크기 경고 |
| 이미지 방식이라 텍스트 선택 불가 | 이번 범위 제외, 후속 확장 시 텍스트 레이어 검토 |
| 스캔 PDF 검색 불가 | 렌더링은 가능, 안내 표시 |

## 7. 파일 구조

```
e-book-maker/
├── src/
│   ├── components/  (UploadLanding, BookViewer, UpdateLogModal)
│   ├── lib/         (pdfEngine.ts)
│   └── App.tsx
├── docs/UPDATELOG.md
└── .github/workflows/deploy.yml
```
