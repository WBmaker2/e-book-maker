import { useEffect } from 'react';
import updateLogRaw from '../../docs/UPDATELOG.md?raw';

interface LogEntry {
  date: string;
  items: string[];
}

function parseUpdateLog(raw: string): LogEntry[] {
  const entries: LogEntry[] = [];
  let current: LogEntry | null = null;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      current = { date: trimmed.slice(3).trim(), items: [] };
      entries.push(current);
      continue;
    }
    if (!current) continue;
    if (trimmed.startsWith('- ')) {
      current.items.push(trimmed.slice(2).trim());
      continue;
    }
    if (trimmed && !trimmed.startsWith('#')) {
      current.items.push(trimmed);
    }
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

interface UpdateLogModalProps {
  open: boolean;
  onClose: () => void;
}

export default function UpdateLogModal({ open, onClose }: UpdateLogModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const entries = parseUpdateLog(updateLogRaw);
  const firstDate = entries[0]?.date;
  const lastDate = entries[entries.length - 1]?.date;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="업데이트 내역"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>업데이트 내역</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            닫기
          </button>
        </div>
        {entries.length > 0 && (
          <p className="modal-summary">
            {firstDate} 처음 제작 · 총 {entries.length}일의 기록
            {lastDate && lastDate !== firstDate ? ` · 마지막 수정 ${lastDate}` : ''}
          </p>
        )}
        <div className="modal-body">
          {entries.length === 0 ? (
            <p className="modal-empty">아직 기록이 없어요.</p>
          ) : (
            entries.map((entry) => (
              <section key={entry.date} className="log-entry">
                <h3>{entry.date}</h3>
                <ul>
                  {entry.items.map((item, i) => (
                    <li key={`${entry.date}-${i}`}>{item}</li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
