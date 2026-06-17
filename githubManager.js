const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');

class GitHubManager {
  constructor(options = {}) {
    this.systemDir = options.systemDir || process.cwd();
    this.getProjectRoot = typeof options.getProjectRoot === 'function'
      ? options.getProjectRoot
      : () => process.cwd();
    this.authFile = path.join(this.systemDir, 'github-auth.json');
    this.state = {
      clientId: '',
      accessToken: '',
      tokenType: 'bearer',
      scope: '',
      deviceFlow: null
    };
  }

  async init() {
    await fs.ensureDir(this.systemDir);
    if (await fs.pathExists(this.authFile)) {
      try {
        const data = await fs.readJson(this.authFile);
        this.state = { ...this.state, ...data };
      } catch {
        // ignore malformed auth file and keep defaults
      }
    }
  }

  async persist() {
    await fs.writeJson(this.authFile, this.state, { spaces: 2 });
  }

  resolveClientId() {
    return process.env.GITHUB_CLIENT_ID || this.state.clientId || '';
  }

  async setClientId(clientId) {
    this.state.clientId = String(clientId || '').trim();
    await this.persist();
    return { ok: true, client_id_set: !!this.state.clientId };
  }

  async setAccessToken(token, scope = 'repo') {
    this.state.accessToken = String(token || '').trim();
    this.state.tokenType = 'bearer';
    this.state.scope = String(scope || 'repo');
    this.state.deviceFlow = null;
    await this.persist();
    return { ok: true, authenticated: !!this.state.accessToken };
  }

  headers(extra = {}) {
    const out = {
      Accept: 'application/json',
      'User-Agent': 'FA7-OS-GitHub-Manager'
    };
    if (this.state.accessToken) {
      out.Authorization = `Bearer ${this.state.accessToken}`;
    }
    return { ...out, ...extra };
  }

  async startDeviceFlow(scopes = ['repo']) {
    const clientId = this.resolveClientId();
    if (!clientId) {
      throw new Error('Missing GitHub OAuth client_id. Set GITHUB_CLIENT_ID or call config endpoint.');
    }
    const body = new URLSearchParams({
      client_id: clientId,
      scope: Array.isArray(scopes) ? scopes.join(' ') : 'repo'
    });
    const response = await axios.post(
      'https://github.com/login/device/code',
      body.toString(),
      { headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    this.state.deviceFlow = {
      device_code: response.data.device_code,
      user_code: response.data.user_code,
      verification_uri: response.data.verification_uri,
      expires_in: response.data.expires_in,
      interval: response.data.interval || 5,
      started_at: Date.now()
    };
    await this.persist();
    return {
      ok: true,
      user_code: response.data.user_code,
      verification_uri: response.data.verification_uri,
      expires_in: response.data.expires_in,
      interval: response.data.interval || 5
    };
  }

  async pollDeviceFlow() {
    const clientId = this.resolveClientId();
    if (!clientId) throw new Error('Missing GitHub OAuth client_id.');
    if (!this.state.deviceFlow?.device_code) throw new Error('No active device flow.');

    const body = new URLSearchParams({
      client_id: clientId,
      device_code: this.state.deviceFlow.device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    });
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      body.toString(),
      { headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    if (response.data.error) {
      return {
        ok: false,
        status: response.data.error,
        error_description: response.data.error_description || ''
      };
    }

    this.state.accessToken = response.data.access_token || '';
    this.state.tokenType = response.data.token_type || 'bearer';
    this.state.scope = response.data.scope || '';
    this.state.deviceFlow = null;
    await this.persist();

    return {
      ok: true,
      authenticated: !!this.state.accessToken,
      scope: this.state.scope
    };
  }

  async getViewer() {
    if (!this.state.accessToken) return null;
    const response = await axios.get('https://api.github.com/user', { headers: this.headers() });
    return response.data;
  }

  async getAuthStatus() {
    if (!this.state.accessToken) {
      return {
        ok: true,
        authenticated: false,
        has_active_device_flow: !!this.state.deviceFlow?.device_code,
        client_id_set: !!this.resolveClientId()
      };
    }
    try {
      const viewer = await this.getViewer();
      return {
        ok: true,
        authenticated: true,
        scope: this.state.scope,
        user: { login: viewer.login, id: viewer.id, html_url: viewer.html_url }
      };
    } catch {
      return {
        ok: true,
        authenticated: false,
        token_invalid: true,
        client_id_set: !!this.resolveClientId()
      };
    }
  }

  async logout() {
    this.state.accessToken = '';
    this.state.scope = '';
    this.state.deviceFlow = null;
    await this.persist();
    return { ok: true, authenticated: false };
  }

  async createRepository(payload = {}) {
    const isPrivate = typeof payload.private === 'boolean' ? payload.private : true;
    const response = await axios.post(
      'https://api.github.com/user/repos',
      {
        name: payload.name,
        description: payload.description || '',
        private: isPrivate,
        auto_init: !!payload.auto_init
      },
      { headers: this.headers() }
    );
    return {
      ok: true,
      repository: {
        name: response.data.name,
        full_name: response.data.full_name,
        private: response.data.private,
        html_url: response.data.html_url,
        clone_url: response.data.clone_url
      }
    };
  }

  async setRepositoryVisibility(owner, repo, isPrivate) {
    const response = await axios.patch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { private: !!isPrivate },
      { headers: this.headers() }
    );
    return {
      ok: true,
      repository: {
        full_name: response.data.full_name,
        private: response.data.private,
        html_url: response.data.html_url
      }
    };
  }

  runGit(command, cwd) {
    return new Promise((resolve) => {
      exec(command, { cwd }, (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
          error: error ? String(error.message || error) : null
        });
      });
    });
  }

  async ensureRepoExists(owner, repo, description, isPrivate, options = {}) {
    const autoInit = !!options.autoInit;
    try {
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers: this.headers() });
      return response.data;
    } catch (e) {
      if (e?.response?.status !== 404) throw e;
      const createRes = await axios.post(
        'https://api.github.com/user/repos',
        { name: repo, description: description || '', private: !!isPrivate, auto_init: autoInit },
        { headers: this.headers() }
      );
      return createRes.data;
    }
  }

  async publishWithGit(payload = {}) {
    if (!this.state.accessToken) throw new Error('GitHub is not authenticated.');
    const projectRoot = path.resolve(payload.projectRoot || this.getProjectRoot());
    const repoName = String(payload.repoName || '').trim();
    if (!repoName) throw new Error('repoName is required.');

    const viewer = await this.getViewer();
    const owner = payload.owner || viewer.login;
    const isPrivate = typeof payload.private === 'boolean' ? payload.private : true;
    const remote = await this.ensureRepoExists(owner, repoName, payload.description || '', isPrivate, { autoInit: false });
    if (typeof remote.private === 'boolean' && remote.private !== isPrivate) {
      await this.setRepositoryVisibility(owner, repoName, isPrivate);
    }

    if (!(await fs.pathExists(path.join(projectRoot, '.git')))) {
      const init = await this.runGit('git init', projectRoot);
      if (!init.ok) throw new Error(init.error || init.stderr || 'git init failed');
    }

    await this.runGit('git add .', projectRoot);
    const commitMessage = payload.commitMessage || 'Initial commit from FA7 OS';
    const commit = await this.runGit(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, projectRoot);
    if (!commit.ok && !/nothing to commit/i.test(commit.stderr || '')) {
      throw new Error(commit.stderr || commit.error || 'git commit failed');
    }

    const branch = payload.branch || 'main';
    await this.runGit(`git branch -M ${branch}`, projectRoot);

    const tokenRemote = `https://x-access-token:${this.state.accessToken}@github.com/${owner}/${repoName}.git`;
    const push = await this.runGit(`git push "${tokenRemote}" HEAD:${branch}`, projectRoot);
    if (!push.ok) {
      throw new Error(push.stderr || push.error || 'git push failed');
    }

    return {
      ok: true,
      mode: 'git',
      repository: {
        full_name: remote.full_name,
        private: remote.private,
        html_url: remote.html_url
      },
      pushed_branch: branch
    };
  }

  async collectPublishableFiles(projectRoot, options = {}) {
    const maxFiles = Number(options.maxFiles || 1000);
    const maxFileBytes = Number(options.maxFileBytes || 900 * 1024);
    const excludedDirs = new Set([
      '.git', 'node_modules', 'dist', 'build', '.gradle', '.idea', '.DS_Store'
    ]);
    const out = [];
    const skipped = [];

    async function walk(base, rel = '') {
      if (out.length >= maxFiles) return;
      const abs = path.join(base, rel);
      const entries = await fs.readdir(abs, { withFileTypes: true });
      for (const entry of entries) {
        if (out.length >= maxFiles) break;
        const nextRel = rel ? path.join(rel, entry.name) : entry.name;
        const nextAbs = path.join(base, nextRel);
        if (entry.isDirectory()) {
          if (excludedDirs.has(entry.name)) continue;
          await walk(base, nextRel);
        } else if (entry.isFile()) {
          const st = await fs.stat(nextAbs);
          if (st.size > maxFileBytes) {
            skipped.push({ path: nextRel, reason: `file too large (${st.size} bytes)` });
            continue;
          }
          out.push({ relPath: nextRel.replace(/\\/g, '/'), absPath: nextAbs, size: st.size });
        }
      }
    }

    await walk(projectRoot, '');
    return { files: out, skipped };
  }

  async getContentSha(owner, repo, relPath, branch) {
    try {
      const resp = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(relPath).replace(/%2F/g, '/')}`,
        { headers: this.headers(), params: { ref: branch } }
      );
      return resp.data?.sha || null;
    } catch (e) {
      if (e?.response?.status === 404) return null;
      throw e;
    }
  }

  async putContent(owner, repo, relPath, contentBase64, message, branch, sha) {
    const payload = {
      message,
      content: contentBase64,
      branch
    };
    if (sha) payload.sha = sha;
    const resp = await axios.put(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(relPath).replace(/%2F/g, '/')}`,
      payload,
      { headers: this.headers() }
    );
    return resp.data;
  }

  async publishWithApi(payload = {}) {
    if (!this.state.accessToken) throw new Error('GitHub is not authenticated.');
    const projectRoot = path.resolve(payload.projectRoot || this.getProjectRoot());
    const repoName = String(payload.repoName || '').trim();
    if (!repoName) throw new Error('repoName is required.');

    const viewer = await this.getViewer();
    const owner = payload.owner || viewer.login;
    let branch = payload.branch || '';
    const commitMessage = payload.commitMessage || 'Publish project files from FA7 OS';
    const isPrivate = typeof payload.private === 'boolean' ? payload.private : true;
    const remote = await this.ensureRepoExists(owner, repoName, payload.description || '', isPrivate, { autoInit: true });
    if (typeof remote.private === 'boolean' && remote.private !== isPrivate) {
      await this.setRepositoryVisibility(owner, repoName, isPrivate);
    }
    if (!remote.default_branch && !branch) {
      return {
        ok: false,
        mode: 'api',
        error: 'Repository has no default branch. Initialize repository or provide a valid existing branch.',
        repository: {
          full_name: remote.full_name,
          private: isPrivate,
          html_url: remote.html_url
        }
      };
    }
    branch = branch || remote.default_branch || 'main';

    const { files, skipped } = await this.collectPublishableFiles(projectRoot, {
      maxFiles: payload.maxFiles,
      maxFileBytes: payload.maxFileBytes
    });
    if (!files.length) {
      return {
        ok: false,
        mode: 'api',
        error: 'No publishable files found.',
        skipped
      };
    }

    const uploaded = [];
    for (const f of files) {
      const raw = await fs.readFile(f.absPath);
      const contentBase64 = raw.toString('base64');
      const sha = await this.getContentSha(owner, repoName, f.relPath, branch);
      await this.putContent(
        owner,
        repoName,
        f.relPath,
        contentBase64,
        `${commitMessage}: ${f.relPath}`,
        branch,
        sha
      );
      uploaded.push({ path: f.relPath, size: f.size, updated: !!sha });
    }

    return {
      ok: true,
      mode: 'api',
      repository: {
        full_name: remote.full_name,
        private: isPrivate,
        html_url: remote.html_url
      },
      branch,
      uploaded_count: uploaded.length,
      skipped_count: skipped.length,
      uploaded,
      skipped
    };
  }
}

module.exports = GitHubManager;
