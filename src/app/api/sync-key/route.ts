import { auth } from "@root/auth";
import { NextResponse } from "next/server";
import { generateSyncKey } from "@/lib/syncKey";

/** GET /api/sync-key — returns the sync key for the logged-in admin */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ key: generateSyncKey(session.user.id) });
}
