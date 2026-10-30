import { BriefForm } from "@/components/brief/BriefForm";

export const metadata = { title: "New brief" };

export default function NewBriefPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl">New brief</h1>
        <p className="text-ink-2">Who loves what, how much, and when. The agent picks the faces and writes a line for each, in about a minute.</p>
      </header>
      <BriefForm />
    </div>
  );
}
