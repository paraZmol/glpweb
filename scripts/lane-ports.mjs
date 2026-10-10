// Port layout for parallel work. Every agent or terminal that runs emulators, tests or the
// preview server picks a lane with E2E_LANE=N (0 by default) and gets its own set of ports, so
// two runs never collide. This file is the single source of that layout: the launcher
// (scripts/emulators.mjs), the test helpers, the seed and playwright.config.ts all read it.

export const EMULATOR_HOST = '127.0.0.1';
export const EMULATOR_PROJECT_ID = 'demo-glpweb';
export const MAX_LANE = 9;

/** Lane 0. These are the ports in firebase.json. */
const BASE_PORTS = {
  auth: 9099,
  firestore: 8080,
  firestoreWebsocket: 9150,
  database: 9000,
  hosting: 5000,
  ui: 4000,
  hub: 4400,
  logging: 4500,
};
const LANE_STEP = 10;
const BASE_PREVIEW_PORT = 4173;

/** The lane chosen by E2E_LANE. Throws on anything that is not an integer from 0 to 9. */
export function currentLane(env = process.env) {
  const raw = env.E2E_LANE ?? '0';
  const lane = Number(raw);
  if (!Number.isInteger(lane) || lane < 0 || lane > MAX_LANE) {
    throw new Error(`E2E_LANE must be an integer from 0 to ${MAX_LANE}, got "${raw}"`);
  }
  return lane;
}

/** Ports of a lane: each emulator moves up by 10 per lane, the preview server by 1. */
export function lanePorts(lane) {
  const shifted = Object.entries(BASE_PORTS).map(([name, port]) => [name, port + lane * LANE_STEP]);
  return { ...Object.fromEntries(shifted), preview: BASE_PREVIEW_PORT + lane };
}

/** Ports of the lane in the environment (what tests, seed and helpers should connect to). */
export function emulatorPorts(env = process.env) {
  return lanePorts(currentLane(env));
}

/** Variables the app build reads (src/data/firebase.ts) to reach the emulators of a lane. */
export function viteEmulatorEnv(lane) {
  const ports = lanePorts(lane);
  return {
    VITE_AUTH_EMULATOR_PORT: String(ports.auth),
    VITE_FIRESTORE_EMULATOR_PORT: String(ports.firestore),
    VITE_DATABASE_EMULATOR_PORT: String(ports.database),
  };
}
