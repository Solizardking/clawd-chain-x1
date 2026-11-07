# Omnichain Agent — Clawd Chain X1

A small, clean Node.js agent (zero dependencies) that reads state
across every chain registered in [`../api/lib/chains.js`](../api/lib/chains.js):

| Chain | Endpoint | Notes |
|---|---|---|
| Clawd Chain | `VALIDATOR_RPC` (default `https://rpc.clawdchain.trade`) | the home chain |
| Solana mainnet | **`ALCHEMY_RPC_URL`** (Alchemy) | the URL is a secret — env only, never printed or logged |
| X1 mainnet | `RPC_X1` (default `https://rpc.mainnet.x1.xyz`) | every read is paired with a **backend fingerprint** (see below) |

## The read-only boundary

This agent **cannot move funds on any chain**:

- no keypair is ever loaded, generated, or accepted as input;
- there is no signing code and no `sendTransaction` path anywhere;
- the only RPC methods it calls are `getBlockHeight`, `getVersion`,
  `getBalance`, `getEpochInfo` (fingerprint) — all reads.

If you need writes, that is a different agent with a different review.

## Setup

```sh
cd agent
cp .env.example .env        # fill in ALCHEMY_RPC_URL, or export it instead
set -a; . ./.env; set +a    # if you used a .env file
node agent.js overview
```

No `npm install` — there are no dependencies.

## Commands

```sh
node agent.js chains                  # registered chains + skill count
node agent.js skills                  # the loaded skill pack
node agent.js skill build-with-x1     # print one skill's full SKILL.md
node agent.js check x1                # height, version, X1 fingerprint verdict
node agent.js check solana            # height + version via Alchemy
node agent.js balance x1 <address>    # XNT balance of any address
node agent.js balance solana <addr>   # SOL balance via Alchemy
node agent.js overview                # all three chains, one report
```

## Skill pack: X1 Agent Skills

The agent's skill pack is a **vendored copy** of
[x1wealth/x1-agent-skills](https://github.com/x1wealth/x1-agent-skills)
(Apache-2.0, plugin v0.6.1) in [`skills/`](skills/) — cloned from the
upstream repo and copied from its `plugins/x1-agent-skills/skills/`
directory, with the upstream `LICENSE` and `NOTICE` alongside. The
loader in [`lib/skills.js`](lib/skills.js) indexes every skill's
`SKILL.md` frontmatter at startup; `skills` lists the pack and
`skill <id>` serves the full instructions, the same contract the
pack's own Claude Code / Codex / Grok plugin manifests use.

The six skills (X1 Wealth's family-office pack — household records,
K-1 review, capital calls, meeting prep and follow-up, and building
custom views with X1):

`ask-household-record` · `build-with-x1` · `handle-capital-call` ·
`prepare-meeting` · `record-meeting-outcomes` · `review-k1`

One naming note, stated plainly: **X1 Wealth** (the skills pack, a
family-office product) and **X1 the blockchain** (the SVM chain this
repo integrates) are different projects that share a name. This agent
uses the former as its skill pack, per the repo owner's direction, and
reads the latter through the chain registry. To refresh the pack,
re-clone the upstream repo and re-copy its `skills/` directory.

## The X1 fingerprint

X1's public RPC hostname load-balances **two divergent backend
families** (full write-up in [`../docs/x1.md`](../docs/x1.md)).
`check x1` therefore returns a fingerprint — `feature-set` +
`slotsInEpoch` matched against both known families — with a verdict.
Family B is mainnet-consistent; Family A is not settlement-grade.
Treat every public-LB read as best-effort regardless of verdict.
