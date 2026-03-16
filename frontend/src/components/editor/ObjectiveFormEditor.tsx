// ObjectiveFormEditor.tsx
// Structured editor for Hytale Objective assets (Server/Objective/).
// Each Objective has TaskSets[] (each TaskSet has Tasks[]) + Completions[].

import type React from 'react'

import { FIELD_WRAP, INPUT_STYLE, LABEL_STYLE, TEXTAREA_STYLE } from './formStyles'

type Task = {
  Type?: string
  Count?: number
  NPCGroupId?: string
  ItemId?: string
  BlockTagOrItemId?: { ItemId?: string }
  TargetLocation?: string
  TaskConditions?: unknown
  [key: string]: unknown
}

type TaskSet = {
  Tasks?: Task[]
  [key: string]: unknown
}

type Completion = {
  Type?: string
  DropList?: string
  [key: string]: unknown
}

type Props = {
  json: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
  readOnly: boolean
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SECTION_STYLE: React.CSSProperties = {
  marginBottom: 12,
  padding: '10px 12px 8px',
  border: '1px solid #2b2b3f',
  borderRadius: 6,
  background: 'rgba(25, 25, 40, 0.55)',
}

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: '#9da5ca',
  marginBottom: 8,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  fontWeight: 700,
}

const ADD_BTN_STYLE: React.CSSProperties = {
  marginTop: 6,
  padding: '3px 10px',
  fontSize: 11,
  borderRadius: 4,
  background: '#1e1e35',
  border: '1px solid #444',
  color: '#aaa',
  cursor: 'pointer',
}

const REMOVE_BTN_STYLE: React.CSSProperties = {
  padding: '1px 7px',
  fontSize: 10,
  borderRadius: 3,
  background: '#3a1a1a',
  border: '1px solid #662222',
  color: '#cc6666',
  cursor: 'pointer',
  marginLeft: 6,
}

const GRID2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }

const TASK_SET_STYLE: React.CSSProperties = {
  border: '1px solid #334',
  borderRadius: 5,
  padding: '8px 10px',
  marginBottom: 8,
  background: 'rgba(30, 30, 50, 0.5)',
}

const TASK_STYLE: React.CSSProperties = {
  border: '1px solid #2d2d40',
  borderRadius: 4,
  padding: '6px 8px',
  marginBottom: 6,
  background: 'rgba(20, 20, 36, 0.5)',
}

const ALL_TASK_TYPES = ['KillNPC', 'Gather', 'ReachLocation', 'Craft', 'UseBlock', 'UseEntity']

// ─── Task editor ──────────────────────────────────────────────────────────────

function TaskEditor({
  task,
  onChange,
  onRemove,
  readOnly,
}: {
  task: Task
  onChange: (t: Task) => void
  onRemove: () => void
  readOnly: boolean
}) {
  const type = task.Type ?? ''

  function setField(k: string, v: unknown) {
    onChange({ ...task, [k]: v })
  }

  return (
    <div style={TASK_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <label style={{ ...LABEL_STYLE, marginBottom: 0, marginRight: 6, flex: 1 }}>Task Type</label>
        <select
          style={{ ...INPUT_STYLE, cursor: readOnly ? 'default' : 'pointer', flex: 2 }}
          value={type}
          disabled={readOnly}
          onChange={(e) => setField('Type', e.target.value || undefined)}
        >
          <option value="">— select —</option>
          {ALL_TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {!readOnly && (
          <button style={REMOVE_BTN_STYLE} onClick={onRemove}>✕</button>
        )}
      </div>

      {/* Count (shared by most types) */}
      {(type === 'KillNPC' || type === 'Gather' || type === 'Craft' || type === 'UseBlock' || type === 'UseEntity') && (
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Count</label>
          <input
            type="number" step="1" min="1" style={INPUT_STYLE}
            value={typeof task.Count === 'number' ? task.Count : ''}
            readOnly={readOnly}
            onChange={(e) => setField('Count', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </div>
      )}

      {/* KillNPC */}
      {type === 'KillNPC' && (
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>NPC Group ID</label>
          <input
            style={INPUT_STYLE}
            value={typeof task.NPCGroupId === 'string' ? task.NPCGroupId : ''}
            readOnly={readOnly}
            placeholder="GroupId string"
            onChange={(e) => setField('NPCGroupId', e.target.value || undefined)}
          />
        </div>
      )}

      {/* Gather */}
      {type === 'Gather' && (
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Item ID (BlockTagOrItemId)</label>
          <input
            style={INPUT_STYLE}
            value={
              task.BlockTagOrItemId && typeof task.BlockTagOrItemId === 'object'
                ? String((task.BlockTagOrItemId as Record<string, unknown>)['ItemId'] ?? '')
                : ''
            }
            readOnly={readOnly}
            placeholder="item or block ID"
            onChange={(e) =>
              setField('BlockTagOrItemId', e.target.value ? { ItemId: e.target.value } : undefined)
            }
          />
        </div>
      )}

      {/* Craft */}
      {type === 'Craft' && (
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Item ID</label>
          <input
            style={INPUT_STYLE}
            value={typeof task.ItemId === 'string' ? task.ItemId : ''}
            readOnly={readOnly}
            placeholder="crafted item ID"
            onChange={(e) => setField('ItemId', e.target.value || undefined)}
          />
        </div>
      )}

      {/* ReachLocation */}
      {type === 'ReachLocation' && (
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Target Location</label>
          <input
            style={INPUT_STYLE}
            value={typeof task.TargetLocation === 'string' ? task.TargetLocation : ''}
            readOnly={readOnly}
            placeholder="location reference"
            onChange={(e) => setField('TargetLocation', e.target.value || undefined)}
          />
        </div>
      )}

      {/* UseBlock / UseEntity or unrecognized — textarea */}
      {(type === 'UseBlock' || type === 'UseEntity' || (type !== '' && !ALL_TASK_TYPES.includes(type))) && (
        <div style={FIELD_WRAP}>
          <label style={LABEL_STYLE}>Extra fields (JSON)</label>
          <textarea
            style={{ ...TEXTAREA_STYLE, minHeight: 60 }}
            value={JSON.stringify(task, null, 2)}
            readOnly={readOnly}
            onChange={(e) => {
              try { onChange(JSON.parse(e.target.value)) } catch { /* ignore */ }
            }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ObjectiveFormEditor({ json, onChange, readOnly }: Props) {
  const taskSets: TaskSet[] = Array.isArray(json['TaskSets']) ? (json['TaskSets'] as TaskSet[]) : []
  const completions: Completion[] = Array.isArray(json['Completions']) ? (json['Completions'] as Completion[]) : []

  // ── TaskSet helpers ──────────────────────────────────────────────────────
  function updateTaskSet(idx: number, ts: TaskSet) {
    const next = [...taskSets]
    next[idx] = ts
    onChange({ ...json, TaskSets: next })
  }

  function addTaskSet() {
    onChange({ ...json, TaskSets: [...taskSets, { Tasks: [] }] })
  }

  function removeTaskSet(idx: number) {
    const next = taskSets.filter((_, i) => i !== idx)
    onChange({ ...json, TaskSets: next.length ? next : undefined })
  }

  // ── Task helpers (inside a TaskSet) ────────────────────────────────────
  function updateTask(tsIdx: number, tIdx: number, task: Task) {
    const tasks = [...(taskSets[tsIdx].Tasks ?? [])]
    tasks[tIdx] = task
    updateTaskSet(tsIdx, { ...taskSets[tsIdx], Tasks: tasks })
  }

  function addTask(tsIdx: number) {
    const tasks = [...(taskSets[tsIdx].Tasks ?? []), {}]
    updateTaskSet(tsIdx, { ...taskSets[tsIdx], Tasks: tasks })
  }

  function removeTask(tsIdx: number, tIdx: number) {
    const tasks = (taskSets[tsIdx].Tasks ?? []).filter((_, i) => i !== tIdx)
    updateTaskSet(tsIdx, { ...taskSets[tsIdx], Tasks: tasks.length ? tasks : undefined })
  }

  // ── Completion helpers ─────────────────────────────────────────────────
  function updateCompletion(idx: number, c: Completion) {
    const next = [...completions]
    next[idx] = c
    onChange({ ...json, Completions: next })
  }

  function addCompletion() {
    onChange({ ...json, Completions: [...completions, {}] })
  }

  function removeCompletion(idx: number) {
    const next = completions.filter((_, i) => i !== idx)
    onChange({ ...json, Completions: next.length ? next : undefined })
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

      {/* TaskSets */}
      <div style={SECTION_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={SECTION_TITLE_STYLE}>Task Sets</div>
          {!readOnly && <button style={ADD_BTN_STYLE} onClick={addTaskSet}>+ Add Task Set</button>}
        </div>

        {taskSets.length === 0 && (
          <div style={{ color: '#555', fontSize: 12, paddingBottom: 4 }}>No task sets defined.</div>
        )}

        {taskSets.map((ts, tsIdx) => (
          <div key={tsIdx} style={TASK_SET_STYLE}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#7a8bb0', fontWeight: 600 }}>Task Set {tsIdx + 1}</span>
              {!readOnly && (
                <button style={REMOVE_BTN_STYLE} onClick={() => removeTaskSet(tsIdx)}>Remove</button>
              )}
            </div>

            {(ts.Tasks ?? []).map((task, tIdx) => (
              <TaskEditor
                key={tIdx}
                task={task}
                onChange={(t) => updateTask(tsIdx, tIdx, t)}
                onRemove={() => removeTask(tsIdx, tIdx)}
                readOnly={readOnly}
              />
            ))}

            {!readOnly && (
              <button style={{ ...ADD_BTN_STYLE, marginTop: 2 }} onClick={() => addTask(tsIdx)}>
                + Add Task
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Completions */}
      <div style={SECTION_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={SECTION_TITLE_STYLE}>Completions</div>
          {!readOnly && <button style={ADD_BTN_STYLE} onClick={addCompletion}>+ Add Completion</button>}
        </div>

        {completions.length === 0 && (
          <div style={{ color: '#555', fontSize: 12, paddingBottom: 4 }}>No completions defined.</div>
        )}

        {completions.map((c, idx) => (
          <div key={idx} style={{ ...TASK_STYLE, marginBottom: 6 }}>
            <div style={GRID2}>
              <div style={FIELD_WRAP}>
                <label style={LABEL_STYLE}>Type</label>
                <select
                  style={{ ...INPUT_STYLE, cursor: readOnly ? 'default' : 'pointer' }}
                  value={c.Type ?? ''}
                  disabled={readOnly}
                  onChange={(e) => updateCompletion(idx, { ...c, Type: e.target.value || undefined })}
                >
                  <option value="">—</option>
                  <option value="GiveItems">GiveItems</option>
                  <option value="ClearObjectiveItems">ClearObjectiveItems</option>
                </select>
              </div>
              <div style={FIELD_WRAP}>
                <label style={LABEL_STYLE}>Drop List ID</label>
                <input
                  style={INPUT_STYLE}
                  value={typeof c.DropList === 'string' ? c.DropList : ''}
                  readOnly={readOnly}
                  placeholder="DropList ID"
                  onChange={(e) => updateCompletion(idx, { ...c, DropList: e.target.value || undefined })}
                />
              </div>
            </div>
            {!readOnly && (
              <button style={{ ...REMOVE_BTN_STYLE, marginTop: 4 }} onClick={() => removeCompletion(idx)}>Remove</button>
            )}
          </div>
        ))}
      </div>

    </div>
  )
}
