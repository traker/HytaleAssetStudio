import { InteractionTreeEditor } from './InteractionTreeEditor'

type Props = {
  projectId: string
  root: { assetKey: string; display: string } | null
  onBack: () => void
  onOpenItem?: (root: { assetKey: string; display: string }) => void
}

export function ProjectGraphInteractionsView(props: Props) {
  if (!props.root) {
    return (
      <div className="card" style={{ textAlign: 'left' }}>
        <h2 style={{ marginTop: 0 }}>Interactions</h2>
        <p style={{ opacity: 0.8, marginTop: 0 }}>
          Ouvre cette vue depuis le graphe Items (bouton "Interactions").
        </p>
        <button onClick={props.onBack}>Back</button>
      </div>
    )
  }

  return <InteractionTreeEditor projectId={props.projectId} root={props.root} onBack={props.onBack} onOpenItem={props.onOpenItem} />
}
