import type { Format } from '../lib/formats'

interface QualitySliderProps {
  value: number
  onChange: (value: number) => void
  selectedFormat?: Format | null
}

export function QualitySlider({ value, onChange, selectedFormat }: QualitySliderProps) {
  const isLossless = selectedFormat != null && !selectedFormat.lossy
  return (
    <div className="quality-slider">
      <div className="quality-slider__header">
        <label htmlFor="quality-input" className="quality-slider__label">Quality</label>
        <span className="quality-slider__value">{value}</span>
      </div>
      <input
        id="quality-input"
        type="range"
        min={1}
        max={100}
        value={value}
        disabled={isLossless}
        onChange={(e) => onChange(Number(e.target.value))}
        className="quality-slider__range"
      />
      <div className="quality-slider__hints">
        {isLossless
          ? <span className="quality-slider__note">{selectedFormat.label} is lossless — quality slider has no effect</span>
          : (<><span>Smaller file</span><span>Higher quality</span></>)
        }
      </div>
    </div>
  )
}
