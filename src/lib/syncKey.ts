import { createHmac } from "crypto";
import { prisma } from "./prisma";

const PREFIX = "sc-collab-"; // prevents collisions with other HMAC uses

/** Derive a deterministic 32-char hex sync key from a userId */
export function generateSyncKey(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "fallback";
  return createHmac("sha256", secret)
    .update(PREFIX + userId)
    .digest("hex")
    .slice(0, 32);
}

/** Validate a sync key against all users; returns the owner's userId or null */
export async function validateSyncKey(key: string): Promise<string | null> {
  if (!key || key.length !== 32) return null;
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const user of users) {
    if (generateSyncKey(user.id) === key) return user.id;
  }
  return null;
}
