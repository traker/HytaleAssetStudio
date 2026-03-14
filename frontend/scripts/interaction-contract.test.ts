import assert from 'node:assert/strict'

import { exportInteractionTree } from '../src/components/graph/interactionExport.js'
import { INTERACTION_CONTRACT_FIXTURES } from './interactionContractFixtures.js'

function expectNoErrors(errors: string[], label: string): void {
  assert.deepEqual(errors, [], `${label} emitted unexpected errors: ${errors.join('; ')}`)
}

function testFixtureContract(): void {
  for (const fixture of INTERACTION_CONTRACT_FIXTURES) {
    const { json, errors } = exportInteractionTree('internal:graph-root', fixture.nodes, fixture.edges)
    expectNoErrors(errors, fixture.name)
    assert.deepEqual(json, fixture.expected, fixture.name)
  }
}

function main(): void {
  testFixtureContract()
  console.log('interaction-contract: ok')
}

main()