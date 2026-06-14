import { spawn } from "node:child_process";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ActionBody = { target?: unknown };

const parseTarget = (body: ActionBody): string =>
  typeof body.target === "string" ? body.target.trim() : "";

const isSupportedTarget = (target: string): boolean =>
  target === "hermes-os" || target === "claw3d";

const queueStop = (): { ok: boolean; error?: string } => {
  try {
    const child = spawn("systemctl", ["stop", "claw3d"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "failed to queue stop" };
  }
};

export async function POST(request: Request) {
  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }

  const target = parseTarget(body);
  if (!target) return NextResponse.json({ error: "target is required" }, { status: 400 });
  if (!isSupportedTarget(target)) return NextResponse.json({ error: "unsupported target" }, { status: 400 });

  const queued = queueStop();
  if (!queued.ok) {
    return NextResponse.json(
      { error: "ACTION_EXECUTION_FAILED", action: "stop", target, detail: queued.error ?? null },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, accepted: true, action: "service.stop", target });
}
