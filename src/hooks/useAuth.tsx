import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getPublicBaseUrl } from '@/lib/publicUrl';
import { useToast } from '@/hooks/use-toast';

interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
}

interface CustomerSignUpData {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (data: SignUpData) => Promise<{ error: Error | null }>;
  signUpCustomer: (data: CustomerSignUpData) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (redirectTo?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  checkEmailAuthorized: (email: string) => Promise<{ authorized: boolean; planId?: string; pendingPayment?: boolean; token?: string }>;
  clearLocalSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const APP_VERSION = '1.0.8'; 

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const authTimeoutRef = useRef<any>(null);
  const isMounted = useRef(true);
  const initializationStarted = useRef(false);

  const clearLocalSession = async () => {
    console.log('[Auth] Clearing local session');
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('[Auth] local signOut error:', e);
    }
    localStorage.removeItem('supabase.auth.token');
    setUser(null);
    setSession(null);
  };

  const handleAuthError = async (error: any) => {
    console.error('[Auth] Auth error:', error);
    const errorMsg = error?.message?.toLowerCase() || '';
    if (errorMsg.includes('refresh_token_not_found') || errorMsg.includes('session_not_found') || errorMsg.includes('jwt expired')) {
      await clearLocalSession();
      toast({
        variant: 'destructive',
        title: 'Sessão expirada',
        description: 'Faça login novamente.',
      });
    }
  };

  const ensureProfileExists = async (user: User) => {
    console.log('[Auth] Profile check for:', user.id);
    const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (!existing) {
      console.log('[Auth] Creating missing profile');
      await supabase.from('profiles').insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || '',
        account_type: user.user_metadata?.account_type || 'customer',
      });
    }
  };

  useEffect(() => {
    if (initializationStarted.current) return;
    initializationStarted.current = true;
    isMounted.current = true;
    
    console.log('[Auth] App init v' + APP_VERSION);
    
    authTimeoutRef.current = setTimeout(() => {
      if (loading && isMounted.current) {
        console.warn('[Auth] Timeout reached');
        setLoading(false);
      }
    }, 15000);

    const storedVersion = localStorage.getItem('agendali_version');
    if (storedVersion && storedVersion !== APP_VERSION) {
      clearLocalSession();
    }
    localStorage.setItem('agendali_version', APP_VERSION);

    // Usa onAuthStateChange para inicializar o estado de forma mais resiliente que getSession isolado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('[Auth] Event:', event, !!currentSession);
      if (!isMounted.current) return;

      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
      } else {
        setSession(null);
        setUser(null);
      }

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (currentSession?.user) {
          await ensureProfileExists(currentSession.user);
        }
        setLoading(false);
        if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
      } else if (event === 'SIGNED_OUT') {
        setLoading(false);
        if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
      }
    });

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
    };
  }, []);


  const checkEmailAuthorized = async (email: string) => {
    const { data, error } = await supabase.rpc('check_signup_authorization', { p_email: email.toLowerCase().trim() });
    if (error) return { authorized: false };
    const res = data as any;
    return { authorized: !!res?.authorized, planId: res?.plan_id, pendingPayment: !!res?.pending_payment };
  };

  const signUp = async (data: SignUpData) => {
    const { authorized, planId } = await checkEmailAuthorized(data.email);
    if (!authorized) return { error: new Error('Email não autorizado') };

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${getPublicBaseUrl()}/dashboard`,
        data: { full_name: data.fullName, company_name: data.companyName, account_type: 'establishment_owner' },
      },
    });

    if (error || !authData.user) return { error: error || new Error('Erro no signup') };

    const { data: est, error: estErr } = await supabase.from('establishments').insert({
      owner_user_id: authData.user.id,
      name: data.companyName,
      status: 'active',
      plano: planId || 'solo',
    }).select('id').single();

    if (estErr) return { error: estErr };

    await supabase.from('establishment_members').insert({ establishment_id: est.id, user_id: authData.user.id, role: 'owner' });
    await supabase.from('allowed_establishment_signups').update({ used: true }).eq('email', data.email.toLowerCase().trim());

    return { error: null };
  };

  const signUpCustomer = async (data: CustomerSignUpData) => {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${getPublicBaseUrl()}/cliente/login`,
        data: { full_name: data.fullName, account_type: 'customer' },
      },
    });
    if (error) return { error };
    if (authData.user) await supabase.from('profiles').update({ phone: data.phone }).eq('id', authData.user.id);
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) await handleAuthError(error);
    return { error };
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo || `${getPublicBaseUrl()}/dashboard` },
    });
    return { error };
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setLoading(false);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${getPublicBaseUrl()}/resetar-senha` });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signUpCustomer, signIn, signInWithGoogle, signOut, resetPassword, checkEmailAuthorized, clearLocalSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
