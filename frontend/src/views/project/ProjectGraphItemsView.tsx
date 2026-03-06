import { ProjectGraphEditor } from './ProjectGraphEditor'

type Props = {
  projectId: string
  onBack: () => void
  onOpenInteractions: (root: { assetKey: string; display: string }) => void
}

export function ProjectGraphItemsView(props: Props) {
  return (
    <ProjectGraphEditor
      projectId={props.projectId}
      onBack={props.onBack}
      searchPlaceholder="Rechercher un item..."
      onOpenInteractions={props.onOpenInteractions}
    />
  )
}
