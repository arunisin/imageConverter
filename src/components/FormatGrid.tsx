import type { Format } from '../lib/formats'

interface FormatGridProps {
  formats: Format[]
  supported: Set<string>
  sourceFormat: string
  onSelect: (format: Format) => void
  selectedFormat?: Format
  disabled?: boolean
}

export function FormatGrid({ formats, supported, sourceFormat, onSelect, selectedFormat, disabled }: FormatGridProps) {
  return (
    <div className="format-grid__wrapper">
      <p className="format-grid__label">Convert to…</p>
      <div className="format-grid">
        {formats.map((fmt) => {
          const isSame = fmt.mime === sourceFormat
          const isSupported = supported.has(fmt.id)
          const isSelected = selectedFormat?.id === fmt.id
          const isDisabled = disabled || isSame || !isSupported

          return (
            <button
              key={fmt.id}
              className={[
                'format-card',
                isDisabled ? 'format-card--disabled' : '',
                isSelected ? 'format-card--selected' : '',
              ].join(' ')}
              onClick={() => !isDisabled && onSelect(fmt)}
              disabled={isDisabled}
              title={
                isSame ? 'Same as source format'
                : !isSupported ? 'Not supported in this browser'
                : `Convert to ${fmt.label}`
              }
            >
              <span className="format-card__ext">.{fmt.ext}</span>
              <span className="format-card__label">{fmt.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
