import { InteractionTreeEditor } from '../../components/editor/InteractionTreeEditor'

type Props = {
  projectId: string
  root: { assetKey: string; display: string } | null
  onBack: () => void
  onOpenReference?: (root: { assetKey: string; display: string }) => void
}

export function ProjectGraphInteractionsView(props: Props) {
  if (!props.root) {
    return (
      <div className="card" style={{ textAlign: 'left' }}>
        <h2 style={{ marginTop: 0 }}>Interactions</h2>
        <p style={{ opacity: 0.8, marginTop: 0 }}>
          Open this view from the Items graph after selecting an item asset.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: '#8aa4b8', border: '1px solid #33485d', borderRadius: 999, padding: '4px 8px' }}>Open Items</span>
          <span style={{ fontSize: 11, color: '#8aa4b8', border: '1px solid #33485d', borderRadius: 999, padding: '4px 8px' }}>Select an item</span>
          <span style={{ fontSize: 11, color: '#8aa4b8', border: '1px solid #33485d', borderRadius: 999, padding: '4px 8px' }}>Open Interactions</span>
        </div>
        <button onClick={props.onBack}>Back</button>
      </div>
    )
  }

  return <InteractionTreeEditor projectId={props.projectId} root={props.root} onBack={props.onBack} onOpenReference={props.onOpenReference} />
}
