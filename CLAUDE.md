# Converter — Claude Code Guide

## Commands

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # TypeScript check + production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Architecture

Client-side image converter — all processing happens in the browser, no backend.

### Stack
- **React 19** + **TypeScript** + **Vite 8**
- **Tailwind CSS v4** (via `@tailwindcss/vite`)
- **Canvas API** for image conversion (JPEG, PNG, WebP, AVIF, GIF)
- React Compiler enabled via babel plugin

### Key Files

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Root component, state machine: `idle → uploaded → converting → done` |
| `src/components/DropZone.tsx` | Drag-and-drop + click-to-upload file input |
| `src/components/FormatGrid.tsx` | Output format selection cards |
| `src/components/ConversionResult.tsx` | Download button + start-over controls |
| `src/lib/formats.ts` | Format definitions (MIME, extension, Canvas support) |
| `src/lib/converters.ts` | Canvas-based conversion logic |

### Conversion Strategy
1. **Canvas API** handles common formats: JPEG, PNG, WebP, AVIF output
2. Input: any image the browser can decode (JPEG, PNG, WebP, GIF, AVIF, BMP, ICO, SVG, etc.)
3. Output formats limited to what `canvas.toBlob()` supports in modern browsers

### State Flow
```
idle → (file drop/pick) → uploaded → (format click) → converting → done
                                                                   ↓
                                              (convert another / start over)
```

### Design Tokens (CSS vars in index.css)
- `--accent`: purple `#aa3bff` (light) / `#c084fc` (dark)
- `--bg`, `--text`, `--border`, `--text-h`
