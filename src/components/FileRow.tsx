import type { FileEntry } from '../App'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
import { FormatGrid } from './FormatGrid'
import { OUTPUT_FORMATS, type Format } from '../lib/formats'

interface FileRowProps {
  entry: FileEntry
  supported: Set<string>
  onFormatSelect: (id: string, format: Format) => void
  onRemove: (id: string) => void
  onEdit: (id: string) => void
}

export function FileRow({ entry, supported, onFormatSelect, onRemove, onEdit }: FileRowProps) {
  return (
    <div className="file-row">
      <div className="file-row__header">
        <img src={entry.previewUrl} alt="" className="file-row__thumb" />
        <span className="file-row__name">{entry.file.name}</span>
        <button
          className="file-row__remove"
          onClick={() => onRemove(entry.id)}
          aria-label={`Remove ${entry.file.name}`}
          title="Remove"
        >
          ×
        </button>
      </div>

      <FormatGrid
        formats={OUTPUT_FORMATS}
        supported={supported}
        sourceFormat={entry.file.type}
        onSelect={(fmt) => onFormatSelect(entry.id, fmt)}
        selectedFormat={entry.targetFormat}
        disabled={entry.status === 'converting'}
      />

      <div className="file-row__status">
        {entry.status === 'converting' && (
          <div className="converting">
            <div className="spinner" aria-label="Converting…" />
            <p>Converting…</p>
          </div>
        )}
        {entry.status === 'done' && entry.resultUrl && (
          <div className="file-row__done">
            <a
              href={entry.resultUrl}
              download={entry.filename}
              className="btn btn--primary btn--sm"
            >
              ↓ {entry.filename}
            </a>
            {entry.resultSize != null && (
              <span className="file-row__size">{formatBytes(entry.resultSize)}</span>
            )}
            <button className="btn btn--ghost btn--sm" onClick={() => onEdit(entry.id)}>Edit</button>
          </div>
        )}
        {entry.status === 'error' && (
          <p className="file-row__error">{entry.error}</p>
        )}
      </div>
    </div>
  )
}
