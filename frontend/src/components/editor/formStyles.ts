import type React from 'react'

export const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: '#98a2c4',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: 600,
}

export const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#1a1a2e',
  border: '1px solid #404467',
  borderRadius: 5,
  color: '#ddd',
  fontSize: 13,
  lineHeight: 1.45,
  padding: '6px 8px',
  outline: 'none',
}

export const TEXTAREA_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  fontFamily: 'monospace',
  resize: 'vertical',
  lineHeight: 1.4,
  minHeight: 72,
}

export const FIELD_WRAP: React.CSSProperties = {
  marginBottom: 12,
}
