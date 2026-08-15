import { randomBytes } from 'crypto';

// Cross-device login pairing. A signed-in desktop session mints a short-lived,
// single-use pairing code (see /api/auth/pair/create) which is rendered as a
// QR. The mobile app scans it and redeems the code (see /api/auth/pair/redeem)
// for the OAuth token bundle, so the phone is signed in without re-typing
// anything. The code itself carries no secrets — the tokens never leave the
// server until the matching code is redeemed exactly once.
//
// Storage is an in-process Map. That is sufficient for the single-instance
// (pm2) deployments this webmail targets; a multi-instance deployment would
// need to swap this for a shared store (Redis) keyed the same way. Records are
// tiny and expire within PAIRING_TTL_MS, so memory pressure is negligible.

export interface PairingTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenEndpoint: string;
  clientId: string;
  serverUrl: string;
  serverId: string | null;
}

interface PairingRecord extends PairingTokens {
  expiresAt: number; // epoch ms
}

const PAIRING_TTL_MS = 2 * 60 * 1000; // 2 minutes — enough time to scan
const CODE_BYTES = 32; // 256 bits of entropy

const store = new Map<string, PairingRecord>();

// Drop any expired records. Called on every create/consume so the Map can't
// grow without bound even if codes are minted and never redeemed.
function sweep(now: number): void {
  for (const [code, record] of store) {
    if (record.expiresAt <= now) store.delete(code);
  }
}

export function createPairing(tokens: PairingTokens): { code: string; expiresIn: number } {
  const now = Date.now();
  sweep(now);
  const code = randomBytes(CODE_BYTES).toString('hex');
  store.set(code, { ...tokens, expiresAt: now + PAIRING_TTL_MS });
  return { code, expiresIn: Math.floor(PAIRING_TTL_MS / 1000) };
}

// Single-use: a successful lookup removes the record so a code can never be
// redeemed twice. Returns null for unknown, expired, or already-redeemed codes
// — the caller must not distinguish these to avoid leaking code validity.
export function consumePairing(code: string): PairingTokens | null {
  const now = Date.now();
  sweep(now);
  const record = store.get(code);
  if (!record) return null;
  store.delete(code);
  if (record.expiresAt <= now) return null;
  const { expiresAt: _expiresAt, ...tokens } = record;
  return tokens;
}
