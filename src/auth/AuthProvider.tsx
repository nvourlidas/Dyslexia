import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

type AuthContextValue = {
    user: User | null;
    session: Session | null;
    loading: boolean;

    signInWithPassword: (email: string, password: string) => Promise<void>;
    signUpWithPassword: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;

    assertAdmin: (userId: string) => Promise<void>; // 👈 ADD THIS
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        supabase.auth.getSession().then(({ data, error }) => {
            if (!mounted) return;
            if (error) console.warn('[auth] getSession error:', error.message);
            setSession(data.session ?? null);
            setLoading(false);
        });

        const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession ?? null);
            setLoading(false);
        });

        return () => {
            mounted = false;
            sub.subscription.unsubscribe();
        };
    }, []);

    async function assertAdmin(userId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (error || !data || data.role !== 'admin') {
            throw new Error('Μη εξουσιοδοτημένος χρήστης');
        }
    }


    const value = useMemo<AuthContextValue>(() => ({
        user: session?.user ?? null,
        session,
        loading,

        async signInWithPassword(email, password) {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        },

        async signUpWithPassword(email, password) {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
        },

        async signOut() {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        },

        assertAdmin, // 👈 ADD THIS
    }), [session, loading]);


    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
    return ctx;
}
