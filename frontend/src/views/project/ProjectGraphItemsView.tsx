import { ProjectGraphEditor } from '../../components/editor/ProjectGraphEditor'

type Props = {
  projectId: string
  onBack: () => void
  onOpenInteractions: (root: { assetKey: string; display: string }) => void
  root?: { assetKey: string; display: string } | null
}

export function ProjectGraphItemsView(props: Props) {
  return (
    <ProjectGraphEditor
      projectId={props.projectId}
      onBack={props.onBack}
      root={props.root ?? undefined}
      autoLoad={Boolean(props.root)}
      searchPlaceholder="Rechercher un item..."
      onOpenInteractions={props.onOpenInteractions}
    />
  )
}
