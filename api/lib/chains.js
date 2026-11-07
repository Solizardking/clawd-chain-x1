// Chain registry — one entry per SVM chain this codebase can read.
//
// Before this module, every surface carried its own single RPC default
// (api/server.js used one RPC const; brain/ used BRAIN_RPC; the x402
// facilitator used its own config). The registry gives all of them one
// shared, env-overridable source of chain identity: id, display name,
// RPC/WS endpoints, genesis hash, native token, explorer.
//
// Wire format is identical on every entry (Solana JSON-RPC), so the
// dependency-free decoders in api/lib/read.js work unchanged on any
// chain whose programs exist there. Clawd's own programs (agent
// identity 1DREG…, agent tools TLREG…, genesis GNS1S…, shield 2AMyS5…)
// exist only on Clawd Chain; the shared Metaplex/SPL programs
// (CoREENxT…, Tokenkeg…, TokenzQdB…, metaqbxx…, So111…112) run at the
// same addresses on X1 mainnet.
//
// No secrets live here. Endpoints come from env vars; the Solana
// mainnet endpoint is expected to be an Alchemy URL supplied via
// ALCHEMY_RPC_URL and is never printed by this module.

// X1 mainnet backends observed behind the public RPC hostname
// (2026-11-07 probe, docs/x1.md has the full story). The hostname
// rpc.mainnet.x1.xyz is a regional load balancer fronting TWO
// divergent backend families. Family B is mainnet-consistent: its
// feature-set matches the Tachyon cluster nodes and its supply figures
// match independent reporting. Family A is irreconcilable with either.
// fingerprint() tells you which family answered.
const X1_FAMILIES = {
  B: { label: 'mainnet-consistent', featureSet: 3075748243, slotsInEpoch: 216000 },
  A: { label: 'divergent (unverified origin)', featureSet: 2223655621, slotsInEpoch: 432000 },
};

const CHAINS = {
  clawd: {
    id: 'clawd',
    name: 'Clawd Chain',
    rpc: () => process.env.VALIDATOR_RPC || 'https://rpc.clawdchain.trade',
    ws: () => process.env.VALIDATOR_WS || 'wss://rpc.clawdchain.trade',
    genesisHash: 'BjbvUdJLreJzCfVEQZHi3D4QttNyp3P5mNXEvHw56kBP',
    nativeSymbol: 'CLAWD',
    nativeDecimals: 9,
    explorer: 'https://explorer.clawdchain.trade',
    kind: 'testnet', // value-bearing: no — Clawd Chain coins are test assets
  },
  solana: {
    id: 'solana',
    name: 'Solana Mainnet',
    // Powered by the operator's Alchemy endpoint. The URL is a secret:
    // it is read from the environment at call time and must never be
    // logged, printed, or committed. Falls back to the public endpoint
    // only when no Alchemy URL is configured.
    rpc: () => process.env.ALCHEMY_RPC_URL || 'https://api.mainnet-beta.solana.com',
    rpcSource: () => (process.env.ALCHEMY_RPC_URL ? 'alchemy (env)' : 'public fallback'),
    ws: () => process.env.ALCHEMY_WS_URL || 'wss://api.mainnet-beta.solana.com',
    genesisHash: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    nativeSymbol: 'SOL',
    nativeDecimals: 9,
    explorer: 'https://explorer.solana.com',
    kind: 'mainnet',
  },
  x1: {
    id: 'x1',
    name: 'X1 Mainnet',
    rpc: () => process.env.RPC_X1 || 'https://rpc.mainnet.x1.xyz',
    ws: () => process.env.WS_X1 || 'wss://rpc.mainnet.x1.xyz',
    genesisHash: '4SvBP3omtvcCVWdxq1zBY5cDp4wndjsThb6nEMn6iMdN',
    nativeSymbol: 'XNT',
    nativeDecimals: 9, // verified by supply arithmetic — see docs/x1.md
    explorer: 'https://explorer.x1.xyz',
    kind: 'mainnet',
    // WARNING: the default RPC hostname fronts two divergent backend
    // families behind a load balancer (see X1_FAMILIES above and
    // docs/x1.md). Reads are best-effort until a pinned node is used;
    // run fingerprint() and check the verdict before trusting any
    // single read, and never settle payments against the public LB.
    publicRpcWarning:
      'Public X1 RPC is load-balanced across divergent backends; reads are best-effort. Pin a dedicated node for settlement-grade reads.',
  },
};

function listChains() {
  return Object.values(CHAINS).map((c) => ({
    id: c.id,
    name: c.name,
    genesisHash: c.genesisHash,
    nativeSymbol: c.nativeSymbol,
    nativeDecimals: c.nativeDecimals,
    explorer: c.explorer,
    kind: c.kind,
    // Deliberately no rpc field: endpoints can carry credentials
    // (e.g. the Alchemy URL) and listings get logged.
  }));
}

function getChain(id) {
  const c = CHAINS[String(id || '').toLowerCase()];
  if (!c) throw new Error(`unknown chain: ${id} (known: ${Object.keys(CHAINS).join(', ')})`);
  return c;
}

async function rpcCall(url, method, params = [], timeoutMs = 15000) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`RPC HTTP ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(`RPC ${method}: ${j.error.message || j.error.code}`);
  return j.result;
}

// Backend fingerprint for load-balanced SVM endpoints (X1 today).
// Two cheap reads — getVersion (feature-set) + getEpochInfo
// (slotsInEpoch) — identify which backend family answered. Callers
// that need a consistent view should fingerprint on every session and
// refuse to mix families.
async function fingerprint(idOrUrl) {
  const isUrl = /^https?:\/\//.test(String(idOrUrl || ''));
  const url = isUrl ? idOrUrl : getChain(idOrUrl).rpc();
  const [v, e] = await Promise.all([rpcCall(url, 'getVersion'), rpcCall(url, 'getEpochInfo')]);
  const featureSet = v['feature-set'];
  const slotsInEpoch = e.slotsInEpoch;
  let family = 'unknown';
  let verdict = 'unrecognized backend fingerprint — treat reads as unverified';
  for (const [k, f] of Object.entries(X1_FAMILIES)) {
    if (f.featureSet === featureSet && f.slotsInEpoch === slotsInEpoch) {
      family = k;
      verdict = `Family ${k} (${f.label})`;
    }
  }
  if (family === 'B') verdict += ' — safe to read; still best-effort on the public LB';
  if (family === 'A') verdict += ' — DO NOT settle against this backend';
  return {
    featureSet,
    slotsInEpoch,
    epoch: e.epoch,
    absoluteSlot: e.absoluteSlot,
    blockHeight: e.blockHeight,
    solanaCore: v['solana-core'],
    family,
    verdict,
  };
}

module.exports = { CHAINS, X1_FAMILIES, listChains, getChain, rpcCall, fingerprint };
