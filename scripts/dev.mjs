import { spawn, execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFile = promisify(execFileCallback);

const projectRoot = process.cwd();
const isWindows = process.platform === 'win32';
const pnpmCommand = isWindows ? 'pnpm.cmd' : 'pnpm';
const ports = [
  {
    port: 5173,
    label: 'client',
    matchCommand: (command) =>
      command.includes(path.join(projectRoot, 'client')) && command.includes(`${path.sep}vite${path.sep}`),
  },
  {
    port: 3001,
    label: 'server',
    matchCommand: (command) => command.includes(path.join(projectRoot, 'server')),
  },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findListeningPids(port) {
  try {
    const { stdout } = await execFile('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']);
    return stdout
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 1) {
      return [];
    }

    throw error;
  }
}

async function getCommand(pid) {
  const { stdout } = await execFile('ps', ['-p', pid, '-o', 'command=']);
  return stdout.trim();
}

async function waitForPortToClear(port, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if ((await findListeningPids(port)).length === 0) {
      return true;
    }

    await delay(150);
  }

  return false;
}

async function ensurePortAvailable({ port, label, matchCommand }) {
  const listeningPids = await findListeningPids(port);
  if (listeningPids.length === 0) {
    return;
  }

  const processDetails = await Promise.all(
    listeningPids.map(async (pid) => ({
      pid,
      command: await getCommand(pid),
    })),
  );

  const staleProcesses = processDetails.filter(({ command }) => matchCommand(command));

  for (const { pid } of staleProcesses) {
    process.kill(Number(pid), 'SIGTERM');
  }

  if (staleProcesses.length > 0) {
    const cleared = await waitForPortToClear(port);
    if (cleared) {
      console.log(`[dev] Cleared stale ${label} process on port ${port}.`);
      return;
    }
  }

  const remainingPids = await findListeningPids(port);
  if (remainingPids.length === 0) {
    return;
  }

  const remainingDetails = await Promise.all(
    remainingPids.map(async (pid) => ({
      pid,
      command: await getCommand(pid),
    })),
  );

  const summary = remainingDetails
    .map(({ pid, command }) => `- PID ${pid}: ${command}`)
    .join('\n');

  throw new Error(
    `Port ${port} is already in use.\n${summary}\nStop that process or change the local dev port before running dev.`,
  );
}

function pipeWithPrefix(stream, prefix, writer) {
  if (!stream) {
    return;
  }

  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();

    while (buffer.includes('\n')) {
      const newlineIndex = buffer.indexOf('\n');
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      writer.write(`${prefix}${line}\n`);
    }
  });

  stream.on('end', () => {
    if (buffer.length > 0) {
      writer.write(`${prefix}${buffer}\n`);
      buffer = '';
    }
  });
}

function startProcess(name, args) {
  const child = spawn(pnpmCommand, args, {
    cwd: projectRoot,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
  });

  pipeWithPrefix(child.stdout, `[${name}] `, process.stdout);
  pipeWithPrefix(child.stderr, `[${name}] `, process.stderr);
  return child;
}

async function main() {
  await Promise.all(ports.map(ensurePortAvailable));

  const children = [
    { name: 'client', child: startProcess('client', ['--filter', 'client', 'dev']) },
    { name: 'server', child: startProcess('server', ['--filter', 'server', 'start:dev']) },
  ];

  let shuttingDown = false;
  let exitCode = 0;
  let exitSignal = null;

  const terminateChildren = (signal = 'SIGTERM') => {
    for (const { child } of children) {
      if (!child.killed) {
        child.kill(signal);
      }
    }
  };

  const handleSignal = (signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    exitSignal = signal;
    terminateChildren(signal);
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);

  await new Promise((resolve) => {
    let remaining = children.length;

    for (const { name, child } of children) {
      child.on('exit', (code, signal) => {
        remaining -= 1;

        if (!shuttingDown && (code ?? 0) !== 0) {
          shuttingDown = true;
          exitCode = code ?? 1;
          exitSignal = signal ?? null;
          console.error(`[dev] ${name} exited unexpectedly.`);
          terminateChildren(signal ?? 'SIGTERM');
        }

        if (remaining === 0) {
          resolve();
        }
      });
    }
  });

  process.off('SIGINT', handleSignal);
  process.off('SIGTERM', handleSignal);

  if (exitSignal) {
    process.kill(process.pid, exitSignal);
    return;
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
