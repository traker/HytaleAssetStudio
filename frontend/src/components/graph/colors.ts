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

export const getColorForInteractionType = (nodeType: string): string => {
  const t = nodeType.toLowerCase()
  if (t === 'serial')         return '#F4A261'
  if (t === 'parallel')       return '#74B9FF'
  if (t === 'charging')       return '#FFE66D'
  if (t === 'condition')      return '#A29BFE'
  if (t === 'replace')        return '#FF9FF3'
  if (t === 'selector')       return '#96CEB4'
  if (t === 'simple')         return '#FFEAA7'
  if (t === 'damageentity')   return '#FF6B6B'
  if (t === 'applyeffect')    return '#DDA0DD'
  if (t === 'heal')           return '#55EFC4'
  if (t === 'applyforce')     return '#FDCB6E'
  if (t === 'spawnnpc')       return '#74B9FF'
  if (t === 'placeblock')     return '#4ECDC4'
  if (t === 'changestat' || t === 'changestathwithmodifier') return '#D4A5A5'
  if (t === 'clearentityeffect') return '#B2BEC3'
  if (t === 'wielding')       return '#FFB347'
  if (t === 'chaining')       return '#F4A261'
  if (t === 'external')       return '#9B9B9B'
  return '#888888'
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
