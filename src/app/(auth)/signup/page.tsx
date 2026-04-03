'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.toLowerCase().endsWith('@qceventdesign.com')) {
      setError('Signups are restricted to @qceventdesign.com email addresses.');
      return;
    }

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
    const { error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setDone(true);
  }

  const inputClass = 'w-full border border-brand-cream rounded px-3 py-2.5 text-sm bg-white text-brand-charcoal placeholder:text-brand-silver focus:outline-none focus:ring-2 focus:ring-brand-copper focus:border-brand-brown transition-colors';

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

        {/* Card */}
        <div className="bg-white rounded-lg border border-brand-cream shadow-sm p-8">
          {done ? (
            <div className="text-center space-y-3">
              <h1 className="font-serif text-xl text-brand-charcoal">Check your email</h1>
              <p className="text-sm text-brand-silver">
                A confirmation link has been sent to <span className="text-brand-charcoal font-medium">{email}</span>.
                Click the link to activate your account.
              </p>
              <Link
                href="/login"
                className="block mt-4 text-sm text-brand-brown hover:text-brand-charcoal transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-serif text-xl text-brand-charcoal mb-1">Create account</h1>
              <p className="text-sm text-brand-silver mb-6">QC Event Design team members only</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-brand-charcoal tracking-wide mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="you@qceventdesign.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-brand-charcoal tracking-wide mb-1.5">
                    Password
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-brown text-white text-sm font-medium rounded px-4 py-2.5 hover:bg-brand-charcoal disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
                >
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>

              <p className="text-center text-xs text-brand-silver mt-6">
                Already have an account?{' '}
                <Link href="/login" className="text-brand-brown hover:text-brand-charcoal transition-colors">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-xs text-brand-silver mt-8">
          Quill Creative Event Design · Internal Use Only
        </p>
      </div>
    </div>
  );
}
