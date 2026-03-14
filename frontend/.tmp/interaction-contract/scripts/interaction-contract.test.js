import assert from 'node:assert/strict';
import { exportInteractionTree } from '../src/components/graph/interactionExport.js';
import { INTERACTION_CONTRACT_FIXTURES } from './interactionContractFixtures.js';
function expectNoErrors(errors, label) {
    assert.deepEqual(errors, [], `${label} emitted unexpected errors: ${errors.join('; ')}`);
}
function testFixtureContract() {
    for (const fixture of INTERACTION_CONTRACT_FIXTURES) {
        const { json, errors } = exportInteractionTree('internal:graph-root', fixture.nodes, fixture.edges);
        expectNoErrors(errors, fixture.name);
        assert.deepEqual(json, fixture.expected, fixture.name);
    }
}
function main() {
    testFixtureContract();
    console.log('interaction-contract: ok');
}
main();
