// Chain registry tests — offline shape checks only (no live RPC).
const { test } = require('node:test');
const assert = require('node:assert');
const { CHAINS, X1_FAMILIES, listChains, getChain } = require('../api/lib/chains');

test('registry carries clawd, solana and x1', () => {
  assert.deepEqual(Object.keys(CHAINS).sort(), ['clawd', 'solana', 'x1']);
});

test('x1 entry matches verified mainnet facts', () => {
  const x1 = getChain('x1');
  assert.equal(x1.genesisHash, '4SvBP3omtvcCVWdxq1zBY5cDp4wndjsThb6nEMn6iMdN');
  assert.equal(x1.nativeSymbol, 'XNT');
  assert.equal(x1.nativeDecimals, 9);
  assert.equal(x1.explorer, 'https://explorer.x1.xyz');
  assert.equal(x1.rpc(), process.env.RPC_X1 || 'https://rpc.mainnet.x1.xyz');
  assert.ok(x1.publicRpcWarning.includes('best-effort'));
});

test('solana entry never exposes its endpoint in listings', () => {
  const listed = listChains();
  for (const c of listed) assert.ok(!('rpc' in c), `${c.id} listing leaks an endpoint field`);
  assert.equal(getChain('solana').genesisHash, '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp');
});

test('fingerprint families are the two observed backend families', () => {
  assert.equal(X1_FAMILIES.B.featureSet, 3075748243);
  assert.equal(X1_FAMILIES.B.slotsInEpoch, 216000);
  assert.equal(X1_FAMILIES.A.featureSet, 2223655621);
  assert.equal(X1_FAMILIES.A.slotsInEpoch, 432000);
});

test('unknown chain throws with the known list', () => {
  assert.throws(() => getChain('nope'), /unknown chain: nope/);
});
