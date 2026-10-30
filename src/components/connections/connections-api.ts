import { z } from "zod";
import { ConnectResponse } from "@/contract";
import { getJson, isMock, wait } from "@/components/site/request";

export type ConnectResult = { kind: "redirect"; url: string } | { kind: "mock" };

/** POST /api/connections/:provider/connect → { redirectUrl } (Composio link or the Slack install). */
export async function connect(provider: string): Promise<ConnectResult> {
  if (isMock()) {
    await wait(400);
    return { kind: "mock" };
  }
  const { redirectUrl } = await getJson(`/api/connections/${encodeURIComponent(provider)}/connect`, ConnectResponse, { method: "POST" });
  return { kind: "redirect", url: redirectUrl };
}

const Ok = z.object({ ok: z.literal(true) });

/** POST /api/connections/:provider/disconnect → { ok: true }. */
export async function disconnect(provider: string): Promise<void> {
  if (isMock()) {
    await wait(300);
    return;
  }
  await getJson(`/api/connections/${encodeURIComponent(provider)}/disconnect`, Ok, { method: "POST" });
}

export const categoryLabel: Record<string, string> = {
  mail: "Mail",
  chat: "Chat and approvals",
  crm: "CRM",
  docs: "Sheets and docs",
  calendar: "Calendar",
  ooh: "Out-of-home buying",
};

export const categoryOrder = ["mail", "chat", "crm", "docs", "calendar", "ooh"];

export const realtimeLabel: Record<string, string> = {
  webhook: "webhook: real time",
  trigger: "trigger: provider event",
  poll: "poll: checked every few minutes",
  none: "no read-back",
};
