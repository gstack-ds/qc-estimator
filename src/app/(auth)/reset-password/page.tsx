'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

type State = 'waiting' | 'ready' | 'done' | 'error';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<State>('waiting');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setState('ready');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setState('done');
    setTimeout(() => router.push('/programs'), 2000);
  }

  const inputClass = 'w-full border border-brand-cream rounded px-3 py-2.5 text-sm bg-white text-brand-charcoal placeholder:text-brand-silver focus:outline-none focus:ring-2 focus:ring-brand-copper focus:border-brand-brown transition-colors';
  const btnClass = 'w-full bg-brand-brown text-white text-sm font-medium rounded px-4 py-2.5 hover:bg-brand-charcoal disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2';

  return (
    <div className="min-h-screen bg-brand-offwhite flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <Image
            src="/images/logo-primary.png"
            alt="Quill Creative Event Design"
            width={200}
            height={80}
            className="object-contain mb-6"
          />
          <p className="text-xs text-brand-silver tracking-[0.15em] uppercase">Estimator</p>
        </div>

        <div className="bg-white rounded-lg border border-brand-cream shadow-sm p-8">
          {state === 'waiting' && (
            <div className="text-center space-y-2">
              <h1 className="font-serif text-xl text-brand-charcoal">Verifying link…</h1>
              <p className="text-sm text-brand-silver">Please wait a moment.</p>
            </div>
          )}

          {state === 'ready' && (
            <>
              <h1 className="font-serif text-xl text-brand-charcoal mb-1">Set new password</h1>
              <p className="text-sm text-brand-silver mb-6">Choose a new password for your account.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-brand-charcoal tracking-wide mb-1.5">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-brand-charcoal tracking-wide mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={inputClass}
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                    {error}
                  </p>
                )}

                <button type="submit" disabled={loading} className={btnClass}>
                  {loading ? 'Saving…' : 'Set new password'}
                </button>
              </form>
            </>
          )}

          {state === 'done' && (
            <div className="text-center space-y-2">
              <h1 className="font-serif text-xl text-brand-charcoal">Password updated</h1>
              <p className="text-sm text-brand-silver">Redirecting you to the app…</p>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center space-y-3">
              <h1 className="font-serif text-xl text-brand-charcoal">Link expired</h1>
              <p className="text-sm text-brand-silver">
                This reset link is no longer valid. Request a new one from the login page.
              </p>
              <a
                href="/login"
                className="block text-sm text-brand-brown hover:text-brand-charcoal transition-colors mt-2"
              >
                Back to sign in
              </a>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-brand-silver mt-8">
          Quill Creative Event Design · Internal Use Only
        </p>
      </div>
    </div>
  );
}
