import type { FieldDef } from '../graph/interactionSchemas'
import {
    HitEntityRulesEditor,
    InteractionListEditor,
    InteractionMapEditor,
    InteractionValueEditor,
    SelectorBranchEditor,
} from './interactionFormStructuredEditors'
import { FIELD_WRAP, INPUT_STYLE, LABEL_STYLE, TEXTAREA_STYLE } from './formStyles'

type NestedFieldType = 'string' | 'number' | 'boolean'

interface NestedFieldDef {
    key: string
    label: string
    type: NestedFieldType
    description?: string
    placeholder?: string
}

type RenderField = (
    field: FieldDef,
    value: unknown,
    onChange: (key: string, val: unknown) => void,
) => React.ReactNode

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
}

function pruneRecord(value: Record<string, unknown>): Record<string, unknown> | undefined {
    return Object.keys(value).length === 0 ? undefined : value
}

function FieldSection({
    title,
    description,
    children,
}: {
    title: string
    description?: string
    children: React.ReactNode
}) {
    return (
        <div
            style={{
                marginBottom: 12,
                padding: '10px 10px 2px',
                border: '1px solid #2b2b3f',
                borderRadius: 6,
                background: 'rgba(25, 25, 40, 0.55)',
            }}
        >
            <div style={{ fontSize: 10, color: '#8d8db4', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                {title}
            </div>
            {description && <div style={{ fontSize: 10, color: '#666', marginBottom: 8 }}>{description}</div>}
            {children}
        </div>
    )
}

function NestedObjectSection({
    objectKey,
    title,
    description,
    value,
    fields,
    onChange,
}: {
    objectKey: string
    title: string
    description?: string
    value: unknown
    fields: NestedFieldDef[]
    onChange: (key: string, val: unknown) => void
}) {
    const obj = asRecord(value)

    function handleNestedChange(fieldKey: string, nextValue: unknown) {
        const updated = { ...obj }
        if (nextValue === undefined || nextValue === null || nextValue === '') {
            delete updated[fieldKey]
        } else {
            updated[fieldKey] = nextValue
        }
        onChange(objectKey, Object.keys(updated).length === 0 ? undefined : updated)
    }

    return (
        <FieldSection title={title} description={description}>
            {fields.map((field) => {
                if (field.type === 'boolean') {
                    return (
                        <div key={`${objectKey}.${field.key}`} style={{ ...FIELD_WRAP, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                                type="checkbox"
                                id={`${objectKey}.${field.key}`}
                                checked={Boolean(obj[field.key])}
                                onChange={(e) => handleNestedChange(field.key, e.target.checked)}
                                style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#61dafb' }}
                            />
                            <label htmlFor={`${objectKey}.${field.key}`} style={{ fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                                {field.label}
                                {field.description && <span style={{ color: '#666', fontSize: 10, marginLeft: 6 }}>({field.description})</span>}
                            </label>
                        </div>
                    )
                }

                if (field.type === 'number') {
                    return (
                        <div key={`${objectKey}.${field.key}`} style={FIELD_WRAP}>
                            <span style={LABEL_STYLE}>{field.label}</span>
                            {field.description && <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>{field.description}</div>}
                            <input
                                type="number"
                                step="any"
                                value={obj[field.key] === undefined || obj[field.key] === null ? '' : String(obj[field.key])}
                                onChange={(e) => {
                                    const v = e.target.value.trim()
                                    handleNestedChange(field.key, v === '' ? undefined : parseFloat(v))
                                }}
                                style={INPUT_STYLE}
                                placeholder={field.placeholder}
                            />
                        </div>
                    )
                }

                return (
                    <div key={`${objectKey}.${field.key}`} style={FIELD_WRAP}>
                        <span style={LABEL_STYLE}>{field.label}</span>
                        {field.description && <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>{field.description}</div>}
                        <input
                            type="text"
                            value={typeof obj[field.key] === 'string' ? obj[field.key] as string : ''}
                            onChange={(e) => handleNestedChange(field.key, e.target.value || undefined)}
                            style={INPUT_STYLE}
                            placeholder={field.placeholder}
                        />
                    </div>
                )
            })}
        </FieldSection>
    )
}

function NumberMapEditor({
    title,
    description,
    value,
    onChange,
    addLabel,
    keyPlaceholder,
    defaultKeys,
}: {
    title: string
    description?: string
    value: Record<string, unknown>
    onChange: (nextValue: Record<string, unknown> | undefined) => void
    addLabel: string
    keyPlaceholder: string
    defaultKeys: string[]
}) {
    const entries = Object.entries(value)

    function setEntry(entryKey: string, nextValue: number) {
        onChange(pruneRecord({ ...value, [entryKey]: nextValue }))
    }

    function removeEntry(entryKey: string) {
        const next = { ...value }
        delete next[entryKey]
        onChange(pruneRecord(next))
    }

    function renameEntry(entryKey: string, nextKey: string) {
        const trimmed = nextKey.trim()
        if (!trimmed || trimmed === entryKey) return

        const next: Record<string, unknown> = {}
        for (const [currentKey, currentValue] of Object.entries(value)) {
            next[currentKey === entryKey ? trimmed : currentKey] = currentValue
        }
        onChange(pruneRecord(next))
    }

    function addEntry() {
        const nextKey = defaultKeys.find((candidate) => !(candidate in value)) ?? `Value_${Date.now()}`
        onChange({ ...value, [nextKey]: 0 })
    }

    return (
        <FieldSection title={title} description={description}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {entries.length === 0 && (
                    <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>No values yet.</div>
                )}
                {entries.map(([entryKey, entryValue]) => (
                    <div key={entryKey} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                            type="text"
                            defaultValue={entryKey}
                            onBlur={(e) => renameEntry(entryKey, e.target.value)}
                            style={{ ...INPUT_STYLE, width: 140, flexShrink: 0 }}
                            placeholder={keyPlaceholder}
                        />
                        <input
                            type="number"
                            step="any"
                            value={typeof entryValue === 'number' ? entryValue : Number(entryValue) || 0}
                            onChange={(e) => setEntry(entryKey, Number.parseFloat(e.target.value) || 0)}
                            style={{ ...INPUT_STYLE, width: 90, flexShrink: 0 }}
                        />
                        <button
                            type="button"
                            onClick={() => removeEntry(entryKey)}
                            style={{ background: 'transparent', border: 'none', color: '#FF6B6B', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '2px 2px' }}
                            title="Remove entry"
                        >
                            ×
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={addEntry}
                    style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px dashed #444', borderRadius: 3, color: '#666', cursor: 'pointer', fontSize: 11, padding: '3px 8px' }}
                >
                    {addLabel}
                </button>
            </div>
        </FieldSection>
    )
}

function EntityStatsOnHitEditor({
    value,
    onChange,
}: {
    value: unknown
    onChange: (nextValue: unknown) => void
}) {
    const entries = Array.isArray(value) ? value : []

    function setEntry(index: number, fieldKey: 'EntityStatId' | 'Amount', nextValue: string | number) {
        const next = entries.map((entry, entryIndex) => {
            if (entryIndex !== index) return entry
            const obj = asRecord(entry)
            return { ...obj, [fieldKey]: nextValue }
        })
        onChange(next)
    }

    function removeEntry(index: number) {
        const next = entries.filter((_, entryIndex) => entryIndex !== index)
        onChange(next.length === 0 ? undefined : next)
    }

    function addEntry() {
        onChange([
            ...entries,
            { EntityStatId: 'SignatureEnergy', Amount: 1 },
        ])
    }

    return (
        <FieldSection
            title="Entity Stats On Hit"
            description="Award or modify entity stats when the hit lands, for example signature meter gain."
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {entries.length === 0 && (
                    <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>No on-hit stats yet.</div>
                )}
                {entries.map((entry, index) => {
                    const obj = asRecord(entry)
                    return (
                        <div key={`stat-on-hit-${index}`} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                                type="text"
                                value={typeof obj['EntityStatId'] === 'string' ? obj['EntityStatId'] as string : ''}
                                onChange={(e) => setEntry(index, 'EntityStatId', e.target.value)}
                                style={{ ...INPUT_STYLE, flex: 1 }}
                                placeholder="EntityStatId"
                            />
                            <input
                                type="number"
                                step="any"
                                value={typeof obj['Amount'] === 'number' ? obj['Amount'] : Number(obj['Amount']) || 0}
                                onChange={(e) => setEntry(index, 'Amount', Number.parseFloat(e.target.value) || 0)}
                                style={{ ...INPUT_STYLE, width: 90, flexShrink: 0 }}
                                placeholder="Amount"
                            />
                            <button
                                type="button"
                                onClick={() => removeEntry(index)}
                                style={{ background: 'transparent', border: 'none', color: '#FF6B6B', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '2px 2px' }}
                                title="Remove stat"
                            >
                                ×
                            </button>
                        </div>
                    )
                })}
                <button
                    type="button"
                    onClick={addEntry}
                    style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px dashed #444', borderRadius: 3, color: '#666', cursor: 'pointer', fontSize: 11, padding: '3px 8px' }}
                >
                    + Add stat
                </button>
            </div>
        </FieldSection>
    )
}

function JsonObjectExtrasField({
    label,
    description,
    value,
    onChange,
    placeholder,
}: {
    label: string
    description: string
    value: Record<string, unknown>
    onChange: (nextValue: Record<string, unknown>) => void
    placeholder: string
}) {
    if (Object.keys(value).length === 0) return null

    return (
        <div style={FIELD_WRAP}>
            <span style={LABEL_STYLE}>{label}</span>
            <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>{description}</div>
            <textarea
                key={`${label}-${JSON.stringify(value)}`}
                rows={4}
                defaultValue={JSON.stringify(value, null, 2)}
                onBlur={(e) => {
                    const raw = e.target.value.trim()
                    if (!raw) {
                        onChange({})
                        return
                    }
                    try {
                        const parsed = JSON.parse(raw)
                        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                            onChange(parsed as Record<string, unknown>)
                        }
                    } catch {
                    }
                }}
                style={TEXTAREA_STYLE}
                placeholder={placeholder}
                spellCheck={false}
            />
        </div>
    )
}

function ItemStackEditor({
    title,
    description,
    value,
    onChange,
}: {
    title: string
    description: string
    value: unknown
    onChange: (nextValue: unknown) => void
}) {
    const item = asRecord(value)
    const extras = { ...item }
    delete extras['Id']
    delete extras['Quantity']

    function emit(nextPatch: Partial<Record<string, unknown>>, nextExtras = extras) {
        const next: Record<string, unknown> = { ...nextExtras }
        for (const [entryKey, entryValue] of Object.entries({ ...item, ...nextPatch })) {
            if (entryValue !== undefined && entryValue !== null && entryValue !== '') {
                next[entryKey] = entryValue
            }
        }
        onChange(pruneRecord(next))
    }

    return (
        <FieldSection title={title} description={description}>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <div style={FIELD_WRAP}>
                    <span style={LABEL_STYLE}>Item ID</span>
                    <input
                        type="text"
                        value={typeof item['Id'] === 'string' ? item['Id'] as string : ''}
                        onChange={(e) => emit({ Id: e.target.value || undefined })}
                        style={INPUT_STYLE}
                        placeholder="Potion_Health_Lesser"
                    />
                </div>
                <div style={FIELD_WRAP}>
                    <span style={LABEL_STYLE}>Quantity</span>
                    <input
                        type="number"
                        step="1"
                        value={item['Quantity'] === undefined ? '' : String(item['Quantity'])}
                        onChange={(e) => {
                            const raw = e.target.value.trim()
                            emit({ Quantity: raw === '' ? undefined : Number.parseInt(raw, 10) || 0 })
                        }}
                        style={INPUT_STYLE}
                        placeholder="1"
                    />
                </div>
            </div>

            <JsonObjectExtrasField
                label={`Additional ${title} Fields`}
                description="Optional extra keys preserved alongside the common Id and Quantity fields."
                value={extras}
                onChange={(nextValue) => emit({ Id: item['Id'], Quantity: item['Quantity'] }, nextValue)}
                placeholder='{
  "$Comment": "..."
}'
            />
        </FieldSection>
    )
}

function InteractionValueSection({
    title,
    description,
    value,
    onChange,
}: {
    title: string
    description: string
    value: unknown
    onChange: (nextValue: unknown) => void
}) {
    return (
        <FieldSection title={title} description={description}>
            <InteractionValueEditor
                value={value}
                onChange={onChange}
                refPlaceholder="Server_Id_Reference"
            />
        </FieldSection>
    )
}

function StatModifiersSection({
    title,
    description,
    value,
    onChange,
}: {
    title: string
    description: string
    value: unknown
    onChange: (nextValue: unknown) => void
}) {
    return (
        <NumberMapEditor
            title={title}
            description={description}
            value={asRecord(value)}
            onChange={onChange}
            addLabel="+ Add stat"
            keyPlaceholder="Stat ID"
            defaultKeys={['Health', 'Mana', 'Stamina', 'StaminaRegenDelay', 'SignatureEnergy']}
        />
    )
}

function CostsSection({
    title,
    description,
    value,
    onChange,
}: {
    title: string
    description: string
    value: unknown
    onChange: (nextValue: unknown) => void
}) {
    return (
        <NumberMapEditor
            title={title}
            description={description}
            value={asRecord(value)}
            onChange={onChange}
            addLabel="+ Add cost"
            keyPlaceholder="Stat ID"
            defaultKeys={['Mana', 'Stamina', 'Health', 'SignatureEnergy']}
        />
    )
}

function StringListSection({
    title,
    description,
    value,
    onChange,
    placeholder,
}: {
    title: string
    description: string
    value: unknown
    onChange: (nextValue: unknown) => void
    placeholder: string
}) {
    const items = Array.isArray(value) ? value : []

    function setEntry(index: number, nextValue: string) {
        const next = items.map((item, itemIndex) => itemIndex === index ? nextValue : item)
        onChange(next.filter((item) => typeof item === 'string' && item.trim() !== ''))
    }

    function removeEntry(index: number) {
        const next = items.filter((_, itemIndex) => itemIndex !== index)
        onChange(next.length === 0 ? undefined : next)
    }

    function addEntry() {
        onChange([...items, ''])
    }

    return (
        <FieldSection title={title} description={description}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.length === 0 && (
                    <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>No values yet.</div>
                )}
                {items.map((item, index) => (
                    <div key={`${title}-${index}`} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                            type="text"
                            value={typeof item === 'string' ? item : ''}
                            onChange={(e) => setEntry(index, e.target.value)}
                            style={{ ...INPUT_STYLE, flex: 1 }}
                            placeholder={placeholder}
                        />
                        <button
                            type="button"
                            onClick={() => removeEntry(index)}
                            style={{ background: 'transparent', border: 'none', color: '#FF6B6B', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '2px 2px' }}
                            title="Remove entry"
                        >
                            ×
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={addEntry}
                    style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px dashed #444', borderRadius: 3, color: '#666', cursor: 'pointer', fontSize: 11, padding: '3px 8px' }}
                >
                    + Add effect ID
                </button>
            </div>
        </FieldSection>
    )
}

function LabeledInteractionValueList({
    title,
    description,
    fields,
    draft,
    onChange,
}: {
    title: string
    description: string
    fields: Array<{ key: string; label: string; description?: string }>
    draft: Record<string, unknown>
    onChange: (key: string, val: unknown) => void
}) {
    return (
        <FieldSection title={title} description={description}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {fields.map((field) => (
                    <div key={field.key} style={FIELD_WRAP}>
                        <span style={LABEL_STYLE}>{field.label}</span>
                        {field.description && <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>{field.description}</div>}
                        <InteractionValueEditor
                            value={draft[field.key]}
                            onChange={(nextValue) => onChange(field.key, nextValue)}
                            refPlaceholder="Server_Id_Reference"
                        />
                    </div>
                ))}
            </div>
        </FieldSection>
    )
}

function ReplaceDefaultValueEditor({
    value,
    onChange,
}: {
    value: unknown
    onChange: (nextValue: unknown) => void
}) {
    const obj = asRecord(value)
    const hasInteractions = Array.isArray(obj['Interactions'])
    const mode: 'none' | 'container' | 'raw' = Object.keys(obj).length === 0 ? 'none' : hasInteractions ? 'container' : 'raw'

    const otherFields = { ...obj }
    delete otherFields['Interactions']

    function emitContainer(interactions: unknown, extras: Record<string, unknown> = otherFields) {
        const next: Record<string, unknown> = { ...extras }
        if (Array.isArray(interactions) && interactions.length > 0) {
            next['Interactions'] = interactions
        }
        onChange(Object.keys(next).length === 0 ? undefined : next)
    }

    return (
        <FieldSection
            title="Default Value"
            description="Vanilla Replace usually stores a fallback payload under DefaultValue.Interactions. Each entry can be a server ref or an inline interaction object."
        >
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button
                    type="button"
                    onClick={() => {
                        if (mode !== 'none') onChange(undefined)
                    }}
                    style={{
                        background: mode === 'none' ? '#2b2b3f' : 'transparent',
                        border: '1px solid #3f3f57',
                        color: mode === 'none' ? '#d2d5e8' : '#7f859f',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 10,
                        padding: '3px 8px',
                    }}
                >
                    None
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (mode !== 'container') emitContainer([])
                    }}
                    style={{
                        background: mode === 'container' ? '#22314a' : 'transparent',
                        border: '1px solid #334766',
                        color: mode === 'container' ? '#9fd3ff' : '#6f87a8',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 10,
                        padding: '3px 8px',
                    }}
                >
                    Interactions Container
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (mode !== 'raw') onChange({ Type: 'Simple' })
                    }}
                    style={{
                        background: mode === 'raw' ? '#2f2745' : 'transparent',
                        border: '1px solid #4b3e6b',
                        color: mode === 'raw' ? '#d4c3ff' : '#8a7fb1',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 10,
                        padding: '3px 8px',
                    }}
                >
                    Raw Object
                </button>
            </div>

            {mode === 'none' ? (
                <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic', marginBottom: 8 }}>
                    No fallback payload. If the variable is missing, Replace relies on DefaultOk / failure flow only.
                </div>
            ) : mode === 'container' ? (
                <>
                    <InteractionListEditor
                        title="Interactions"
                        description="Ordered fallback interactions used when the InteractionVar is not provided."
                        value={Array.isArray(obj['Interactions']) ? obj['Interactions'] : []}
                        onChange={(nextValue) => emitContainer(Array.isArray(nextValue) ? nextValue : [])}
                    />

                    <div style={FIELD_WRAP}>
                        <span style={LABEL_STYLE}>Additional DefaultValue Fields</span>
                        <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>
                            Optional extra keys preserved alongside the fallback interaction container.
                        </div>
                        <textarea
                            key={`replace-default-extras-${JSON.stringify(otherFields)}`}
                            rows={3}
                            defaultValue={JSON.stringify(otherFields, null, 2)}
                            onBlur={(e) => {
                                const raw = e.target.value.trim()
                                if (!raw) {
                                    emitContainer(Array.isArray(obj['Interactions']) ? obj['Interactions'] : [], {})
                                    return
                                }
                                try {
                                    const parsed = JSON.parse(raw)
                                    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                                        emitContainer(Array.isArray(obj['Interactions']) ? obj['Interactions'] : [], parsed as Record<string, unknown>)
                                    }
                                } catch {
                                }
                            }}
                            style={TEXTAREA_STYLE}
                            placeholder='{\n  "$Comment": "..."\n}'
                            spellCheck={false}
                        />
                    </div>
                </>
            ) : (
                <div style={FIELD_WRAP}>
                    <span style={LABEL_STYLE}>DefaultValue Object</span>
                    <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>
                        Raw JSON object used when the replacement is not just an `Interactions` container.
                    </div>
                    <textarea
                        key={`replace-default-raw-${JSON.stringify(obj)}`}
                        rows={6}
                        defaultValue={JSON.stringify(obj, null, 2)}
                        onBlur={(e) => {
                            const raw = e.target.value.trim()
                            if (!raw) {
                                onChange(undefined)
                                return
                            }
                            try {
                                const parsed = JSON.parse(raw)
                                if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                                    onChange(parsed)
                                }
                            } catch {
                            }
                        }}
                        style={{ ...TEXTAREA_STYLE, minHeight: 96 }}
                        placeholder='{
  "Type": "Simple"
}'
                        spellCheck={false}
                    />
                </div>
            )}
        </FieldSection>
    )
}

export function renderTypeSpecificFields(
    nodeType: string,
    draft: Record<string, unknown>,
    onChange: (key: string, val: unknown) => void,
    renderField: RenderField,
): { content: React.ReactNode | null; handledKeys: Set<string> } {
    if (nodeType === 'Selector') {
        const selectorFields: NestedFieldDef[] = [
            { key: 'Id', label: 'Selector ID', type: 'string', placeholder: 'Horizontal' },
            { key: 'Direction', label: 'Direction', type: 'string', placeholder: 'ToLeft' },
            { key: 'TargetType', label: 'Target Type', type: 'string', placeholder: 'Entity' },
            { key: 'TestLineOfSight', label: 'Test Line Of Sight', type: 'boolean' },
            { key: 'ExtendTop', label: 'Extend Top', type: 'number' },
            { key: 'ExtendBottom', label: 'Extend Bottom', type: 'number' },
            { key: 'StartDistance', label: 'Start Distance', type: 'number' },
            { key: 'EndDistance', label: 'End Distance', type: 'number' },
            { key: 'Distance', label: 'Distance', type: 'number' },
            { key: 'Length', label: 'Length', type: 'number' },
            { key: 'RollOffset', label: 'Roll Offset', type: 'number' },
            { key: 'YawOffset', label: 'Yaw Offset', type: 'number' },
            { key: 'YawStartOffset', label: 'Yaw Start Offset', type: 'number' },
        ]

        const behaviorFields: FieldDef[] = [
            { key: 'RunTime', label: 'RunTime (s)', type: 'number' },
            { key: 'FailOn', label: 'Fail On', type: 'string', description: 'When selector failure should route to Failed' },
            { key: 'Next', label: 'Next', type: 'string-ref', description: 'Follow-up interaction when the selector continues' },
            { key: 'Failed', label: 'Failed', type: 'string-ref', description: 'Fallback interaction when the selector fails' },
        ]

        return {
            handledKeys: new Set(['Selector', 'RunTime', 'FailOn', 'Next', 'Failed', 'HitBlock', 'HitEntity', 'HitNothing', 'HitEntityRules']),
            content: (
                <>
                    <FieldSection title="Selector Behavior" description="Timing and failure routing around the targeting phase.">
                        {behaviorFields.map((field) => renderField(field, draft[field.key], onChange))}
                    </FieldSection>
                    <NestedObjectSection
                        objectKey="Selector"
                        title="Selector Configuration"
                        description="Main targeting parameters for raycast/sweep selector interactions."
                        value={draft['Selector']}
                        fields={selectorFields}
                        onChange={onChange}
                    />
                    <SelectorBranchEditor title="HitEntity" description="Interactions executed when an entity is hit." value={draft['HitEntity']} onChange={(nextValue) => onChange('HitEntity', nextValue)} />
                    <SelectorBranchEditor title="HitBlock" description="Interactions executed when a block is hit." value={draft['HitBlock']} onChange={(nextValue) => onChange('HitBlock', nextValue)} />
                    <SelectorBranchEditor title="HitNothing" description="Interactions executed when nothing is hit." value={draft['HitNothing']} onChange={(nextValue) => onChange('HitNothing', nextValue)} />
                    <HitEntityRulesEditor value={draft['HitEntityRules']} onChange={(nextValue) => onChange('HitEntityRules', nextValue)} />
                </>
            ),
        }
    }

    if (nodeType === 'Chaining') {
        const chainingFields: FieldDef[] = [
            { key: 'ChainId', label: 'Chain ID', type: 'string', description: 'Identifier shared by combo steps and ChainFlag interactions' },
            { key: 'ChainingAllowance', label: 'Chaining Allowance', type: 'number', description: 'Timing window in seconds for the next combo step' },
        ]

        return {
            handledKeys: new Set(['ChainId', 'ChainingAllowance', 'Next', 'Flags']),
            content: (
                <>
                    <FieldSection title="Chaining Behavior" description="Configure the combo ID and timing window for this chain.">
                        {chainingFields.map((field) => renderField(field, draft[field.key], onChange))}
                    </FieldSection>
                    <InteractionListEditor title="Next Steps" description="Ordered combo steps. Each entry can be a server reference or an inline interaction object such as FirstClick." value={draft['Next']} onChange={(nextValue) => onChange('Next', nextValue)} />
                    <InteractionMapEditor title="Flags" description="Optional flag-triggered combo finishers keyed by ChainFlag name." value={draft['Flags']} onChange={(nextValue) => onChange('Flags', nextValue)} />
                </>
            ),
        }
    }

    if (nodeType === 'Wielding') {
        const behaviorFields: FieldDef[] = [
            { key: 'RunTime', label: 'RunTime (s)', type: 'number' },
            { key: 'HorizontalSpeedMultiplier', label: 'Horizontal Speed Mult.', type: 'number', description: 'Movement speed while guarding' },
            { key: 'CancelOnOtherClick', label: 'Cancel On Other Click', type: 'boolean' },
            { key: 'FailOnDamage', label: 'Fail On Damage', type: 'boolean' },
            { key: 'Next', label: 'Next', type: 'string-ref', description: 'Applied while the guard state is active' },
            { key: 'Failed', label: 'Failed', type: 'string-ref', description: 'Triggered when the guard breaks' },
        ]

        const staminaFields: NestedFieldDef[] = [
            { key: 'Value', label: 'Value', type: 'number', placeholder: '7' },
            { key: 'CostType', label: 'Cost Type', type: 'string', placeholder: 'Damage' },
        ]

        const angledFields: NestedFieldDef[] = [
            { key: 'Angle', label: 'Angle', type: 'number', placeholder: '0' },
            { key: 'AngleDistance', label: 'Angle Distance', type: 'number', placeholder: '90' },
        ]

        return {
            handledKeys: new Set(['RunTime', 'HorizontalSpeedMultiplier', 'CancelOnOtherClick', 'FailOnDamage', 'Next', 'Failed', 'StaminaCost', 'AngledWielding']),
            content: (
                <>
                    <FieldSection title="Wielding Behavior" description="Main guard/parry settings and failure flow.">
                        {behaviorFields.map((field) => renderField(field, draft[field.key], onChange))}
                    </FieldSection>
                    <NestedObjectSection objectKey="StaminaCost" title="Stamina Cost" description="Optional stamina drain when the block absorbs damage." value={draft['StaminaCost']} fields={staminaFields} onChange={onChange} />
                    <FieldSection title="Defense Modifiers" description="Top-level damage reduction and on-block feedback.">
                        {renderField({ key: 'DamageModifiers', label: 'Damage Modifiers', type: 'dict-stat-number', description: 'Damage reduction per damage type, e.g. { Physical: 0.5 }' }, draft['DamageModifiers'], onChange)}
                        {renderField({ key: 'BlockedEffects', label: 'Blocked Effects', type: 'effects', description: 'Effects played when a hit is successfully blocked' }, draft['BlockedEffects'], onChange)}
                    </FieldSection>
                    <NestedObjectSection objectKey="AngledWielding" title="Angled Wielding" description="Directional guard configuration for shields and parries." value={draft['AngledWielding']} fields={angledFields} onChange={onChange} />
                    {renderField({ key: 'Forks', label: 'Forks', type: 'object', description: 'Optional fork actions allowed while guarding, e.g. bash on primary input' }, draft['Forks'], onChange)}
                </>
            ),
        }
    }

    if (nodeType === 'Replace') {
        const replaceFields: FieldDef[] = [
            { key: 'Var', label: 'Variable Name', type: 'string', required: true, description: 'Name of the InteractionVar to substitute' },
            { key: 'DefaultOk', label: 'Default OK', type: 'boolean', description: 'Do not fail if the variable is missing' },
            { key: 'Next', label: 'Next', type: 'string-ref', description: 'Optional follow-up interaction after replacement' },
        ]

        return {
            handledKeys: new Set(['Var', 'DefaultOk', 'DefaultValue', 'Next']),
            content: (
                <>
                    <FieldSection title="Replace Behavior" description="Configure the variable binding and fallback path without dropping to raw JSON.">
                        {replaceFields.map((field) => renderField(field, draft[field.key], onChange))}
                    </FieldSection>
                    <ReplaceDefaultValueEditor value={draft['DefaultValue']} onChange={(nextValue) => onChange('DefaultValue', nextValue)} />
                </>
            ),
        }
    }

    if (nodeType === 'Charging') {
        const chargingFields: FieldDef[] = [
            { key: 'AllowIndefiniteHold', label: 'Allow Indefinite Hold', type: 'boolean' },
            { key: 'DisplayProgress', label: 'Display Progress', type: 'boolean' },
            { key: 'FailOnDamage', label: 'Fail On Damage', type: 'boolean' },
            { key: 'HorizontalSpeedMultiplier', label: 'Horizontal Speed Mult.', type: 'number', description: 'Movement speed multiplier while charging' },
            { key: 'Delay', label: 'Delay', type: 'number', description: 'Optional delay before the charging logic starts' },
            { key: 'MouseSensitivityAdjustmentTarget', label: 'Mouse Sensitivity Target', type: 'number', description: 'Target mouse sensitivity while charging' },
            { key: 'MouseSensitivityAdjustmentDuration', label: 'Mouse Sensitivity Duration', type: 'number', description: 'How long the sensitivity transition lasts' },
            { key: 'Failed', label: 'Failed', type: 'string-ref', description: 'Fallback interaction if the charge fails' },
        ]

        return {
            handledKeys: new Set(['AllowIndefiniteHold', 'DisplayProgress', 'FailOnDamage', 'HorizontalSpeedMultiplier', 'Delay', 'MouseSensitivityAdjustmentTarget', 'MouseSensitivityAdjustmentDuration', 'Failed']),
            content: (
                <FieldSection title="Charging Behavior" description="Guide the release logic, mobility and failure path without dropping back to raw JSON.">
                    {chargingFields.map((field) => renderField(field, draft[field.key], onChange))}
                </FieldSection>
            ),
        }
    }

    if (nodeType === 'DamageEntity') {
        const damageCalculator = asRecord(draft['DamageCalculator'])
        const baseDamage = asRecord(damageCalculator['BaseDamage'])
        const damageCalculatorExtras = { ...damageCalculator }
        delete damageCalculatorExtras['Type']
        delete damageCalculatorExtras['Class']
        delete damageCalculatorExtras['BaseDamage']
        delete damageCalculatorExtras['RandomPercentageModifier']

        const damageEffects = asRecord(draft['DamageEffects'])
        const knockback = asRecord(damageEffects['Knockback'])
        const knockbackExtras = { ...knockback }
        delete knockbackExtras['Force']
        delete knockbackExtras['RelativeX']
        delete knockbackExtras['RelativeZ']
        delete knockbackExtras['VelocityY']

        const damageEffectsExtras = { ...damageEffects }
        delete damageEffectsExtras['Knockback']
        delete damageEffectsExtras['WorldSoundEventId']
        delete damageEffectsExtras['LocalSoundEventId']
        delete damageEffectsExtras['WorldParticles']

        function updateDamageCalculator(nextPatch: Partial<Record<string, unknown>>, nextExtras = damageCalculatorExtras) {
            const next: Record<string, unknown> = { ...nextExtras }
            for (const [entryKey, entryValue] of Object.entries({ ...damageCalculator, ...nextPatch })) {
                if (entryValue !== undefined && entryValue !== null && entryValue !== '') {
                    next[entryKey] = entryValue
                }
            }
            onChange('DamageCalculator', pruneRecord(next))
        }

        function updateBaseDamage(nextValue: Record<string, unknown> | undefined) {
            updateDamageCalculator({ BaseDamage: nextValue })
        }

        function updateDamageCalculatorExtras(nextValue: Record<string, unknown>) {
            updateDamageCalculator({
                Type: damageCalculator['Type'],
                Class: damageCalculator['Class'],
                BaseDamage: damageCalculator['BaseDamage'],
                RandomPercentageModifier: damageCalculator['RandomPercentageModifier'],
            }, nextValue)
        }

        function updateDamageEffects(nextPatch: Partial<Record<string, unknown>>, nextExtras = damageEffectsExtras) {
            const next: Record<string, unknown> = { ...nextExtras }
            for (const [entryKey, entryValue] of Object.entries({ ...damageEffects, ...nextPatch })) {
                if (entryValue !== undefined && entryValue !== null && entryValue !== '') {
                    next[entryKey] = entryValue
                }
            }
            onChange('DamageEffects', pruneRecord(next))
        }

        function updateKnockbackField(fieldKey: string, nextValue: number | undefined, nextExtraFields = knockbackExtras) {
            const nextKnockback: Record<string, unknown> = { ...nextExtraFields }
            for (const [entryKey, entryValue] of Object.entries({ ...knockback, [fieldKey]: nextValue })) {
                if (entryValue !== undefined && entryValue !== null && entryValue !== '') {
                    nextKnockback[entryKey] = entryValue
                }
            }
            updateDamageEffects({ Knockback: pruneRecord(nextKnockback) })
        }

        function updateKnockbackExtras(nextValue: Record<string, unknown>) {
            const currentKnown = {
                Force: knockback['Force'],
                RelativeX: knockback['RelativeX'],
                RelativeZ: knockback['RelativeZ'],
                VelocityY: knockback['VelocityY'],
            }
            const nextKnockback: Record<string, unknown> = { ...nextValue }
            for (const [entryKey, entryValue] of Object.entries(currentKnown)) {
                if (entryValue !== undefined && entryValue !== null && entryValue !== '') {
                    nextKnockback[entryKey] = entryValue
                }
            }
            updateDamageEffects({ Knockback: pruneRecord(nextKnockback) })
        }

        function parseOptionalNumber(raw: string): number | undefined {
            const trimmed = raw.trim()
            return trimmed === '' ? undefined : Number.parseFloat(trimmed)
        }

        return {
            handledKeys: new Set(['Parent', 'DamageCalculator', 'Effects', 'DamageEffects', 'EntityStatsOnHit']),
            content: (
                <>
                    <FieldSection title="Damage Entity" description="Common combat payload for weapons, projectiles and impact steps.">
                        {renderField({ key: 'Parent', label: 'Parent', type: 'string', description: 'Optional DamageEntityParent preset reference' }, draft['Parent'], onChange)}
                        {renderField({ key: 'Effects', label: 'Effects', type: 'effects', description: 'Camera or feedback effects played on hit' }, draft['Effects'], onChange)}
                    </FieldSection>
                    <FieldSection title="Damage Calculator" description="Define the damage class or type, then assign one or more damage stats.">
                        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                            <div style={FIELD_WRAP}>
                                <span style={LABEL_STYLE}>Type</span>
                                <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>NPC-style calculator mode, for example Absolute or Dps.</div>
                                <input type="text" value={typeof damageCalculator['Type'] === 'string' ? damageCalculator['Type'] as string : ''} onChange={(e) => updateDamageCalculator({ Type: e.target.value || undefined })} style={INPUT_STYLE} placeholder="Absolute" />
                            </div>
                            <div style={FIELD_WRAP}>
                                <span style={LABEL_STYLE}>Class</span>
                                <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>Weapon-style combat class, for example Light, Charged or Signature.</div>
                                <input type="text" value={typeof damageCalculator['Class'] === 'string' ? damageCalculator['Class'] as string : ''} onChange={(e) => updateDamageCalculator({ Class: e.target.value || undefined })} style={INPUT_STYLE} placeholder="Light" />
                            </div>
                            <div style={FIELD_WRAP}>
                                <span style={LABEL_STYLE}>Random Percentage Modifier</span>
                                <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>Optional damage variance, for example 0.1 for ±10%.</div>
                                <input type="number" step="any" value={damageCalculator['RandomPercentageModifier'] === undefined ? '' : String(damageCalculator['RandomPercentageModifier'])} onChange={(e) => updateDamageCalculator({ RandomPercentageModifier: parseOptionalNumber(e.target.value) })} style={INPUT_STYLE} placeholder="0.1" />
                            </div>
                        </div>
                        <NumberMapEditor title="Base Damage" description="Per-damage-type values applied by this interaction, for example Physical and Fire." value={baseDamage} onChange={updateBaseDamage} addLabel="+ Add damage type" keyPlaceholder="Damage type" defaultKeys={['Physical', 'Fire', 'Ice', 'Lightning', 'Poison', 'Holy', 'Dark']} />
                        <JsonObjectExtrasField label="Additional DamageCalculator Fields" description="Optional advanced calculator keys preserved alongside the guided fields." value={damageCalculatorExtras} onChange={updateDamageCalculatorExtras} placeholder='{
  "$Comment": "..."
}' />
                    </FieldSection>
                    <FieldSection title="Damage Effects" description="Configure knockback plus world-space hit feedback such as sounds and particles.">
                        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                            <div style={FIELD_WRAP}>
                                <span style={LABEL_STYLE}>World Sound Event ID</span>
                                <input type="text" value={typeof damageEffects['WorldSoundEventId'] === 'string' ? damageEffects['WorldSoundEventId'] as string : ''} onChange={(e) => updateDamageEffects({ WorldSoundEventId: e.target.value || undefined })} style={INPUT_STYLE} placeholder="SFX_Impact" />
                            </div>
                            <div style={FIELD_WRAP}>
                                <span style={LABEL_STYLE}>Local Sound Event ID</span>
                                <input type="text" value={typeof damageEffects['LocalSoundEventId'] === 'string' ? damageEffects['LocalSoundEventId'] as string : ''} onChange={(e) => updateDamageEffects({ LocalSoundEventId: e.target.value || undefined })} style={INPUT_STYLE} placeholder="SFX_Impact_Local" />
                            </div>
                        </div>
                        <div style={FIELD_WRAP}>
                            <span style={LABEL_STYLE}>World Particles</span>
                            <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>
                                {'JSON array of particle payloads, for example [{"SystemId":"Impact_Blade_01"}].'}
                            </div>
                            <textarea
                                key={`damage-entity-world-particles-${JSON.stringify(damageEffects['WorldParticles'] ?? [])}`}
                                rows={4}
                                defaultValue={damageEffects['WorldParticles'] === undefined ? '' : JSON.stringify(damageEffects['WorldParticles'], null, 2)}
                                onBlur={(e) => {
                                    const raw = e.target.value.trim()
                                    if (!raw) {
                                        updateDamageEffects({ WorldParticles: undefined })
                                        return
                                    }
                                    try {
                                        const parsed = JSON.parse(raw)
                                        if (Array.isArray(parsed)) updateDamageEffects({ WorldParticles: parsed })
                                    } catch {
                                    }
                                }}
                                style={TEXTAREA_STYLE}
                                placeholder='[
  { "SystemId": "Impact_Blade_01" }
]'
                                spellCheck={false}
                            />
                        </div>
                        <FieldSection title="Knockback" description="Directional push applied to the hit target. Leave empty to disable knockback.">
                            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                                {[
                                    ['Force', 'Force', '0.5'],
                                    ['RelativeX', 'Relative X', '-5'],
                                    ['RelativeZ', 'Relative Z', '-5'],
                                    ['VelocityY', 'Velocity Y', '5'],
                                ].map(([fieldKey, fieldLabel, placeholder]) => (
                                    <div key={fieldKey} style={FIELD_WRAP}>
                                        <span style={LABEL_STYLE}>{fieldLabel}</span>
                                        <input type="number" step="any" value={knockback[fieldKey] === undefined ? '' : String(knockback[fieldKey])} onChange={(e) => updateKnockbackField(fieldKey, parseOptionalNumber(e.target.value))} style={INPUT_STYLE} placeholder={placeholder} />
                                    </div>
                                ))}
                            </div>
                            <JsonObjectExtrasField label="Additional Knockback Fields" description="Optional extra knockback keys preserved alongside the common force vector fields." value={knockbackExtras} onChange={updateKnockbackExtras} placeholder='{
  "$Comment": "..."
}' />
                        </FieldSection>
                        <JsonObjectExtrasField label="Additional DamageEffects Fields" description="Optional advanced hit-feedback keys preserved alongside sounds, particles and knockback." value={damageEffectsExtras} onChange={(nextValue) => updateDamageEffects({ WorldSoundEventId: damageEffects['WorldSoundEventId'], LocalSoundEventId: damageEffects['LocalSoundEventId'], WorldParticles: damageEffects['WorldParticles'], Knockback: damageEffects['Knockback'] }, nextValue)} placeholder='{
  "$Comment": "..."
}' />
                    </FieldSection>
                    <EntityStatsOnHitEditor value={draft['EntityStatsOnHit']} onChange={(nextValue) => onChange('EntityStatsOnHit', nextValue)} />
                </>
            ),
        }
    }

    if (nodeType === 'ModifyInventory') {
        const behaviorFields: FieldDef[] = [
            { key: 'AdjustHeldItemQuantity', label: 'Adjust Held Item Quantity', type: 'number', description: 'Use -1 for standard item consumption' },
            { key: 'AdjustHeldItemDurability', label: 'Adjust Held Item Durability', type: 'number', description: 'Durability delta applied to the held item' },
            { key: 'BrokenItem', label: 'Broken Item', type: 'string', description: 'Replacement item granted when the held item breaks' },
            { key: 'NotifyOnBreak', label: 'Notify On Break', type: 'boolean' },
            { key: 'NotifyOnBreakMessage', label: 'Notify On Break Message', type: 'string', description: 'Optional message shown when the held item breaks' },
        ]

        return {
            handledKeys: new Set(['AdjustHeldItemQuantity', 'AdjustHeldItemDurability', 'ItemToRemove', 'ItemToAdd', 'BrokenItem', 'NotifyOnBreak', 'NotifyOnBreakMessage', 'Next', 'Failed']),
            content: (
                <>
                    <FieldSection title="Modify Inventory" description="Common inventory mutations for consumables, ammo checks and breakable tools.">
                        {behaviorFields.map((field) => renderField(field, draft[field.key], onChange))}
                    </FieldSection>
                    <ItemStackEditor title="Item To Remove" description="Specific inventory item removed before continuing, commonly used for ammo or ingredients." value={draft['ItemToRemove']} onChange={(nextValue) => onChange('ItemToRemove', nextValue)} />
                    <ItemStackEditor title="Item To Add" description="Specific inventory item granted by this interaction." value={draft['ItemToAdd']} onChange={(nextValue) => onChange('ItemToAdd', nextValue)} />
                    <InteractionValueSection title="Next" description="Follow-up interaction when the inventory modification succeeds. This is often an inline interaction object in Hytale assets." value={draft['Next']} onChange={(nextValue) => onChange('Next', nextValue)} />
                    <InteractionValueSection title="Failed" description="Fallback interaction when the required item is missing or the removal fails." value={draft['Failed']} onChange={(nextValue) => onChange('Failed', nextValue)} />
                </>
            ),
        }
    }

    if (nodeType === 'ChangeStat') {
        const behaviorFields: FieldDef[] = [
            { key: 'Behaviour', label: 'Behaviour', type: 'string', description: 'How the stat change is applied, e.g. Add, Set or Subtract' },
            { key: 'ValueType', label: 'Value Type', type: 'string', description: 'Absolute, Percentage or PercentageCurrent' },
            { key: 'RunTime', label: 'RunTime (s)', type: 'number', description: 'Optional execution timing used by some spell/item interactions' },
            { key: 'Effects', label: 'Effects', type: 'effects', description: 'Optional audiovisual feedback emitted by the stat change' },
        ]

        return {
            handledKeys: new Set(['Behaviour', 'ValueType', 'StatModifiers', 'RunTime', 'Effects', 'Next', 'Failed']),
            content: (
                <>
                    <FieldSection title="Change Stat" description="Directly modify one or more entity stats for healing, costs, regen delays or scripted effects.">
                        {behaviorFields.map((field) => renderField(field, draft[field.key], onChange))}
                    </FieldSection>
                    <StatModifiersSection title="Stat Modifiers" description="Map of stat IDs to deltas or values, for example Health, Mana or StaminaRegenDelay." value={draft['StatModifiers']} onChange={(nextValue) => onChange('StatModifiers', nextValue)} />
                    <InteractionValueSection title="Next" description="Follow-up interaction when the stat change succeeds. This is often an inline interaction payload in real assets." value={draft['Next']} onChange={(nextValue) => onChange('Next', nextValue)} />
                    <InteractionValueSection title="Failed" description="Fallback interaction for the rare cases where this stat change has an explicit failure path." value={draft['Failed']} onChange={(nextValue) => onChange('Failed', nextValue)} />
                </>
            ),
        }
    }

    if (nodeType === 'ChangeStatWithModifier') {
        const modifierFields: FieldDef[] = [
            { key: 'InteractionModifierId', label: 'Interaction Modifier ID', type: 'string', description: 'Modifier source used to scale the stat changes' },
            { key: 'ValueType', label: 'Value Type', type: 'string', description: 'Absolute or Percentage in the documented game files' },
        ]

        return {
            handledKeys: new Set(['InteractionModifierId', 'ValueType', 'StatModifiers', 'Next']),
            content: (
                <>
                    <FieldSection title="Change Stat With Modifier" description="Apply stat changes that scale through an interaction modifier such as Dodge or another ability-specific modifier.">
                        {modifierFields.map((field) => renderField(field, draft[field.key], onChange))}
                    </FieldSection>
                    <StatModifiersSection title="Stat Modifiers" description="Base stat deltas before the interaction modifier is applied." value={draft['StatModifiers']} onChange={(nextValue) => onChange('StatModifiers', nextValue)} />
                    <InteractionValueSection title="Next" description="Optional follow-up interaction after the modifier-scaled stat change." value={draft['Next']} onChange={(nextValue) => onChange('Next', nextValue)} />
                </>
            ),
        }
    }

    if (nodeType === 'StatsCondition') {
        const conditionFields: FieldDef[] = [
            { key: 'ValueType', label: 'Value Type', type: 'string', description: 'Absolute or Percent depending on the cost interpretation' },
            { key: 'LessThan', label: 'Less Than', type: 'boolean', description: 'Check whether the stat is below the threshold instead of above it' },
            { key: 'Lenient', label: 'Lenient', type: 'boolean', description: 'Optional relaxed evaluation flag observed in some assets' },
            { key: 'RunTime', label: 'RunTime (s)', type: 'number', description: 'Optional timing field observed on some conditional interactions' },
            { key: 'Effects', label: 'Effects', type: 'effects', description: 'Optional feedback emitted during the condition evaluation' },
        ]

        return {
            handledKeys: new Set(['Costs', 'ValueType', 'LessThan', 'Lenient', 'RunTime', 'Effects', 'Next', 'Failed']),
            content: (
                <>
                    <FieldSection title="Stats Condition" description="Check one or more stats before continuing, typically for mana, stamina or health thresholds.">
                        {conditionFields.map((field) => renderField(field, draft[field.key], onChange))}
                    </FieldSection>
                    <CostsSection title="Costs" description="Required stat thresholds for this condition. All configured stats must pass." value={draft['Costs']} onChange={(nextValue) => onChange('Costs', nextValue)} />
                    <InteractionValueSection title="Next" description="Interaction executed when the stat check succeeds. Inline payloads are common in real assets." value={draft['Next']} onChange={(nextValue) => onChange('Next', nextValue)} />
                    <InteractionValueSection title="Failed" description="Fallback interaction for insufficient resources or failed thresholds." value={draft['Failed']} onChange={(nextValue) => onChange('Failed', nextValue)} />
                </>
            ),
        }
    }

    if (nodeType === 'StatsConditionWithModifier') {
        const modifierFields: FieldDef[] = [
            { key: 'InteractionModifierId', label: 'Interaction Modifier ID', type: 'string', description: 'Modifier source used to scale these stat costs' },
        ]

        return {
            handledKeys: new Set(['Costs', 'InteractionModifierId', 'Next', 'Failed']),
            content: (
                <>
                    <FieldSection title="Stats Condition With Modifier" description="Evaluate stat costs after applying an interaction modifier such as Dodge or Spell_Cost.">
                        {modifierFields.map((field) => renderField(field, draft[field.key], onChange))}
                    </FieldSection>
                    <CostsSection title="Costs" description="Base stat costs before the interaction modifier is applied." value={draft['Costs']} onChange={(nextValue) => onChange('Costs', nextValue)} />
                    <InteractionValueSection title="Next" description="Interaction executed when the modifier-adjusted stat check succeeds." value={draft['Next']} onChange={(nextValue) => onChange('Next', nextValue)} />
                    <InteractionValueSection title="Failed" description="Fallback interaction when the modified stat cost cannot be paid." value={draft['Failed']} onChange={(nextValue) => onChange('Failed', nextValue)} />
                </>
            ),
        }
    }

    if (nodeType === 'EffectCondition') {
        const conditionFields: FieldDef[] = [
            { key: 'Entity', label: 'Entity', type: 'string', description: 'Optional entity target, for example Self or Target' },
            { key: 'Match', label: 'Match', type: 'string', description: 'Any, None or All' },
        ]

        return {
            handledKeys: new Set(['Entity', 'EntityEffectIds', 'Match', 'Next', 'Failed']),
            content: (
                <>
                    <FieldSection title="Effect Condition" description="Check whether an entity has one or more specific status effects before continuing.">
                        {conditionFields.map((field) => renderField(field, draft[field.key], onChange))}
                    </FieldSection>
                    <StringListSection title="Entity Effect IDs" description="List of effect IDs evaluated by this condition." value={draft['EntityEffectIds']} onChange={(nextValue) => onChange('EntityEffectIds', nextValue)} placeholder="Stamina_Broken" />
                    <InteractionValueSection title="Next" description="Interaction executed when the effect check matches. Inline payloads are common in real assets." value={draft['Next']} onChange={(nextValue) => onChange('Next', nextValue)} />
                    <InteractionValueSection title="Failed" description="Fallback interaction when the effect check does not match." value={draft['Failed']} onChange={(nextValue) => onChange('Failed', nextValue)} />
                </>
            ),
        }
    }

    if (nodeType === 'MovementCondition') {
        const directionFields = [
            { key: 'ForwardLeft', label: 'Forward Left' },
            { key: 'Forward', label: 'Forward' },
            { key: 'ForwardRight', label: 'Forward Right' },
            { key: 'Left', label: 'Left' },
            { key: 'Right', label: 'Right' },
            { key: 'BackLeft', label: 'Back Left' },
            { key: 'Back', label: 'Back' },
            { key: 'BackRight', label: 'Back Right' },
        ]

        return {
            handledKeys: new Set(['ForwardLeft', 'Forward', 'ForwardRight', 'Left', 'Right', 'BackLeft', 'Back', 'BackRight', 'Failed']),
            content: (
                <>
                    <LabeledInteractionValueList title="Directional Branches" description="Choose the interaction for each movement direction. Each branch can be a server reference or an inline interaction object." fields={directionFields} draft={draft} onChange={onChange} />
                    <InteractionValueSection title="Failed" description="Fallback interaction when no movement branch matches or the condition cannot resolve a direction." value={draft['Failed']} onChange={(nextValue) => onChange('Failed', nextValue)} />
                </>
            ),
        }
    }

    if (nodeType === 'Condition') {
        const shortcutFields: FieldDef[] = [
            { key: 'RequiredGameMode', label: 'Required Game Mode', type: 'string', description: 'Shortcut root-level check, e.g. Adventure' },
            { key: 'Crouching', label: 'Crouching', type: 'boolean' },
            { key: 'Jumping', label: 'Jumping', type: 'boolean' },
            { key: 'Swimming', label: 'Swimming', type: 'boolean' },
            { key: 'InWater', label: 'In Water', type: 'boolean' },
            { key: 'OnGround', label: 'On Ground', type: 'boolean' },
        ]

        const conditionFields: NestedFieldDef[] = [
            { key: 'EntityType', label: 'Entity Type', type: 'string', placeholder: 'Player' },
            { key: 'Stat', label: 'Stat', type: 'string', placeholder: 'Health' },
            { key: 'Comparison', label: 'Comparison', type: 'string', placeholder: 'GreaterThan' },
            { key: 'Value', label: 'Value', type: 'number', placeholder: '50' },
            { key: 'GameMode', label: 'Game Mode', type: 'string', placeholder: 'Adventure' },
            { key: 'Crouching', label: 'Crouching', type: 'boolean' },
            { key: 'Jumping', label: 'Jumping', type: 'boolean' },
            { key: 'Swimming', label: 'Swimming', type: 'boolean' },
        ]

        return {
            handledKeys: new Set(['RequiredGameMode', 'Crouching', 'Jumping', 'Swimming', 'InWater', 'OnGround', 'Condition']),
            content: (
                <>
                    <FieldSection title="Condition Shortcuts" description="Common root-level checks observed in Hytale assets.">
                        {shortcutFields.map((field) => renderField(field, draft[field.key], onChange))}
                    </FieldSection>
                    <NestedObjectSection objectKey="Condition" title="Nested Condition Object" description="Structured editor for the optional Condition object when you need more specific checks." value={draft['Condition']} fields={conditionFields} onChange={onChange} />
                </>
            ),
        }
    }

    return { content: null, handledKeys: new Set() }
}
