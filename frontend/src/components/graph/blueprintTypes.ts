export type OutgoingDep = {
  edgeLabel: string
  targetId: string
  targetLabel: string
  targetGroup: string
}

export type BlueprintNodeData = {
  label: string
  group: string
  path?: string
  isModified?: boolean
  isRoot?: boolean
  modificationKind?: 'override' | 'new'
  isSelected?: boolean
  isConnected?: boolean
  outgoing?: OutgoingDep[]
  nodeId?: string
  onSelectNode?: (sourceId: string, targetId: string) => void
  canToggleExpand?: boolean
  isExpanded?: boolean
  onToggleExpand?: (nodeId: string) => void
}

export function isInteractionBlueprintGroup(group: string | undefined): boolean {
  return group === 'interaction' || group === 'rootinteraction'
}

export function getBlueprintNodeDisplay(data: BlueprintNodeData | undefined, fallback: string): string {
  return data?.label ?? fallback
}