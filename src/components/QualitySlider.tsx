interface QualitySliderProps {
  value: number
  onChange: (value: number) => void
}

export function QualitySlider({ value, onChange }: QualitySliderProps) {
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
        onChange={(e) => onChange(Number(e.target.value))}
        className="quality-slider__range"
      />
      <div className="quality-slider__hints">
        <span>Smaller file</span>
        <span>Higher quality</span>
      </div>
    </div>
  )
}
