import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The public VAPID key is safe to send to browsers; the private key stays server-only.
export async function GET() {
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
}
