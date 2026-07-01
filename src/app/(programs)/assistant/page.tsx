// Assistant tab — the in-app read-only chatbot. Auth is enforced by the (programs) layout;
// /api/chat re-checks auth server-side. History is ephemeral (client state only).
import ChatPanel from '@/components/chat/ChatPanel';

export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-3">
        <h1 className="text-xl font-semibold text-brand-charcoal">Assistant</h1>
        <p className="text-sm text-brand-charcoal/60">
          Ask about programs, estimates, venues, and the pipeline. Read-only. 6 questions per day.
        </p>
      </div>
      <ChatPanel />
    </div>
  );
}
