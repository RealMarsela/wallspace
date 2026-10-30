import type { Metadata } from "next";
import { ConnectionsView } from "@/components/connections/ConnectionsView";

export const metadata: Metadata = {
  title: "Connections",
  description: "Connect the tools a plan goes out to: mail, Slack approvals, CRM, sheets and docs, calendar.",
};

export default function ConnectionsPage() {
  return (
    <div data-testid="connections-page" className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-4xl">Connections</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        Plans go out to the tools you already use, and replies, approvals and edits come back. Wallspace acts only when you
        press a button. Tokens for Google, Microsoft, HubSpot and Notion are held by Composio, never shown here.
      </p>
      <div className="mt-6">
        <ConnectionsView />
      </div>
    </div>
  );
}
