// Read flows for the omnichain agent — one per registered chain, all
// read-only JSON-RPC. Chain identity and endpoints come from the shared
// registry in api/lib/chains.js; nothing here holds a key, signs, or
// submits a transaction (those methods simply do not exist in this
// codebase).
const { getChain, rpcCall, fingerprint } = require('../../api/lib/chains');

const isAddr = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s || '');

async function blockHeight(chainId) {
  const c = getChain(chainId);
  return rpcCall(c.rpc(), 'getBlockHeight', [{ commitment: 'confirmed' }]);
}

async function version(chainId) {
  const c = getChain(chainId);
  const v = await rpcCall(c.rpc(), 'getVersion');
  return v['solana-core'];
}

// Balance of any address, formatted in the chain's native token.
async function balance(chainId, address) {
  if (!isAddr(address)) throw new Error(`invalid address: ${address}`);
  const c = getChain(chainId);
  const b = await rpcCall(c.rpc(), 'getBalance', [address, { commitment: 'confirmed' }]);
  return {
    chain: c.id,
    address,
    lamports: b.value,
    amount: b.value / 10 ** c.nativeDecimals,
    symbol: c.nativeSymbol,
    explorer: `${c.explorer}/address/${address}`,
  };
}

// Per-chain health snapshot. X1 additionally gets a backend
// fingerprint: the public RPC hostname load-balances two divergent
// backend families, so an X1 read without a fingerprint verdict is
// only half a read (see docs/x1.md).
async function check(chainId) {
  const c = getChain(chainId);
  const out = {
    chain: c.id,
    name: c.name,
    kind: c.kind,
    nativeSymbol: c.nativeSymbol,
    genesisHash: c.genesisHash,
    endpoint: chainId === 'solana' ? c.rpcSource() : c.rpc(),
  };
  out.blockHeight = await blockHeight(chainId);
  out.version = await version(chainId);
  if (chainId === 'x1') {
    out.fingerprint = await fingerprint('x1');
    if (c.publicRpcWarning) out.warning = c.publicRpcWarning;
  }
  return out;
}

module.exports = { blockHeight, version, balance, check, isAddr };
