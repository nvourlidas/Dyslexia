import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const { user, loading, assertAdmin, signOut } = useAuth(); // ✅ inside component
  const nav = useNavigate();

  const emailRef = useRef<HTMLInputElement | null>(null);
  const passRef = useRef<HTMLInputElement | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!loading && user) nav('/', { replace: true });
  }, [loading, user, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        throw error ?? new Error('Αποτυχία σύνδεσης.');
      }

      // ✅ Admin-only check (profiles.role must be 'admin')
      await assertAdmin(data.user.id);

      nav('/', { replace: true });
    } catch (err: any) {
      // kick out if not admin / any error
      await signOut().catch(() => {});
      setErrorMsg('Δεν έχετε δικαίωμα πρόσβασης.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center">
      <div className="w-full max-w-md p-6">
        <div className="card">
          <div className="text-xl font-semibold">Σύνδεση</div>
          <div className="mt-1 text-sm text-muted">Συνδέσου για να συνεχίσεις.</div>

          <form className="mt-4 space-y-3" onSubmit={onSubmit}>
            <input
              ref={emailRef}
              className="input"
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  passRef.current?.focus();
                }
              }}
              required
            />

            <div className="relative">
              <input
                ref={passRef}
                className="input pr-10"
                type={showPass ? 'text' : 'password'}
                placeholder="Κωδικός"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-border bg-panel px-2 py-1 text-xs hover:opacity-90"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
                title={showPass ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {errorMsg && (
              <div className="text-sm" style={{ color: 'var(--color-danger)' }}>
                {errorMsg}
              </div>
            )}

            <button className="btn btn-primary w-full" disabled={submitting || loading}>
              {submitting ? 'Σύνδεση…' : 'Σύνδεση'}
            </button>
          </form>

          <div className="mt-3 text-xs text-muted">
            Αν δεν έχεις στοιχεία πρόσβασης, επικοινώνησε με τον διαχειριστή.
          </div>
        </div>
      </div>
    </div>
  );
}
