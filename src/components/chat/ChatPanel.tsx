'use client';

// In-app read-only assistant. Ephemeral: conversation lives only in component state and is sent
// in full on each request (no persistence). Handles the daily-cap states (warning at 1 left, block
// at limit). Sources are stored on each answer now; Stage 5 renders them beside the prose.
import { useState, useRef, useEffect, useCallback } from 'react';

interface ChatSource {
  tool: string;
  input: unknown;
  data: unknown;
}
interface Msg {
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  isError?: boolean;
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || limitReached) return;

    const history = [...messages, { role: 'user' as const, content: text }];
    setMessages(history);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setLimitReached(true);
        setRemaining(0);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.message ?? 'Daily limit reached — resets tomorrow.', isError: true },
        ]);
      } else if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.error ?? 'Something went wrong. Please try again.', isError: true },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.answer ?? '', sources: data.sources },
        ]);
        if (typeof data.remaining === 'number') setRemaining(data.remaining);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Network error. Please try again.', isError: true }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, limitReached, messages]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col rounded-xl border border-brand-copper/20 bg-white shadow-sm">
      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md pt-10 text-center text-sm text-brand-charcoal/50">
            <p className="mb-1 font-medium text-brand-charcoal/70">Ask about your data</p>
            <p>Programs, estimates, venues, menus, and the leads pipeline. Read-only — I quote the real numbers, never guess a price.</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                m.role === 'user'
                  ? 'bg-brand-charcoal text-white'
                  : m.isError
                    ? 'border border-amber-200 bg-amber-50 text-amber-800'
                    : 'border border-gray-150 bg-brand-offwhite text-brand-charcoal'
              }`}
            >
              {m.content}
              {/* Stage 5 renders m.sources here (the real retrieved rows beside the answer). */}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-gray-150 bg-brand-offwhite px-4 py-2.5 text-sm text-brand-charcoal/50">
              Thinking…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Cap notices */}
      {limitReached ? (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-800">
          Daily limit reached — resets tomorrow.
        </div>
      ) : remaining === 1 ? (
        <div className="border-t border-brand-copper/20 bg-brand-copper/5 px-4 py-2 text-center text-xs font-medium text-brand-brown">
          1 question left today.
        </div>
      ) : null}

      {/* Input */}
      <div className="flex items-end gap-2 border-t border-gray-150 p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={limitReached}
          rows={1}
          placeholder={limitReached ? 'Come back tomorrow.' : 'Ask a question…'}
          className="max-h-32 flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-brand-charcoal focus:border-brand-copper focus:outline-none disabled:bg-gray-50"
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading || limitReached}
          className="rounded-lg bg-brand-copper px-4 py-2 text-sm font-medium text-white hover:bg-brand-copper/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
