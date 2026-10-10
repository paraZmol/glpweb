export interface LanePorts {
  auth: number;
  firestore: number;
  firestoreWebsocket: number;
  database: number;
  hosting: number;
  ui: number;
  hub: number;
  logging: number;
  preview: number;
}

type Environment = Record<string, string | undefined>;

export const EMULATOR_HOST: string;
export const EMULATOR_PROJECT_ID: string;
export const MAX_LANE: number;
export function currentLane(env?: Environment): number;
export function lanePorts(lane: number): LanePorts;
export function emulatorPorts(env?: Environment): LanePorts;
export function viteEmulatorEnv(lane: number): Record<string, string>;
