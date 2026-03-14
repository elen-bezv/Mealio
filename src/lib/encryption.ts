/**
 * Secure encryption for store session data (cookies/tokens).
 * Never store plain passwords. Use env ENCRYPTION_KEY (32-byte hex).
 */

const ALG = "AES-GCM";
const KEY_LEN = 256;
const IV_LEN = 12;
const SALT_LEN = 16;

function getKeyMaterial(): Promise<CryptoKey> {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("ENCRYPTION_KEY must be set (32+ chars) for store sessions");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret.slice(0, 32)),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
}

export async function encryptSessionData(plain: string): Promise<string> {
  const keyMaterial = await getKeyMaterial();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALG, length: KEY_LEN },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const encoded = new TextEncoder().encode(plain);
  const cipher = await crypto.subtle.encrypt(
    { name: ALG, iv, tagLength: 128 },
    key,
    encoded
  );
  const combined = new Uint8Array(salt.length + iv.length + cipher.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(cipher), salt.length + iv.length);
  return Buffer.from(combined).toString("base64");
}

export async function decryptSessionData(encrypted: string): Promise<string> {
  const keyMaterial = await getKeyMaterial();
  const combined = Buffer.from(encrypted, "base64");
  const salt = combined.subarray(0, SALT_LEN);
  const iv = combined.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const cipher = combined.subarray(SALT_LEN + IV_LEN);

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALG, length: KEY_LEN },
    false,
    ["decrypt"]
  );

  const dec = await crypto.subtle.decrypt(
    { name: ALG, iv, tagLength: 128 },
    key,
    cipher
  );
  return new TextDecoder().decode(dec);
}
