export const getColorForGroup = (group: string): string => {
  // Legacy-inspired palette (kept minimal, extensible).
  const colors: Record<string, string> = {
    item: '#FF6B6B',
    block: '#4ECDC4',
    model: '#45B7D1',
    texture: '#96CEB4',
    sound: '#FFEAA7',
    particle: '#DDA0DD',
    interaction: '#F4A261',
    effect: '#D4A5A5',
    json_data: '#9B9B9B',
    default: '#555555',
  }
  return colors[group] || colors.default
}
