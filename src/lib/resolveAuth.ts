import { auth } from "@root/auth";
import { validateSyncKey } from "@/lib/syncKey";

/** Resolve userId from session OR Bearer sync key OR collab cookie.
 *  Returns { userId, isCollaborator } or null if unauthenticated. */
export async function resolveAuth(req: Request): Promise<{ userId: string; isCollaborator: boolean } | null> {
  // 1. Try session first
  const session = await auth();
  if (session?.user?.id) return { userId: session.user.id, isCollaborator: false };

  // 2. Try Bearer sync key
  const authHeader = req.headers.get("Authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match) {
    const userId = await validateSyncKey(match[1].trim());
    if (userId) return { userId, isCollaborator: true };
  }

  // 3. Try sc_collab_key cookie (set by collaborator join flow, also used by sendBeacon)
  const cookieHeader = req.headers.get("Cookie") ?? "";
  const cookieMatch = cookieHeader.match(/sc_collab_key=([0-9a-f]{32})/i);
  if (cookieMatch) {
    const userId = await validateSyncKey(cookieMatch[1]);
    if (userId) return { userId, isCollaborator: true };
  }

  return null;
}
