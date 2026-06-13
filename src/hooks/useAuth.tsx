import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getPublicBaseUrl } from '@/lib/publicUrl';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  phone: string;
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
  completeSignup: (data: { userId: string; fullName: string; companyName: string; phone: string }) => Promise<{ error: Error | null; establishmentId?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const APP_VERSION = '1.0.8'; 

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authTimeoutRef = useRef<any>(null);
  const isMounted = useRef(true);
  const initializationStarted = useRef(false);

  const clearLocalSession = async (reason?: string) => {
    console.log('[AUTH] clearLocalSession executou?', { reason: reason || 'chamada direta' });
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('[AUTH] local signOut error:', e);
    }
    localStorage.removeItem('supabase.auth.token');
    try {
      queryClient.clear();
    } catch (e) {
      console.error('[AUTH] queryClient clear error:', e);
    }
    setUser(null);
    setSession(null);
  };

  const handleAuthError = async (error: any) => {
    console.error('[AUTH] Auth error:', error);
    const errorMsg = error?.message?.toLowerCase() || '';
    
    // Tratamento de falhas temporárias de rede (CORS, offline, timeout ou status 0)
    const isNetworkError = 
      errorMsg.includes('network') || 
      errorMsg.includes('fetch') || 
      errorMsg.includes('cors') || 
      errorMsg.includes('failed to fetch') ||
      errorMsg.includes('load failed') ||
      error?.status === 0 ||
      error?.status === 504;

    if (isNetworkError) {
      console.warn('[AUTH] Falha temporária de rede detectada. Mantendo sessão local.');
      toast({
        variant: 'destructive',
        title: 'Conexão instável',
        description: 'Não foi possível conectar ao Supabase. Verifique sua conexão.',
      });
      return;
    }

    if (errorMsg.includes('refresh_token_not_found') || errorMsg.includes('session_not_found') || errorMsg.includes('jwt expired')) {
      await clearLocalSession('erro_autenticacao');
      toast({
        variant: 'destructive',
        title: 'Sessão expirada',
        description: 'Faça login novamente.',
      });
    }
  };

  const ensureProfileExists = async (user: User) => {
    // Evita concorrência e race condition no signup de estabelecimento
    if (user.user_metadata?.account_type === 'establishment_owner') {
      console.log('[AUTH] Pula ensureProfileExists para owner - a RPC cuidará disso de forma atômica.');
      return;
    }

    console.log('[AUTH] Profile check for:', user.id);
    try {
      const { data: existing, error: fetchError } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
      if (fetchError) {
        console.error('[AUTH] erro ao buscar profile em ensureProfileExists:', fetchError.message);
        return;
      }
      if (!existing) {
        console.log('[AUTH] Creating missing profile');
        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || '',
          account_type: user.user_metadata?.account_type || 'customer',
        });
        if (insertError) {
          console.error('[AUTH] erro ao inserir profile em ensureProfileExists:', insertError.message);
        }
      }
    } catch (err) {
      console.error('[AUTH] exceção inesperada em ensureProfileExists:', err);
    }
  };

  useEffect(() => {
    const initStartTime = Date.now();
    if (initializationStarted.current) return;
    initializationStarted.current = true;
    isMounted.current = true;
    
    console.log('[AUTH] init iniciado', { version: APP_VERSION });
    
    authTimeoutRef.current = setTimeout(() => {
      if (loading && isMounted.current) {
        console.warn('[AUTH] Timeout reached, forçando authLoading = false');
        setLoading(false);
      }
    }, 15000);

    const storedVersion = localStorage.getItem('agendali_version');
    if (storedVersion && storedVersion !== APP_VERSION) {
      console.log('[AUTH] APP_VERSION limpou sessão?', { Reason: `versão armazenada: ${storedVersion} diferente de v${APP_VERSION}` });
      clearLocalSession('versao_antiga');
    }
    localStorage.setItem('agendali_version', APP_VERSION);

    console.log('[AUTH] getSession iniciado');
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      console.log('[AUTH] getSession retornou', {
        sessionExiste: !!initialSession,
        userExiste: !!initialSession?.user,
        tempoRestauracaoMs: Date.now() - initStartTime
      });
      if (initialSession && isMounted.current && !session) {
        setSession(initialSession);
        setUser(initialSession.user);
        setLoading(false);
        if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('[AUTH] evento onAuthStateChange', {
        evento: event,
        sessionExiste: !!currentSession,
        userExiste: !!currentSession?.user
      });
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
          // Não coloca await para não travar o setLoading em conexões lentas ou locks
          ensureProfileExists(currentSession.user);
        }
        console.log('[AUTH] authLoading = false');
        setLoading(false);
        if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
      } else if (event === 'SIGNED_OUT') {
        console.log('[AUTH] authLoading = false (SIGNED_OUT)');
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

  const completeSignup = async (data: { userId: string; fullName: string; companyName: string; phone: string }) => {
    try {
      const { data: res, error } = await supabase.rpc('complete_establishment_signup', {
        p_user_id: data.userId,
        p_full_name: data.fullName,
        p_company_name: data.companyName,
        p_phone: data.phone,
      });

      if (error) {
        console.error('[Auth] complete_establishment_signup RPC error:', error);
        return { error };
      }

      const response = res as any;
      if (response && !response.success) {
        console.error('[Auth] complete_establishment_signup failure:', response.error);
        return { error: new Error(response.error || 'Erro ao completar cadastro') };
      }

      return { error: null, establishmentId: response?.establishment_id };
    } catch (err: any) {
      console.error('[Auth] completeSignup unexpected error:', err);
      return { error: err };
    }
  };

  const signUp = async (data: SignUpData) => {
    const { authorized } = await checkEmailAuthorized(data.email);
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

    // Chama a RPC atômica para criar perfil, estabelecimento, membership e subscription de forma transacional
    const { error: completeError } = await completeSignup({
      userId: authData.user.id,
      fullName: data.fullName,
      companyName: data.companyName,
      phone: data.phone,
    });

    if (completeError) {
      return { error: completeError };
    }

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
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[AUTH] signOut error:', e);
    }
    try {
      queryClient.clear();
    } catch (e) {
      console.error('[AUTH] queryClient clear error:', e);
    }
    setUser(null);
    setSession(null);
    setLoading(false);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${getPublicBaseUrl()}/resetar-senha` });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signUpCustomer, signIn, signInWithGoogle, signOut, resetPassword, checkEmailAuthorized, clearLocalSession, completeSignup }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
