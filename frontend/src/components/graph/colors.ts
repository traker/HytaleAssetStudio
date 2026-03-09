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
    rootinteraction: '#FFB347',
    effect: '#D4A5A5',
    projectile: '#FF9FF3',
    npc: '#74B9FF',
    prefab: '#A29BFE',
    json_data: '#9B9B9B',
    default: '#555555',
  }
  return colors[group] || colors.default
}

export const getColorForEdgeType = (edgeType: string): string => {
  const colors: Record<string, string> = {
    next: '#F4A261',
    failed: '#FF6B6B',
    replace: '#A29BFE',
    fork: '#FFE66D',
    blocked: '#888888',
    calls: '#74B9FF',
    collisionNext: '#96CEB4',
    groundNext: '#96CEB4',
    ref: '#666666',
    resource: '#96CEB4',
  }
  return colors[edgeType] || '#666666'
}
