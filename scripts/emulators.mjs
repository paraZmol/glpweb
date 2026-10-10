// Starts the Firebase emulators on the ports of a lane and cleans up after itself.
//
//   node scripts/emulators.mjs start
//       interactive emulators (what `npm run emulators` does)
//   node scripts/emulators.mjs exec [--only auth,firestore,database] -- <command…>
//       runs <command> with the emulators up, then stops them (what `npm run test:rules` does)
//
// The lane comes from E2E_LANE (0 by default; see scripts/lane-ports.mjs). The launcher:
//   1. refuses to start if something already listens on a port of that lane;
//   2. writes a throwaway Firebase config for the lane (firebase.lane-N.json, git-ignored);
//   3. runs the Firebase CLI with it, handing the lane's ports to the command through the
//      environment;
//   4. always, also after a failure or Ctrl+C, kills whatever still listens on the lane's
//      emulator ports and removes the config. On Windows the CLI leaves the Java emulators
//      running; without this step the next run finds the ports taken.
// It only ever touches the ports of its own lane.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { currentLane, EMULATOR_PROJECT_ID, lanePorts, viteEmulatorEnv } from './lane-ports.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IS_WINDOWS = process.platform === 'win32';
const ALL_EMULATORS = ['auth', 'firestore', 'database', 'hosting'];

/** Port names a run occupies: its emulators plus the hub, the logger and, when shown, the UI. */
function portNamesFor({ mode, only }) {
  const emulators = only
    ? only.split(',').filter((name) => ALL_EMULATORS.includes(name))
    : ALL_EMULATORS;
  const extras = emulators.includes('firestore') ? ['firestoreWebsocket'] : [];
  return [...emulators, ...extras, 'hub', 'logging', ...(mode === 'start' ? ['ui'] : [])];
}
const FREE_PORT_ATTEMPTS = 20;
const FREE_PORT_WAIT_MS = 500;

function parseArguments(argv) {
  const [mode, ...rest] = argv;
  const separator = rest.indexOf('--');
  const flags = separator === -1 ? rest : rest.slice(0, separator);
  const command = separator === -1 ? '' : rest.slice(separator + 1).join(' ');
  const onlyIndex = flags.indexOf('--only');
  const only = onlyIndex === -1 ? null : (flags[onlyIndex + 1] ?? null);
  if (mode !== 'start' && mode !== 'exec') throw new Error('Usage: emulators.mjs start | exec');
  if (mode === 'exec' && command === '') throw new Error('exec needs a command after "--"');
  return { mode, only, command };
}

/** Pids listening on each of `ports`, as [port, pid] pairs. */
function listeners(ports) {
  return IS_WINDOWS ? windowsListeners(ports) : unixListeners(ports);
}

function windowsListeners(ports) {
  const output = execFileSync('netstat', ['-ano', '-p', 'TCP'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const found = [];
  for (const line of output.split('\n')) {
    const match = /^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/.exec(line);
    if (match && ports.includes(Number(match[1]))) found.push([Number(match[1]), Number(match[2])]);
  }
  return found;
}

function unixListeners(ports) {
  const found = [];
  for (const port of ports) {
    try {
      const args = ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'];
      const output = execFileSync('lsof', args, { encoding: 'utf8' });
      for (const pid of output.split('\n').filter(Boolean)) found.push([port, Number(pid)]);
    } catch {
      // lsof exits with 1 when nothing listens on the port (or is not installed).
    }
  }
  return found;
}

function kill(pid) {
  try {
    if (IS_WINDOWS)
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    else process.kill(pid, 'SIGKILL');
  } catch {
    // Already gone.
  }
}

/** Kills what is left on the lane's emulator ports and waits until they are free. */
async function freePorts(ports) {
  for (let attempt = 0; attempt < FREE_PORT_ATTEMPTS; attempt += 1) {
    const left = listeners(ports).filter(([, owner]) => owner !== process.pid);
    if (left.length === 0) return true;
    for (const pid of new Set(left.map(([, owner]) => owner))) kill(pid);
    await sleep(FREE_PORT_WAIT_MS);
  }
  return false;
}

function writeLaneConfig(lane, ports, withUi) {
  const config = JSON.parse(readFileSync(join(ROOT, 'firebase.json'), 'utf8'));
  config.emulators = {
    auth: { port: ports.auth },
    firestore: { port: ports.firestore, websocketPort: ports.firestoreWebsocket },
    database: { port: ports.database },
    hosting: { port: ports.hosting },
    ui: { enabled: withUi, port: ports.ui },
    hub: { port: ports.hub },
    logging: { port: ports.logging },
    singleProjectMode: true,
  };
  const path = join(ROOT, `firebase.lane-${lane}.json`);
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
  return path;
}

function firebaseCommand({ mode, only, command }, configPath) {
  const parts = ['firebase', `emulators:${mode}`, '--config', `"${configPath}"`];
  parts.push('--project', EMULATOR_PROJECT_ID);
  if (only) parts.push('--only', only);
  if (mode === 'exec') parts.push(`"${command.replaceAll('"', '\\"')}"`);
  return parts.join(' ');
}

/** NODE_OPTIONS that preload scripts/hide-windows.cjs into every Node process of the run. */
function hideWindowsNodeOptions(current = '') {
  const preload = join(ROOT, 'scripts', 'hide-windows.cjs').replaceAll('\\', '/');
  return `${current} --require "${preload}"`.trim();
}

/**
 * PATH with the real JDK first. The Firebase CLI starts `java` detached, so it has no console.
 * When `java` resolves to Oracle's javapath shim, the shim re-launches the real java.exe as a
 * child; a console program born from a console-less parent gets a brand new console, and Windows
 * shows it as a terminal window that steals the focus. Pointing PATH at the real JDK removes the
 * re-launch. Returns the env entries to override (none if the JDK cannot be located).
 */
function realJavaFirst(env) {
  if (!IS_WINDOWS) return {};
  try {
    const settings = spawnSync('java', ['-XshowSettings:properties', '-version'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    const home = /java\.home = (.+)/.exec(`${settings.stderr}${settings.stdout}`)?.[1]?.trim();
    if (!home) return {};
    const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'Path';
    return { [pathKey]: `${join(home, 'bin')};${env[pathKey] ?? ''}`, JAVA_HOME: home };
  } catch {
    return {};
  }
}

function run(commandLine, env) {
  return new Promise((resolve) => {
    // windowsHide keeps the shell, the Firebase CLI and the Java emulators it starts on one hidden
    // console. Without it Windows opens a console window per process and steals the focus.
    const child = spawn(commandLine, {
      cwd: ROOT,
      env,
      shell: true,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('error', () => resolve(1));
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const lane = currentLane();
  const ports = lanePorts(lane);
  const emulatorPorts = portNamesFor(options).map((name) => ports[name]);

  const busy = listeners(emulatorPorts);
  if (busy.length > 0) {
    const detail = busy.map(([port, pid]) => `${port} (pid ${pid})`).join(', ');
    throw new Error(
      `Lane ${lane} is in use: something already listens on ${detail}. ` +
        'Stop that run or pick another lane with E2E_LANE=N.',
    );
  }

  const configPath = writeLaneConfig(lane, ports, options.mode === 'start');
  const env = {
    ...process.env,
    E2E_LANE: String(lane),
    ...viteEmulatorEnv(lane),
    NODE_OPTIONS: hideWindowsNodeOptions(process.env.NODE_OPTIONS),
    ...realJavaFirst(process.env),
  };
  let exitCode = 1;
  // Ctrl+C reaches the Firebase CLI too; wait for it and clean up instead of dying mid-way.
  process.on('SIGINT', () => {});
  process.on('SIGTERM', () => {});
  try {
    exitCode = await run(firebaseCommand(options, configPath), env);
  } finally {
    const freed = await freePorts(emulatorPorts);
    rmSync(configPath, { force: true });
    if (!freed) {
      process.stderr.write(`Lane ${lane}: could not free every emulator port.\n`);
      exitCode = exitCode || 1;
    }
  }
  process.exit(exitCode);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
