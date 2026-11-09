import { useCallback, useEffect, useState } from 'react';
import BookViewer from './components/BookViewer';
import UploadLanding from './components/UploadLanding';
import {
  getOutline,
  loadPdf,
  toFriendlyError,
  validatePdfFile,
  type OutlineItem,
  type PdfDocument,
} from './lib/pdfEngine';

type Phase = 'landing' | 'loading' | 'viewer';

export default function App() {
  const [phase, setPhase] = useState<Phase>('landing');
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      void doc?.cleanup();
    };
  }, [doc]);

  const reset = useCallback(() => {
    setDoc(null);
    setPageCount(0);
    setOutline([]);
    setFileName('');
    setError(null);
    setPhase('landing');
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (phase === 'loading') return;
      setError(null);
      const validationError = validatePdfFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setPhase('loading');
      try {
        const buffer = await file.arrayBuffer();
        const loaded = await loadPdf(buffer);
        let extracted: OutlineItem[] = [];
        try {
          extracted = await getOutline(loaded);
        } catch {
          extracted = [];
        }
        setDoc(loaded);
        setPageCount(loaded.numPages);
        setFileName(file.name);
        setOutline(extracted);
        setPhase('viewer');
      } catch (err) {
        setError(toFriendlyError(err));
        setPhase('landing');
      }
    },
    [phase],
  );

  if (phase === 'viewer' && doc) {
    return (
      <BookViewer
        doc={doc}
        pageCount={pageCount}
        fileName={fileName}
        outline={outline}
        onClose={reset}
      />
    );
  }

  return (
    <UploadLanding
      error={error}
      loading={phase === 'loading'}
      onFile={(file) => void handleFile(file)}
    />
  );
}
