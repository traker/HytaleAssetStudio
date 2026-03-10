import { useState } from 'react'
import { hasApi } from '../../api'

type PathInputProps = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** 'folder' → directory picker, 'zip' → .zip file picker */
  sourceType?: 'folder' | 'zip'
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
}

/**
 * Text input with a "Browse…" button that opens a native OS file/folder dialog
 * via the local backend (tkinter). Returns the full absolute path.
 * This component is for local use only — never expose the app to the internet.
 */
export function PathInput({ value, onChange, placeholder, sourceType = 'folder', disabled, className, style, onKeyDown }: PathInputProps) {
  const [browsing, setBrowsing] = useState(false)

  async function handleBrowse(): Promise<void> {
    setBrowsing(true)
    try {
      const mode = sourceType === 'zip' ? 'file' : 'folder'
      const filter = sourceType === 'zip' ? 'zip' : undefined
      const res = await hasApi.browseDialog(mode, filter)
      if (res.path) onChange(res.path)
    } catch {
      // dialog failed or cancelled — ignore
    } finally {
      setBrowsing(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', ...style }}>
      <input
        className={className ?? 'studio-input'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        onKeyDown={onKeyDown}
        style={{ flex: 1, minWidth: 0 }}
      />
      <button
        type="button"
        className="btn btn-ghost"
        onClick={handleBrowse}
        disabled={disabled || browsing}
        title={sourceType === 'zip' ? 'Browse for a .zip file' : 'Browse for a folder'}
        style={{ flexShrink: 0, padding: '5px 10px', fontSize: 11 }}
      >
        {browsing ? '…' : 'Browse…'}
      </button>
    </div>
  )
}
