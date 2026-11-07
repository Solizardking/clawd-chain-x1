// Skill-pack loader for the vendored X1 Agent Skills pack.
//
// The pack lives in agent/skills/ — a vendored copy of
// x1wealth/x1-agent-skills (plugins/x1-agent-skills/skills, Apache-2.0;
// see agent/skills/LICENSE and NOTICE). Each skill is a directory with
// a SKILL.md whose YAML frontmatter carries `name` and `description`.
// This loader indexes the pack at startup so the agent can list its
// skills and hand any skill's full instructions to whatever host runs
// the agent — the same contract the pack's own plugin manifests use.
const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');

function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

function loadSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const file = path.join(SKILLS_DIR, d.name, 'SKILL.md');
      if (!fs.existsSync(file)) return null;
      const md = fs.readFileSync(file, 'utf8');
      const fm = parseFrontmatter(md);
      const extras = fs
        .readdirSync(path.join(SKILLS_DIR, d.name), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
      return {
        id: d.name,
        name: fm.name || d.name,
        description: fm.description || '',
        path: file,
        supportDirs: extras, // references/, evals/, scripts/ where present
        instructions: md,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function getSkill(id) {
  return loadSkills().find((s) => s.id === id || s.name === id) || null;
}

module.exports = { loadSkills, getSkill, SKILLS_DIR };
