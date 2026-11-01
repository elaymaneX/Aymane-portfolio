// Where the admin panel reads and writes posts, projects and images.
// On Vercel: the GitHub repository (GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH); each save is one
// commit, which triggers a new deployment. In local development without a token: the files on disk.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPO || 'elaymaneX/Aymane-portfolio';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

export const repoReady = Boolean(TOKEN) || !process.env.VERCEL;

async function github(path, init = {}) {
  const response = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body && { 'Content-Type': 'application/json' }),
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub ${init.method ?? 'GET'} ${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

const githubRepo = {
  // Every file path under a folder, from one recursive tree listing
  async list(folder) {
    const tree = await github(`/git/trees/${BRANCH}?recursive=1`);
    return (tree?.tree ?? []).filter(item => item.type === 'blob' && item.path.startsWith(`${folder}/`)).map(item => item.path);
  },
  async read(path) {
    const file = await github(`/contents/${path}?ref=${BRANCH}`);
    return file ? Buffer.from(file.content, 'base64').toString('utf8') : null;
  },
  // changes: [{ path, text } | { path, base64 } | { path, remove: true }] -> one commit
  async commit(changes, message) {
    const ref = await github(`/git/ref/heads/${BRANCH}`);
    const head = await github(`/git/commits/${ref.object.sha}`);
    const tree = [];
    for (const change of changes) {
      if (change.remove) {
        tree.push({ path: change.path, mode: '100644', type: 'blob', sha: null });
        continue;
      }
      const blob = await github('/git/blobs', {
        method: 'POST',
        body: JSON.stringify(change.base64 !== undefined
          ? { content: change.base64, encoding: 'base64' }
          : { content: change.text, encoding: 'utf-8' }),
      });
      tree.push({ path: change.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const newTree = await github('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
    const commit = await github('/git/commits', {
      method: 'POST',
      body: JSON.stringify({ message, tree: newTree.sha, parents: [ref.object.sha] }),
    });
    await github(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
  },
};

const root = process.cwd();
const localRepo = {
  async list(folder) {
    const out = [];
    const walk = async dir => {
      for (const entry of await readdir(join(root, dir), { withFileTypes: true }).catch(() => [])) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) await walk(path);
        else out.push(path);
      }
    };
    await walk(folder);
    return out;
  },
  read: path => readFile(join(root, path), 'utf8').catch(() => null),
  async commit(changes) {
    for (const change of changes) {
      const file = join(root, change.path);
      if (change.remove) {
        await rm(file, { force: true });
        continue;
      }
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, change.base64 !== undefined ? Buffer.from(change.base64, 'base64') : change.text);
    }
  },
};

export const repo = TOKEN ? githubRepo : localRepo;
