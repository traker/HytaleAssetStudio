import type { Edge, Node } from '@xyflow/react'

export interface InteractionContractFixture {
  name: string
  nodes: Node[]
  edges: Edge[]
  expected: unknown
}

function makeNode(id: string, nodeType: string, rawFields: Record<string, unknown> = {}): Node {
  return {
    id,
    position: { x: 0, y: 0 },
    data: {
      label: id,
      nodeType,
      rawFields,
      isExternal: false,
    },
  } as Node
}

function makeRoot(id = 'internal:graph-root'): Node {
  return {
    id,
    position: { x: 0, y: 0 },
    data: {
      label: 'Root',
      nodeType: 'Root',
      rawFields: {},
      isExternal: false,
    },
  } as Node
}

function makeEdge(source: string, target: string, edgeType: string): Edge {
  return {
    id: `${source}-${edgeType}-${target}`,
    source,
    target,
    data: { edgeType },
  } as Edge
}

export const INTERACTION_CONTRACT_FIXTURES: InteractionContractFixture[] = [
  {
    name: 'Parallel keeps child, fork and next branches',
    nodes: [
      makeRoot(),
      makeNode('internal:parallel', 'Parallel', { RunTime: 1.25, CustomFlag: true }),
      makeNode('internal:child', 'Simple', { RunTime: 0.1 }),
      makeNode('internal:fork', 'Simple', { RunTime: 0.2 }),
      makeNode('internal:next', 'Simple', { RunTime: 0.3 }),
    ],
    edges: [
      makeEdge('internal:graph-root', 'internal:parallel', 'child'),
      makeEdge('internal:parallel', 'internal:child', 'child'),
      makeEdge('internal:parallel', 'internal:fork', 'fork'),
      makeEdge('internal:parallel', 'internal:next', 'next'),
    ],
    expected: {
      Type: 'Parallel',
      RunTime: 1.25,
      CustomFlag: true,
      Interactions: [{ Type: 'Simple', RunTime: 0.1 }],
      ForkInteractions: [{ Type: 'Simple', RunTime: 0.2 }],
      Next: { Type: 'Simple', RunTime: 0.3 },
    },
  },
  {
    name: 'Wielding preserves blocked branch and unknown fields',
    nodes: [
      makeRoot(),
      makeNode('internal:wielding', 'Wielding', { StaminaCost: 4, PreserveMe: { ok: true } }),
      makeNode('internal:next', 'Simple', { RunTime: 0.1 }),
      makeNode('internal:blocked', 'Simple', { RunTime: 0.2 }),
    ],
    edges: [
      makeEdge('internal:graph-root', 'internal:wielding', 'child'),
      makeEdge('internal:wielding', 'internal:next', 'next'),
      makeEdge('internal:wielding', 'internal:blocked', 'blocked'),
    ],
    expected: {
      Type: 'Wielding',
      StaminaCost: 4,
      PreserveMe: { ok: true },
      Next: { Type: 'Simple', RunTime: 0.1 },
      BlockedInteractions: [{ Type: 'Simple', RunTime: 0.2 }],
    },
  },
  {
    name: 'Projectile keeps collision and ground branches',
    nodes: [
      makeRoot(),
      makeNode('internal:projectile', 'Projectile', { Speed: 8, UnknownMeta: 'keep-me' }),
      makeNode('internal:collision', 'Simple', { RunTime: 0.4 }),
      makeNode('internal:ground', 'Simple', { RunTime: 0.5 }),
    ],
    edges: [
      makeEdge('internal:graph-root', 'internal:projectile', 'child'),
      makeEdge('internal:projectile', 'internal:collision', 'collisionNext'),
      makeEdge('internal:projectile', 'internal:ground', 'groundNext'),
    ],
    expected: {
      Type: 'Projectile',
      Speed: 8,
      UnknownMeta: 'keep-me',
      CollisionNext: { Type: 'Simple', RunTime: 0.4 },
      GroundNext: { Type: 'Simple', RunTime: 0.5 },
    },
  },
  {
    name: 'Selector rebuilds hit containers over stale raw fields',
    nodes: [
      makeRoot(),
      makeNode('internal:selector', 'Selector', {
        Selector: { Id: 'Horizontal' },
        HitEntity: { Interactions: [{ Type: 'Simple', RunTime: 999 }] },
        HitBlock: { Interactions: [{ Type: 'Simple', RunTime: 998 }] },
        HitNothing: { Interactions: [{ Type: 'Simple', RunTime: 997 }] },
        KeepThis: 'still-here',
      }),
      makeNode('internal:hit-entity', 'Simple', { RunTime: 0.6 }),
      makeNode('internal:hit-block', 'Simple', { RunTime: 0.7 }),
      makeNode('internal:hit-nothing', 'Simple', { RunTime: 0.8 }),
    ],
    edges: [
      makeEdge('internal:graph-root', 'internal:selector', 'child'),
      makeEdge('internal:selector', 'internal:hit-entity', 'hitEntity'),
      makeEdge('internal:selector', 'internal:hit-block', 'hitBlock'),
      makeEdge('internal:selector', 'internal:hit-nothing', 'hitNothing'),
    ],
    expected: {
      Type: 'Selector',
      Selector: { Id: 'Horizontal' },
      KeepThis: 'still-here',
      HitEntity: { Interactions: [{ Type: 'Simple', RunTime: 0.6 }] },
      HitBlock: { Interactions: [{ Type: 'Simple', RunTime: 0.7 }] },
      HitNothing: { Interactions: [{ Type: 'Simple', RunTime: 0.8 }] },
    },
  },
  {
    name: 'Charging preserves time-dict next values across save',
    nodes: [
      makeRoot(),
      makeNode('internal:charging', 'Charging', {
        Delay: 0.2,
        FailOnDamage: true,
        KeepThis: 'charging-unknown',
        Next: {
          '0.1': { Type: 'Replace', Var: 'ChargeStage_1' },
          '0.35': { Type: 'Replace', Var: 'ChargeStage_2' },
        },
      }),
      makeNode('internal:failed', 'Simple', { RunTime: 0.9 }),
      makeNode('internal:phase-a', 'Replace', { Var: 'ignored-by-dict-time' }),
      makeNode('internal:phase-b', 'Replace', { Var: 'ignored-by-dict-time-too' }),
    ],
    edges: [
      makeEdge('internal:graph-root', 'internal:charging', 'child'),
      makeEdge('internal:charging', 'internal:failed', 'failed'),
      makeEdge('internal:charging', 'internal:phase-a', 'next'),
      makeEdge('internal:charging', 'internal:phase-b', 'next'),
    ],
    expected: {
      Type: 'Charging',
      Delay: 0.2,
      FailOnDamage: true,
      KeepThis: 'charging-unknown',
      Failed: { Type: 'Simple', RunTime: 0.9 },
      Next: {
        '0.1': { Type: 'Replace', Var: 'ChargeStage_1' },
        '0.35': { Type: 'Replace', Var: 'ChargeStage_2' },
      },
    },
  },
  {
    name: 'Replace rebuilds default value from replace edges while saving next branch',
    nodes: [
      makeRoot(),
      makeNode('internal:replace', 'Replace', {
        Var: 'Swing_Left',
        DefaultOk: true,
        KeepThis: { untouched: true },
        DefaultValue: {
          Interactions: [{ Type: 'Simple', RunTime: 999 }],
          $Comment: 'keep-me',
        },
      }),
      {
        id: 'server:ReplaceFallback',
        position: { x: 0, y: 0 },
        data: {
          label: 'ReplaceFallback',
          nodeType: '_ref',
          rawFields: { ServerId: 'ReplaceFallback' },
          isExternal: true,
        },
      } as Node,
      makeNode('internal:default-inline', 'Simple', { RunTime: 0.15 }),
      makeNode('internal:next', 'Simple', { RunTime: 0.45 }),
    ],
    edges: [
      makeEdge('internal:graph-root', 'internal:replace', 'child'),
      makeEdge('internal:replace', 'server:ReplaceFallback', 'replace'),
      makeEdge('internal:replace', 'internal:default-inline', 'replace'),
      makeEdge('internal:replace', 'internal:next', 'next'),
    ],
    expected: {
      Type: 'Replace',
      Var: 'Swing_Left',
      DefaultOk: true,
      KeepThis: { untouched: true },
      DefaultValue: {
        $Comment: 'keep-me',
        Interactions: ['ReplaceFallback', { Type: 'Simple', RunTime: 0.15 }],
      },
      Next: { Type: 'Simple', RunTime: 0.45 },
    },
  },
]