import { ProjectGraphItemsView } from './project/ProjectGraphItemsView'

type Props = {
  projectId: string
  onBack: () => void
}

// Backward-compatible wrapper (historical import path).
export function ProjectGraphView(props: Props) {
  return <ProjectGraphItemsView projectId={props.projectId} onBack={props.onBack} onOpenInteractions={() => {}} />
}
