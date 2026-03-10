import { useRef } from 'react'

type PathInputProps = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** 'folder' → directory picker, 'zip' → .zip file picker, 'any' → folder picker */
  sourceType?: 'folder' | 'zip' | 'any'
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
}

/**
 * A text input with a "Browse…" button that opens the native file/folder picker.
 *
 * ⚠ Browser limitation: for security reasons, browsers do not expose the full
 * absolute path of a picked file or folder. Only the file/folder **name** is
 * pre-filled from the picker — the user must complete the rest of the path.
 */
export function PathInput({ value, onChange, placeholder, sourceType = 'any', disabled, className, style, onKeyDown }: PathInputProps) {
  const hiddenRef = useRef<HTMLInputElement>(null)

  function handleBrowse(): void {
    hiddenRef.current?.click()
  }

  function handlePicked(e: React.ChangeEvent<HTMLInputElement>): void {
    const files = e.target.files
    if (!files || files.length === 0) return

    let hint = ''
    if (sourceType === 'folder') {
      // webkitRelativePath is like "FolderName/sub/file.json"
      const rel = files[0].webkitRelativePath
      hint = rel ? rel.split('/')[0] : files[0].name
    } else {
      hint = files[0].name
    }

    // Pre-fill only if the field is empty, otherwise append the hint at cursor
    if (!value.trim()) {
      onChange(hint)
    } else {
      // Replace just the last path segment with the picked name
      const sep = value.includes('/') ? '/' : '\\'
      const parts = value.replace(/[\\/]+$/, '').split(/[\\/]/)
      parts[parts.length - 1] = hint
      onChange(parts.join(sep))
    }

    // Reset so the same path can be picked again
    e.target.value = ''
  }

  const isFolder = sourceType === 'folder' || sourceType === 'any'
  const isZip = sourceType === 'zip'

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
        disabled={disabled}
        title="Browse… (pre-fills the file/folder name only — complete the full path manually)"
        style={{ flexShrink: 0, padding: '5px 10px', fontSize: 11 }}
      >
        Browse…
      </button>

      {/* Hidden native picker */}
      <input
        ref={hiddenRef}
        type="file"
        style={{ display: 'none' }}
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — webkitdirectory is not in the standard TS types
        webkitdirectory={isFolder ? '' : undefined}
        multiple={isFolder}
        accept={isZip ? '.zip' : undefined}
        onChange={handlePicked}
      />
    </div>
  )
}
