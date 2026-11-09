# 전자책 메이커

PDF 파일을 올려 실제 책처럼 페이지를 넘기며 읽는 웹 전자책 뷰어예요.
파일은 브라우저 안에서만 읽히고 서버에 저장되지 않아요.

## 실행

```
npm install
npm run dev
```

## 배포

main 브랜치에 푸시하면 GitHub Actions가 GitHub Pages로 자동 배포해요.
Settings → Pages → Source: GitHub Actions 로 설정이 필요해요.

## 기능

- PDF 업로드(드래그&드롭) · 3D 책 넘김 · 두 페이지 펼침
- 확대/축소(100%~300%) · 전체화면 · 페이지 이동 · 목차(있을 때)
- 좁은 화면에서는 한 장씩 보기
