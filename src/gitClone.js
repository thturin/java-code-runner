'use strict';

const { spawn } = require('child_process');
const fs = require('fs').promises;

// Shallow-clones a repo into destDir. Rejects with a clear error (rather than
// hanging) if the repo is deleted, renamed, or the URL is wrong.
//
// GIT_TERMINAL_PROMPT=0 tells git to fail immediately with "could not read
// Username..." instead of trying to prompt interactively for credentials -
// without it, a private/inaccessible repo hangs until the timeout below
// fires, because stdin is disabled here and can never answer that prompt.
function cloneRepo(cloneUrl, destDir, { timeout = 30000 } = {}) {
  console.log("..........cloning sudent repository..........");
  console.log("..........destination directory -> "+destDir+"..........");

  return new Promise((resolve, reject) => {
    const git = spawn('git', ['clone', '--depth', '1', cloneUrl, destDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    let stderr = '';
    git.stderr.on('data', (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      git.kill('SIGKILL');
      reject(new Error(`git clone timed out after ${timeout}ms`));
    }, timeout);

    git.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`git clone failed: ${stderr.trim() || `exit code ${code}`}`));
    });

    git.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function removeDir(dirPath) {
  console.log("..........removing temp directory..........");
  await fs.rm(dirPath, { recursive: true, force: true });
}

module.exports = { cloneRepo, removeDir };
