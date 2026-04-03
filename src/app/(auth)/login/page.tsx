'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/programs');
    router.refresh();
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
          <h1 className="font-serif text-xl text-brand-charcoal mb-1">Sign in</h1>
          <p className="text-sm text-brand-silver mb-6">Access the internal pricing tool</p>

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
                placeholder="you@quillcreative.com"
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
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-brand-silver mt-6">
          New team member?{' '}
          <Link href="/signup" className="text-brand-brown hover:text-brand-charcoal transition-colors">
            Create account
          </Link>
        </p>

        <p className="text-center text-xs text-brand-silver mt-4">
          Quill Creative Event Design · Internal Use Only
        </p>
      </div>
    </div>
  );
}
