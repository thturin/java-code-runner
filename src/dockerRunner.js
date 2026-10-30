'use strict';

const Docker = require('dockerode');
const docker = new Docker();

const IMAGE = 'java-grading-sandbox:latest';

async function ensureImageExists() {
  console.log("..........confirming docker image exists..........");
  const images = await docker.listImages({ filters: JSON.stringify({ reference: [IMAGE] }) });
  if (images.length === 0) {
    throw new Error(
      `Docker image "${IMAGE}" not found. Build it first with: npm run build-sandbox`
    );
  }
}

// Runs `mvn clean test` for one student's repo inside a fresh, disposable
// container: no network access, capped memory/CPU, and the repo mounted
// read-write (Maven needs to write its build output into target/).
// Tty:true merges stdout+stderr into one plain-text stream - without it,
// dockerode's raw logs come back multiplexed with binary frame headers that
// would corrupt the JUnit-output regex parsing.
// The container runs as root, so files Maven creates (target/) would be owned
// by root on the host. Since student folders are kept for manual re-runs, the
// command hands ownership back to the host user afterwards so those folders
// can be re-tested or deleted without sudo. Skipped on Windows (no getuid).
function mavenCommand() {
  if (typeof process.getuid !== 'function') return 'mvn clean test';
  const owner = `${process.getuid()}:${process.getgid()}`;
  return `mvn clean test; status=$?; chown -R ${owner} /workspace; exit $status`;
}

async function runMavenInContainer(hostRepoDir, { timeout = 60000 } = {}) {
  console.log("..........creating maven container..........");
  console.log("..........hostRepoDir->"+hostRepoDir+"..........");
  const container = await docker.createContainer({
    Image: IMAGE,
    Cmd: ['sh', '-c', mavenCommand()],
    WorkingDir: '/workspace',
    Tty: true,
    HostConfig: {
      Memory: 512 * 1024 * 1024, // 512MB
      CpuQuota: 50000,           // 50% of one CPU
      NetworkMode: 'none',       // no internet access from inside the container
      Binds: [`${hostRepoDir}:/workspace:rw`],//THIS BINDS THE /WORKSPACE DOCKER FOLDER TO 
      AutoRemove: false,         // removed manually below, after logs are collected
    },
  });

  try {
    console.log("..........starting maven container..........");
    await container.start();

    const waitPromise = container.wait();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), timeout)
    );

    let timedOut = false;
    try {
      await Promise.race([waitPromise, timeoutPromise]);
    } catch (err) {
      if (err.message === 'TIMEOUT') {
        timedOut = true;
        await container.kill().catch(() => {});
      } else {
        throw err;
      }
    }

    const logBuffer = await container.logs({ stdout: true, stderr: true });
    const output = logBuffer.toString('utf8');

    return { timedOut, output };
  } finally {
    await container.remove({ force: true }).catch(() => {});
  }
}

module.exports = { ensureImageExists, runMavenInContainer };
