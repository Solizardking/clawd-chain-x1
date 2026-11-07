#!/usr/bin/env node
// clawd-chain-x1 omnichain agent — a small, READ-ONLY demo agent.
//
// It reads state across every chain in the registry
// (api/lib/chains.js): Clawd Chain, Solana mainnet (via the operator's
// Alchemy endpoint, ALCHEMY_RPC_URL), and X1 mainnet (public RPC, with
// a backend-fingerprint check on every X1 read). Its skill pack is the
// vendored X1 Agent Skills pack in agent/skills/ (x1wealth/x1-agent-
// skills, Apache-2.0) — `skills` lists it, `skill <id>` prints one.
//
// READ-ONLY BY DESIGN: there is no keypair loading, no signing code,
// and no sendTransaction path anywhere in this agent. It cannot move
// funds on any chain. See agent/README.md for the full boundary.
//
// Usage:
//   node agent.js chains                 list registered chains
//   node agent.js skills                 list the loaded skill pack
//   node agent.js skill <id>             print one skill's SKILL.md
//   node agent.js check [chain]          block height + version (+ X1 fingerprint)
//   node agent.js balance <chain> <addr> native balance of an address
//   node agent.js overview               check every chain in sequence
const { listChains } = require('../api/lib/chains');
const { loadSkills, getSkill } = require('./lib/skills');
const reads = require('./lib/reads');

const CHAINS = ['clawd', 'solana', 'x1'];

function out(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  switch (cmd) {
    case 'chains':
      out({ chains: listChains(), skillsLoaded: loadSkills().length });
      break;

    case 'skills':
      out({
        pack: 'x1-agent-skills (vendored from x1wealth/x1-agent-skills, Apache-2.0)',
        skills: loadSkills().map(({ id, name, description, supportDirs }) => ({ id, name, description, supportDirs })),
      });
      break;

    case 'skill': {
      const s = getSkill(a);
      if (!s) throw new Error(`unknown skill: ${a} (try: ${loadSkills().map((x) => x.id).join(', ')})`);
      console.log(s.instructions);
      break;
    }

    case 'check': {
      const chain = (a || 'x1').toLowerCase();
      if (chain === 'solana' && !process.env.ALCHEMY_RPC_URL) {
        out({ chain, skipped: 'ALCHEMY_RPC_URL is not set — copy agent/.env.example to .env and fill it in, or export the variable. The endpoint URL is a secret and is never printed.' });
        break;
      }
      out(await reads.check(chain));
      break;
    }

    case 'balance': {
      const chain = (a || '').toLowerCase();
      if (!CHAINS.includes(chain) || !b) throw new Error('usage: node agent.js balance <clawd|solana|x1> <address>');
      if (chain === 'solana' && !process.env.ALCHEMY_RPC_URL) throw new Error('ALCHEMY_RPC_URL is not set (see agent/.env.example)');
      out(await reads.balance(chain, b));
      break;
    }

    case 'overview': {
      const results = [];
      for (const chain of CHAINS) {
        try {
          if (chain === 'solana' && !process.env.ALCHEMY_RPC_URL) {
            results.push({ chain, skipped: 'ALCHEMY_RPC_URL not set' });
            continue;
          }
          results.push(await reads.check(chain));
        } catch (e) {
          results.push({ chain, error: e.message });
        }
      }
      out({ agent: 'clawd-chain-x1 omnichain agent', mode: 'read-only', skillsLoaded: loadSkills().length, chains: results });
      break;
    }

    default:
      console.log(`clawd-chain-x1 omnichain agent (read-only)

  node agent.js chains                  list registered chains
  node agent.js skills                  list the X1 Agent Skills pack
  node agent.js skill <id>              print one skill's instructions
  node agent.js check [chain]           height + version (+ X1 fingerprint); default x1
  node agent.js balance <chain> <addr>  native balance of an address
  node agent.js overview                check clawd + solana + x1

Chains: clawd (Clawd Chain), solana (mainnet via Alchemy), x1 (X1 mainnet).
Solana reads need ALCHEMY_RPC_URL in the environment — see .env.example.`);
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
