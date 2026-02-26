/**
 * Agent wallet generation and encryption.
 * Each agent gets a unique Ethereum keypair; the private key is stored
 * AES-256-GCM encrypted using the AGENT_ENCRYPTION_KEY env var.
 *
 * Uses ethers.js v5 for wallet generation to ensure correct keccak256
 * hashing (Node.js crypto sha3-256 is NOT Ethereum's keccak256).
 */
import crypto from "crypto";
import { ethers } from "ethers";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.AGENT_ENCRYPTION_KEY;
  if (!key) throw new Error("AGENT_ENCRYPTION_KEY env var is not set");
  // Accept hex (64 chars = 32 bytes) or base64
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, "hex");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) throw new Error("AGENT_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64)");
  return buf;
}

/** Encrypt a plaintext string with AES-256-GCM */
export function encryptData(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypt an AES-256-GCM encrypted string (generic) */
export function decryptData(encryptedStr: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, ciphertextHex] = encryptedStr.split(":");
  if (!ivHex || !tagHex || !ciphertextHex) {
    throw new Error("Invalid encrypted key format");
  }
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Backward-compat alias — decrypts agent private keys */
export const decryptAgentKey = decryptData;

/**
 * Generate a new Ethereum keypair for an agent.
 * Uses ethers.js Wallet.createRandom() which correctly uses keccak256
 * for address derivation and EIP-55 checksumming.
 */
export function generateAgentWallet(): { address: string; encryptedKey: string } {
  const wallet = ethers.Wallet.createRandom();

  return {
    address: wallet.address, // EIP-55 checksummed, keccak256-derived
    encryptedKey: encryptData(wallet.privateKey),
  };
}
