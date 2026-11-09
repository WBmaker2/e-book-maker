import { useRef, useState } from 'react';
import UpdateLogModal from './UpdateLogModal';

interface UploadLandingProps {
  error: string | null;
  loading: boolean;
  onFile: (file: File) => void;
}

export default function UploadLanding({ error, loading, onFile }: UploadLandingProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <main className="landing">
      <section className="book-card">
        <div className="book-spine" aria-hidden="true" />
        <div className="book-card-body">
          <p className="book-kicker">PDF 전자책 읽기</p>
          <h1>PDF를 올려 책처럼 읽어요</h1>
          <p className="book-desc">
            PDF 파일을 올려 실제 책처럼 페이지를 넘기며 읽을 수 있어요.
            올린 파일은 브라우저 안에서만 읽히고 어디에도 저장되지 않아요.
          </p>

          <div
            className={`dropzone${dragOver ? ' dropzone-active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (!loading) pick(e.dataTransfer.files);
            }}
          >
            <p className="dropzone-title">{dragOver ? '여기에 놓으면 열려요' : 'PDF를 여기에 드롭하세요'}</p>
            <p className="dropzone-sub">또는 아래 버튼으로 파일을 선택하세요. 100MB 이하 PDF만 가능해요.</p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            hidden
            aria-label="PDF 파일 선택"
            onChange={(e) => {
              pick(e.target.files);
              e.target.value = '';
            }}
          />

          <div className="landing-actions">
            <button
              type="button"
              className="btn btn-primary btn-pulse btn-lg"
              disabled={loading}
              onClick={() => inputRef.current?.click()}
            >
              {loading ? 'PDF 여는 중…' : 'PDF 선택'}
            </button>
            <button type="button" className="btn btn-outline btn-lg" onClick={() => setLogOpen(true)}>
              업데이트 내역
            </button>
          </div>

          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}

          <p className="book-footnote">페이지를 넘기고, 글자를 키우거나 줄이고, 크게 볼 수 있어요.</p>
        </div>
      </section>

      <UpdateLogModal open={logOpen} onClose={() => setLogOpen(false)} />
    </main>
  );
}
