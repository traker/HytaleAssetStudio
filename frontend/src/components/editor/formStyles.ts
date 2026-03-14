import type React from 'react'

export const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  color: '#888',
  marginBottom: 3,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

export const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#1a1a2e',
  border: '1px solid #3a3a5c',
  borderRadius: 4,
  color: '#ddd',
  fontSize: 12,
  padding: '5px 7px',
  outline: 'none',
}

export const TEXTAREA_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  fontFamily: 'monospace',
  resize: 'vertical',
  lineHeight: 1.4,
  minHeight: 60,
}

export const FIELD_WRAP: React.CSSProperties = {
  marginBottom: 10,
}
