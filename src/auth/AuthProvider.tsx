import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';


type ProfileRow = {
    id: string;
    tenant_id: string | null;
    role: "admin" | "member" | "student" | string;
};

type AuthContextValue = {
    user: User | null;
    session: Session | null;
    loading: boolean;

    profile: ProfileRow | null;
    profileLoading: boolean;

    signInWithPassword: (email: string, password: string) => Promise<void>;
    signUpWithPassword: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;

    assertAdmin: (userId: string) => Promise<void>;
    refreshProfile: () => Promise<void>; // ✅ ADD (so pages can refetch if needed)
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);

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

    async function fetchProfile(userId: string) {
        setProfileLoading(true);

        const { data, error } = await supabase
            .from("profiles")
            .select("id, tenant_id, role")
            .eq("id", userId)
            .maybeSingle();

        if (error) {
            console.warn("[auth] profile load error:", error.message);
            setProfile(null);
            setProfileLoading(false);
            return;
        }

        setProfile((data as ProfileRow) ?? null);
        setProfileLoading(false);
    }

    const refreshProfile = async () => {
        const uid = session?.user?.id;
        if (!uid) {
            setProfile(null);
            return;
        }
        await fetchProfile(uid);
    };

    // ✅ whenever user changes -> load profile (tenant_id included)
    useEffect(() => {
        const uid = session?.user?.id;
        if (!uid) {
            setProfile(null);
            return;
        }
        fetchProfile(uid);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.user?.id]);


    async function assertAdmin(userId: string) {
        const { data, error } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single();

        if (error || !data || data.role !== "admin") {
            throw new Error("Μη εξουσιοδοτημένος χρήστης");
        }
    }

    const value = useMemo<AuthContextValue>(
        () => ({
            user: session?.user ?? null,
            session,
            loading,

            profile,
            profileLoading,
            refreshProfile, // ✅ ADD THIS

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
                setProfile(null);
                setProfileLoading(false);
            },

            assertAdmin,
        }),
        [session, loading, profile, profileLoading, refreshProfile] // ✅ include it here too
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
    return ctx;
}
