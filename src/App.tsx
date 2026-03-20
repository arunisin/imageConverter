import { useEffect, useRef, useState } from 'react'
import { DropZone } from './components/DropZone'
import { FormatGrid } from './components/FormatGrid'
import { QualitySlider } from './components/QualitySlider'
import { FileRow, SizeBadge } from './components/FileRow'
import { ImageEditor } from './components/ImageEditor'
import { OUTPUT_FORMATS, isFormatSupported, type Format } from './lib/formats'
import { convertImage, runWithConcurrency } from './lib/converters'

export interface FileEntry {
  id: string
  file: File
  previewUrl: string
  status: 'idle' | 'converting' | 'done' | 'error'
  targetFormat?: Format
  resultUrl?: string
  filename?: string
  resultSize?: number
  error?: string
}

const DEFAULT_QUALITY = 92


export default function App() {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [batchMode, setBatchMode] = useState<'same' | 'individual'>('same')
  const [quality, setQuality] = useState(DEFAULT_QUALITY)
  const [supported, setSupported] = useState<Set<string>>(new Set())
  const [sameFormat, setSameFormat] = useState<Format | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Track converting state to prevent duplicate batch runs
  const convertingRef = useRef(false)

  useEffect(() => {
    Promise.all(
      OUTPUT_FORMATS.map(async (f) => ({ id: f.id, ok: await isFormatSupported(f.mime) }))
    ).then((results) => {
      setSupported(new Set(results.filter((r) => r.ok).map((r) => r.id)))
    })
  }, [])

  function addFiles(newFiles: File[]) {
    const entries: FileEntry[] = newFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'idle',
    }))
    setFiles((prev) => [...prev, ...entries])
  }

  function removeFile(id: string) {
    setFiles((prev) => {
      const entry = prev.find((e) => e.id === id)
      if (entry) {
        URL.revokeObjectURL(entry.previewUrl)
        if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl)
      }
      return prev.filter((e) => e.id !== id)
    })
  }

  function clearAll() {
    setFiles((prev) => {
      for (const e of prev) {
        URL.revokeObjectURL(e.previewUrl)
        if (e.resultUrl) URL.revokeObjectURL(e.resultUrl)
      }
      return []
    })
    setSameFormat(null)
  }

  function handleEditorSave(id: string, newUrl: string, newFilename: string) {
    setFiles(prev => prev.map(e => {
      if (e.id !== id) return e
      if (e.resultUrl) URL.revokeObjectURL(e.resultUrl)
      return { ...e, resultUrl: newUrl, filename: newFilename }
    }))
    setEditingId(null)
  }

  function updateEntry(id: string, patch: Partial<FileEntry>) {
    setFiles((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }

  // Same-mode: convert all idle/error files to the chosen format
  async function convertBatch(fmt: Format) {
    if (convertingRef.current) return
    convertingRef.current = true
    setSameFormat(fmt)

    // Mark eligible files as converting (include done so re-clicking reconverts with new quality)
    setFiles((prev) =>
      prev.map((e) =>
        e.status === 'idle' || e.status === 'error' || e.status === 'done'
          ? { ...e, status: 'converting', targetFormat: fmt }
          : e
      )
    )

    const snapshot = await new Promise<FileEntry[]>((res) =>
      setFiles((prev) => { res(prev); return prev })
    )

    const targets = snapshot.filter(
      (e) => e.status === 'converting' && e.targetFormat?.id === fmt.id
    )

    const tasks = targets.map((entry) => async () => {
      // Revoke old result
      if (entry.resultUrl) URL.revokeObjectURL(entry.resultUrl)
      try {
        const result = await convertImage(entry.file, fmt, quality)
        updateEntry(entry.id, {
          status: 'done',
          resultUrl: result.url,
          filename: result.filename,
          resultSize: result.blob.size,
          error: undefined,
        })
      } catch (err) {
        updateEntry(entry.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Conversion failed',
        })
      }
    })

    await runWithConcurrency(tasks, 4)
    convertingRef.current = false
  }

  // Individual mode: convert a single file
  async function convertSingle(id: string, fmt: Format) {
    setFiles((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e
        if (e.resultUrl) URL.revokeObjectURL(e.resultUrl)
        return { ...e, status: 'converting', targetFormat: fmt, resultUrl: undefined }
      })
    )

    const entry = files.find((e) => e.id === id)
    if (!entry) return

    try {
      const result = await convertImage(entry.file, fmt, quality)
      updateEntry(id, {
        status: 'done',
        resultUrl: result.url,
        filename: result.filename,
        resultSize: result.blob.size,
        error: undefined,
      })
    } catch (err) {
      updateEntry(id, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Conversion failed',
      })
    }
  }

  const showModeToggle = files.length > 1
  // Show quality slider whenever lossy formats are available — lets users set quality before converting
  const hasLossySupport = OUTPUT_FORMATS.some((f) => f.lossy && supported.has(f.id))
  const showQualitySlider = files.length > 0 && hasLossySupport

  // All done files in same-mode
  const doneFiles = files.filter((e) => e.status === 'done')

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">Image Converter</h1>
        <p className="app__sub">Convert images entirely in your browser — nothing is uploaded</p>
      </header>

      {files.length === 0 ? (
        <DropZone onFiles={addFiles} />
      ) : (
        <div className="workspace">
          {/* Toolbar */}
          <div className="batch-toolbar">
            <div className="batch-toolbar__left">
              {showModeToggle && (
                <div className="mode-toggle" role="group" aria-label="Conversion mode">
                  <button
                    className={['mode-btn', batchMode === 'same' ? 'mode-btn--active' : ''].join(' ')}
                    onClick={() => setBatchMode('same')}
                  >
                    Same format
                  </button>
                  <button
                    className={['mode-btn', batchMode === 'individual' ? 'mode-btn--active' : ''].join(' ')}
                    onClick={() => setBatchMode('individual')}
                  >
                    Individual
                  </button>
                </div>
              )}
            </div>
            <div className="batch-toolbar__right">
              <button className="btn btn--ghost btn--sm" onClick={() => document.getElementById('add-more-input')?.click()}>
                + Add more
              </button>
              <input
                id="add-more-input"
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const newFiles = Array.from(e.target.files ?? [])
                  if (newFiles.length > 0) addFiles(newFiles)
                  e.target.value = ''
                }}
              />
              <button className="btn btn--ghost btn--sm" onClick={clearAll}>
                Clear all
              </button>
            </div>
          </div>

          {/* Same-format mode */}
          {batchMode === 'same' && (
            <>
              {/* Thumbnail strip */}
              <div className="thumb-strip">
                {files.map((entry) => (
                  <div key={entry.id} className="thumb-item">
                    <div className="thumb-item__img-wrap">
                      <img src={entry.previewUrl} alt="" className="thumb-item__img" />
                      {entry.status === 'converting' && (
                        <div className="thumb-item__overlay">
                          <div className="spinner" aria-label="Converting…" />
                        </div>
                      )}
                      {entry.status === 'done' && entry.resultUrl && (
                        <div className="thumb-item__overlay thumb-item__overlay--done">
                          <a
                            href={entry.resultUrl}
                            download={entry.filename}
                            title={`Download ${entry.filename}`}
                            className="thumb-item__action"
                          >
                            ↓
                          </a>
                          <button
                            className="thumb-item__action"
                            title="Edit"
                            onClick={() => setEditingId(entry.id)}
                          >
                            ✏
                          </button>
                        </div>
                      )}
                      {entry.status === 'error' && (
                        <div className="thumb-item__overlay thumb-item__overlay--error" title={entry.error}>
                          !
                        </div>
                      )}
                    </div>
                    <p className="thumb-item__name">{entry.file.name}</p>
                    <button
                      className="thumb-item__remove"
                      onClick={() => removeFile(entry.id)}
                      aria-label={`Remove ${entry.file.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {showQualitySlider && (
                <QualitySlider value={quality} onChange={setQuality} selectedFormat={sameFormat} />
              )}

              <FormatGrid
                formats={OUTPUT_FORMATS}
                supported={supported}
                sourceFormat=""
                onSelect={convertBatch}
                selectedFormat={sameFormat ?? undefined}
              />

              {doneFiles.length > 0 && (
                <div className="batch-actions">
                  <p className="batch-actions__label">{doneFiles.length} file{doneFiles.length > 1 ? 's' : ''} ready</p>
                  {doneFiles.map((e) => (
                    <div key={e.id} className="batch-actions__item">
                      <a
                        href={e.resultUrl}
                        download={e.filename}
                        className="btn btn--ghost btn--sm"
                      >
                        ↓ {e.filename}
                      </a>
                      {e.resultSize != null && (
                        <SizeBadge original={e.file.size} result={e.resultSize} />
                      )}
                      <button className="btn btn--ghost btn--sm" onClick={() => setEditingId(e.id)}>Edit</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Individual mode */}
          {batchMode === 'individual' && (
            <>
              {showQualitySlider && (
                <QualitySlider value={quality} onChange={setQuality} />
              )}
              <div className="file-list">
                {files.map((entry) => (
                  <FileRow
                    key={entry.id}
                    entry={entry}
                    supported={supported}
                    onFormatSelect={convertSingle}
                    onRemove={removeFile}
                    onEdit={setEditingId}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <footer className="app-footer">
        <section className="info-section">
          <h2 className="info-section__title">Free image converter — no uploads, no account</h2>
          <p>
            Every conversion happens directly in your browser using the{' '}
            <a href="https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API" target="_blank" rel="noopener noreferrer">Canvas API</a>.
            Your images never leave your device. There is no server, no storage, no tracking.
          </p>

          <h3>Supported formats</h3>
          <ul className="info-list">
            <li><strong>JPEG</strong> — Best for photos. Lossy compression, smallest file size, no transparency.</li>
            <li><strong>PNG</strong> — Best for graphics, screenshots, and images with transparency. Lossless.</li>
            <li><strong>WebP</strong> — Modern format with 25–35% smaller files than JPEG at equal quality. Supported by all major browsers.</li>
            <li><strong>AVIF</strong> — Next-generation format based on AV1. Up to 50% smaller than JPEG. Best compression available in a browser today.</li>
            <li><strong>GIF</strong> — Limited to 256 colours. Kept for compatibility.</li>
          </ul>

          <h3>How to convert an image</h3>
          <ol className="info-list">
            <li>Drop one or more images onto the converter, or click to browse.</li>
            <li>Pick an output format. Conversion starts immediately.</li>
            <li>Adjust quality with the slider for lossy formats (JPEG, WebP, AVIF).</li>
            <li>Download each file individually, or all at once.</li>
            <li>Optionally use the <strong>Edit</strong> button to crop, annotate, or draw on the result before saving.</li>
          </ol>

          <h3>Batch conversion</h3>
          <p>
            Drop multiple images and use <strong>Same format</strong> mode to convert everything to one format in a single click.
            Switch to <strong>Individual</strong> mode to choose a different output format per image.
            Up to four conversions run in parallel so large batches finish quickly.
          </p>

          <h3>How does this compare to FFmpeg?</h3>
          <p>
            <a href="https://ffmpeg.org" target="_blank" rel="noopener noreferrer">FFmpeg</a> is the industry-standard open-source tool for
            audio, video, and image processing. It supports virtually every codec and format ever made — including RAW camera formats, HEIC/HEIF,
            TIFF, and hundreds more — and is scriptable for complex batch pipelines.
          </p>
          <p>
            This converter covers the formats most people need on the web (JPEG, PNG, WebP, AVIF) with zero installation and zero configuration.
            If you need RAW conversion, HEIC support, video frame extraction, or command-line scripting, FFmpeg is the right tool.
            For everything else, this is faster to use.
          </p>

          <h3>Privacy</h3>
          <p>
            No files are uploaded. No analytics on your images. The page can be used entirely offline after the first load.
            Source code is open and auditable.
          </p>
        </section>
      </footer>

      {editingId && (() => {
        const entry = files.find(e => e.id === editingId)
        if (!entry || !entry.resultUrl || !entry.targetFormat || !entry.filename) return null
        return (
          <ImageEditor
            resultUrl={entry.resultUrl}
            filename={entry.filename}
            format={entry.targetFormat}
            quality={quality}
            onSave={(url, name) => handleEditorSave(editingId, url, name)}
            onClose={() => setEditingId(null)}
          />
        )
      })()}
    </main>
  )
}
