'use strict';

// Accepts the common shapes a pasted GitHub URL can take:
//   https://github.com/owner/repo
//   https://github.com/owner/repo.git
//   https://github.com/owner/repo/
//   http://www.github.com/owner/repo
//   git@github.com:owner/repo.git
//   github.com/owner/repo
function parseGithubUrl(url) {
  const trimmed = String(url || '').trim();

  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(\.git)?\/?$/i);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

  const httpMatch = trimmed.match(/github\.com\/([^/]+)\/([^/]+?)(\.git)?\/?$/i);
  if (httpMatch) return { owner: httpMatch[1], repo: httpMatch[2] };

  return null;
}

// Normalizes any recognized input shape into a clonable HTTPS URL.
function toCloneUrl(url) {
  const parsed = parseGithubUrl(url);
  if (!parsed) throw new Error(`Not a recognizable GitHub URL: ${url}`);
  return `https://github.com/${parsed.owner}/${parsed.repo}.git`;
}

module.exports = { parseGithubUrl, toCloneUrl };
