import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase, withTimeout } from '../lib/supabase';

const AuthContext = createContext(null);

/** Usernames must match the DB constraint exactly. */
export function validateUsername(name) {
  const v = (name || '').trim();
  if (v.length < 3) return 'Username must be at least 3 characters.';
  if (v.length > 20) return 'Username must be 20 characters or fewer.';
  if (!/^[A-Za-z0-9_-]+$/.test(v)) return 'Only letters, numbers, underscores and hyphens.';
  return null;
}

/** Password rules — deliberately stricter than Supabase's default of 6. */
export function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(pw)) return 'Password needs at least one letter.';
  if (!/[0-9]/.test(pw)) return 'Password needs at least one number.';
  return null;
}

/** Turn Supabase's terse errors into something a human can act on. */
export function friendlyAuthError(message = '') {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Wrong email or password. Have another go.';
  if (m.includes('email not confirmed')) return 'Check your inbox and confirm your email first.';
  if (m.includes('already registered')) return 'That email already has an account. Try signing in.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('disposable')) return 'Disposable email addresses are not allowed. Please use a real one.';
  if (m.includes('duplicate key') && m.includes('username')) return 'That username is already taken.';
  if (m.includes('username_format')) return 'Usernames must be 3–20 characters: letters, numbers, _ or -.';
  if (m.includes('should be at least')) return 'That password is too short.';
  return message || 'Something went wrong. Try again.';
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const bonusAttempted = useRef(false);

  const emailVerified = Boolean(user?.email_confirmed_at || user?.confirmed_at);

  const banActive =
    Boolean(profile?.is_banned) &&
    (!profile?.banned_until || new Date(profile.banned_until) > new Date());

  const isAdmin = profile?.role === 'admin';
  const isStaff = profile?.role === 'admin' || profile?.role === 'mod';
  const canPost = Boolean(user) && emailVerified && !banActive && !profile?.is_muted;

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setBadges([]);
      return null;
    }

    const [profRes, badgeRes] = await Promise.allSettled([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('user_badges_detailed')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true }),
    ]);

    const { data: prof, error } = profRes.status === 'fulfilled'
      ? profRes.value : { data: null, error: profRes.reason };
    const { data: badgeRows } = badgeRes.status === 'fulfilled'
      ? badgeRes.value : { data: [] };

    if (error) console.warn('Profile load failed:', error.message || error);
    setProfile(prof || null);
    setBadges(badgeRows || []);
    return prof || null;
  }, []);

  // Grant the 50 free coins the first time a verified user turns up.
  const claimBonusIfDue = useCallback(async (prof, verified) => {
    if (!prof || prof.bonus_claimed || !verified || bonusAttempted.current) return;
    bonusAttempted.current = true;
    const { error } = await supabase.rpc('claim_signup_bonus');
    if (error) {
      bonusAttempted.current = false;
      if (!/EMAIL_NOT_VERIFIED/.test(error.message)) {
        console.warn('Signup bonus failed:', error.message);
      }
      return;
    }
    await loadProfile(prof.id);
  }, [loadProfile]);

  useEffect(() => {
    let active = true;

    /*
     * Belt and braces. Everything below is wrapped in a timeout, but if any
     * unforeseen path still fails to settle, this releases the app after 8
     * seconds regardless. Nothing renders until `loading` clears, so a single
     * stuck promise here takes the entire site down — which is precisely what
     * "stuck on Loading the Portal until I refresh" was.
     *
     * Failing open (treating it as signed out) is right: a logged-out visitor
     * who can browse beats a logged-in one who can't see anything.
     */
    const failsafe = setTimeout(() => {
      if (!active) return;
      console.warn('Auth init exceeded 8s — releasing the UI as signed out.');
      setLoading(false);
    }, 8000);

    withTimeout(supabase.auth.getSession(), 6000, 'getSession').then(async ({ data }) => {
      if (!active) return;
      const s = data?.session ?? null;
      const verified = Boolean(s?.user?.email_confirmed_at || s?.user?.confirmed_at);

      // NOTE: do not call refreshSession() here. supabase-js serialises auth
      // operations behind a Navigator lock, and a manual refresh racing the
      // client's own automatic one steals that lock — which aborts every
      // query in flight ("Lock broken by another request"). The stale-token
      // case only matters right after confirming an email, so the refresh
      // lives on the /verify page instead, where nothing else is loading.

      if (!active) return;
      setSession(s);
      setUser(s?.user ?? null);

      // Profile and bonus are nice-to-haves; neither should be able to hold
      // the whole app behind the spinner if it stalls.
      try {
        const prof = await withTimeout(loadProfile(s?.user?.id), 8000, 'loadProfile');
        await withTimeout(claimBonusIfDue(prof, verified), 8000, 'claimBonus');
      } catch (e) {
        console.warn('Profile load degraded:', e?.message || e);
      }

      if (active) { clearTimeout(failsafe); setLoading(false); }
    }).catch((e) => {
      // A stale, rejected, or stalled token must not leave the whole app stuck
      // behind a spinner. Fail open: treat it as signed out.
      console.warn('Auth init failed:', e?.message || e);
      if (!active) return;
      clearTimeout(failsafe);
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!active) return;
      setSession(s ?? null);
      setUser(s?.user ?? null);
      if (event === 'SIGNED_OUT') {
        bonusAttempted.current = false;
        setProfile(null);
        setBadges([]);
        return;
      }
      const prof = await loadProfile(s?.user?.id);
      await claimBonusIfDue(prof, Boolean(s?.user?.email_confirmed_at || s?.user?.confirmed_at));
    });

    return () => { active = false; clearTimeout(failsafe); subscription.unsubscribe(); };
  }, [loadProfile, claimBonusIfDue]);

  // ── auth actions ──────────────────────────────────────────
  const signUp = async (email, password, username) => {
    const usernameError = validateUsername(username);
    if (usernameError) throw new Error(usernameError);
    const passwordError = validatePassword(password);
    if (passwordError) throw new Error(passwordError);

    // Fail early with a clear message rather than a raw DB constraint error.
    const { data: taken } = await supabase
      .from('profiles').select('id').ilike('username', username.trim()).maybeSingle();
    if (taken) throw new Error('That username is already taken. Try another!');

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: username.trim() },
        emailRedirectTo: `${window.location.origin}/verify`,
      },
    });
    if (error) throw new Error(friendlyAuthError(error.message));
    return data;
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(friendlyAuthError(error.message));
    return data;
  };

  const signOut = async () => {
    bonusAttempted.current = false;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resendVerification = async (email) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: (email || user?.email || '').trim(),
      options: { emailRedirectTo: `${window.location.origin}/verify` },
    });
    if (error) throw new Error(friendlyAuthError(error.message));
  };

  const requestPasswordReset = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(friendlyAuthError(error.message));
  };

  const updatePassword = async (newPassword) => {
    const passwordError = validatePassword(newPassword);
    if (passwordError) throw new Error(passwordError);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(friendlyAuthError(error.message));
  };

  const updateEmail = async (newEmail) => {
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) throw new Error(friendlyAuthError(error.message));
  };

  const updateProfile = async (updates) => {
    if (!user) throw new Error('You need to be signed in.');
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw new Error(friendlyAuthError(error.message));
    setProfile(data);
    await supabase.rpc('refresh_my_badges'); // completing a profile can unlock a badge
    await loadProfile(user.id);
    return data;
  };

  const refreshProfile = useCallback(() => loadProfile(user?.id), [loadProfile, user?.id]);

  /**
   * Pull a fresh token. Only call this somewhere quiet (the /verify page) —
   * doing it while other queries are running steals the auth lock and
   * aborts them.
   */
  const refreshSession = useCallback(async () => {
    try {
      const { data } = await supabase.auth.refreshSession();
      if (data?.session) {
        setSession(data.session);
        setUser(data.session.user);
        await loadProfile(data.session.user.id);
      }
      return data?.session ?? null;
    } catch (e) {
      console.warn('Session refresh failed:', e?.message || e);
      return null;
    }
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{
      session, user, profile, badges, loading,
      emailVerified, banActive, isAdmin, isStaff, canPost,
      coins: profile?.coins ?? 0,
      signUp, signIn, signOut,
      resendVerification, requestPasswordReset, updatePassword, updateEmail,
      updateProfile, refreshProfile, refreshSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
