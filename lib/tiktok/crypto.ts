// lib/tiktok/crypto.ts
//
// Encrypts OAuth tokens before they're written to TikTokAccount — per the
// project brief's security requirement, raw tokens never touch the database
// or any client-side code. Requires TIKTOK_TOKEN_ENCRYPTION_KEY in .env: a
// 32-byte key, base64-encoded. Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
    const raw = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY;
    if (!raw) {
        throw new Error(
            "TIKTOK_TOKEN_ENCRYPTION_KEY is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
        );
    }
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) {
        throw new Error("TIKTOK_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
    }
    return key;
}

/** Encrypts a plaintext token. Output format: base64(iv):base64(authTag):base64(ciphertext) */
export function encryptToken(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(12); // GCM standard IV length
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

/** Decrypts a token produced by encryptToken(). Throws if the value was tampered with. */
export function decryptToken(encoded: string): string {
    const key = getKey();
    const [ivB64, tagB64, dataB64] = encoded.split(":");
    if (!ivB64 || !tagB64 || !dataB64) {
        throw new Error("Malformed encrypted token — expected iv:authTag:ciphertext.");
    }

    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));

    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return decrypted.toString("utf8");
}