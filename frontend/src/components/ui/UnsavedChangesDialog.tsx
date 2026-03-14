type Props = {
  open: boolean
  assetLabel?: string | null
  onCancel: () => void
  onDiscard: () => void
}

export function UnsavedChangesDialog({ open, assetLabel, onCancel, onDiscard }: Props) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.58)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4000,
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-dialog-title"
        style={{
          width: 'min(480px, 100%)',
          background: '#171722',
          color: '#eee',
          border: '1px solid #34344a',
          borderRadius: 10,
          boxShadow: '0 18px 48px rgba(0,0,0,0.45)',
          padding: 18,
        }}
      >
        <div id="unsaved-dialog-title" style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
          Unsaved changes
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.55, color: '#bbb', marginBottom: 14 }}>
          {assetLabel
            ? `You have unsaved changes in ${assetLabel}. Discard them and continue?`
            : 'You have unsaved changes in the current asset. Discard them and continue?'}
        </div>
        <div style={{ fontSize: 11, color: '#777', marginBottom: 16 }}>
          Save from the side panel if you want to keep the current draft.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 12px',
              background: '#26263a',
              color: '#ddd',
              border: '1px solid #40405c',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onDiscard}
            style={{
              padding: '6px 12px',
              background: '#4a2323',
              color: '#ffb3b3',
              border: '1px solid #7a3434',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Discard changes
          </button>
        </div>
      </div>
    </div>
  )
}