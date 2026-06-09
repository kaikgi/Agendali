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
  checkEmailAuthorized: (email: string) => Promise<{ authorized: boolean; planId?: string; pendingPayment?: boolean }>;
  clearLocalSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const APP_VERSION = '1.0.1'; // Increment this to force session clear if needed

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const authTimeoutRef = useRef<any>(null);
  const isMounted = useRef(true);

  const clearLocalSession = async () => {
    console.log('[Auth] Clearing local session due to error or version mismatch');
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('[Auth] Error during local signOut:', e);
    }
    localStorage.removeItem('supabase.auth.token');
    // Clear any other app-specific auth state
    setUser(null);
    setSession(null);
  };

  const handleAuthError = async (error: any) => {
    console.error('[Auth] Critical auth error:', error);
    const errorMsg = error?.message?.toLowerCase() || '';
    
    if (
      errorMsg.includes('refresh_token_not_found') || 
      errorMsg.includes('invalid refresh token') ||
      errorMsg.includes('session_not_found') ||
      errorMsg.includes('jwt expired')
    ) {
      await clearLocalSession();
      toast({
        variant: 'destructive',
        title: 'Sessão expirada',
        description: 'Sua sessão expirou ou é inválida. Por favor, faça login novamente.',
      });
    }
  };

  useEffect(() => {
    isMounted.current = true;
    
    // Safety timeout to prevent infinite loading
    authTimeoutRef.current = setTimeout(() => {
      if (loading && isMounted.current) {
        console.warn('[Auth] Auth loading timed out after 15s');
        setLoading(false);
      }
    }, 15000);

    // Check app version for compatibility
    const storedVersion = localStorage.getItem('agendali_version');
    if (storedVersion && storedVersion !== APP_VERSION) {
      clearLocalSession();
    }
    localStorage.setItem('agendali_version', APP_VERSION);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] onAuthStateChange:', event, !!session);
      
      if (!isMounted.current) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('[Auth] User signed in, ensuring profile exists...');
        try {
          await ensureProfileExists(session.user);
        } catch (err) {
          console.error('[Auth] Profile check error:', err);
        } finally {
          setLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] Token refreshed successfully');
      } else if (event === 'INITIAL_SESSION') {
        if (!session) {
          console.log('[Auth] No initial session, stop loading');
          setLoading(false);
        }
      }
    });

    // Initial session check
    console.log('[Auth] Starting initial session check...');
    supabase.auth
      .getSession()
      .then(async ({ data: { session }, error }) => {
        if (!isMounted.current) return;
        
        console.log('[Auth] Initial session check result:', !!session, error?.message);

        if (error) {
          await handleAuthError(error);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('[Auth] Initial session has user, ensuring profile...');
          try {
            await ensureProfileExists(session.user);
          } catch (err) {
            console.error('[Auth] Initial profile check error:', err);
          }
        } else {
          console.log('[Auth] No session user found in initial check');
        }
        setLoading(false);
      })
      .catch(async (err) => {
        console.error('[Auth] Initial session check catch:', err);
        if (isMounted.current) {
          await handleAuthError(err);
          setLoading(false);
        }
      });

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
    };
  }, []);

  const checkEmailAuthorized = async (email: string): Promise<{ authorized: boolean; planId?: string; pendingPayment?: boolean }> => {
    const normalizedEmail = email.toLowerCase().trim();
    
    try {
      const { data, error } = await supabase.rpc('check_signup_authorization', {
        p_email: normalizedEmail,
      });

      if (error) {
        console.error('[Auth] Error checking email authorization:', error.message);
        return { authorized: false };
      }

      const result = data as { authorized: boolean; plan_id?: string; pending_payment?: boolean } | null;
      if (!result) return { authorized: false };

      return {
        authorized: result.authorized,
        planId: result.plan_id,
        pendingPayment: result.pending_payment,
      };
    } catch (e) {
      console.error('[Auth] authorization check exception:', e);
      return { authorized: false };
    }
  };

  const signUp = async ({ email, password, fullName, companyName }: SignUpData) => {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const { authorized, planId, pendingPayment } = await checkEmailAuthorized(normalizedEmail);
      if (!authorized) {
        const message = pendingPayment
          ? 'Seu pagamento ainda não foi confirmado. Assim que a Kiwify confirmar o pagamento, seu email será liberado para criar a conta.'
          : 'Este email não está autorizado. Você precisa assinar um plano antes de criar sua conta.';
        return { error: new Error(message) };
      }

      const { data, error } = await supabase.auth.signUp({
        email: String(normalizedEmail).trim(),
        password: String(password),
        options: {
          emailRedirectTo: `${getPublicBaseUrl()}/dashboard`,
          data: {
            full_name: String(fullName),
            company_name: String(companyName),
            account_type: 'establishment_owner',
          },
        },
      });

      if (error || !data.user) {
        return { error: error || new Error('Erro ao criar conta') };
      }

      const userId = data.user.id;
      const resolvedPlan = planId || 'solo';

      const { data: establishment, error: estError } = await supabase
        .from('establishments')
        .insert({
          owner_user_id: userId,
          name: companyName,
          status: 'active',
          plano: resolvedPlan,
        })
        .select('id')
        .single();

      if (estError || !establishment) {
        console.error('Error creating establishment:', estError);
        return { error: estError || new Error('Erro ao criar estabelecimento') };
      }

      await supabase.from('establishment_members').insert({
        establishment_id: establishment.id,
        user_id: userId,
        role: 'owner',
      });

      const defaultHours = [];
      for (let weekday = 1; weekday <= 6; weekday++) {
        defaultHours.push({
          establishment_id: establishment.id,
          weekday,
          open_time: '09:00',
          close_time: '18:00',
          closed: false,
        });
      }
      defaultHours.push({
        establishment_id: establishment.id,
        weekday: 0,
        open_time: null,
        close_time: null,
        closed: true,
      });
      await supabase.from('business_hours').insert(defaultHours);

      await supabase
        .from('allowed_establishment_signups')
        .update({ used: true })
        .eq('email', normalizedEmail);

      return { error: null };
    } catch (e: any) {
      return { error: e instanceof Error ? e : new Error(e?.message || 'Erro inesperado no cadastro') };
    }
  };

  const signUpCustomer = async ({ email, password, fullName, phone }: CustomerSignUpData) => {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const { data, error } = await supabase.auth.signUp({
        email: String(normalizedEmail).trim(),
        password: String(password),
        options: {
          emailRedirectTo: `${getPublicBaseUrl()}/cliente/login`,
          data: {
            full_name: String(fullName),
            account_type: 'customer',
          },
        },
      });

      if (error) return { error };

      const userId = data.user?.id;
      if (userId) {
        await supabase.from('profiles').update({ phone }).eq('id', userId);
      }

      return { error: null };
    } catch (e: any) {
      return { error: e instanceof Error ? e : new Error(e?.message || 'Erro inesperado no cadastro de cliente') };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ 
        email: String(email).trim(), 
        password: String(password)
      });
      
      if (error) {
        await handleAuthError(error);
      }
      
      return { error };
    } catch (e: any) {
      return { error: e instanceof Error ? e : new Error(e?.message || 'Erro inesperado no login') };
    }
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: String(redirectTo || `${getPublicBaseUrl()}/dashboard`),
        },
      });
      return { error };
    } catch (error: any) {
      console.error('OAuth sign-in error:', error);
      return { error: error instanceof Error ? error : new Error('Erro ao iniciar sessão com Google') };
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[Auth] Sign out error:', e);
    } finally {
      // Force local cleanup even if server signOut fails
      setUser(null);
      setSession(null);
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), {
        redirectTo: `${getPublicBaseUrl()}/resetar-senha`,
      });
      return { error };
    } catch (e: any) {
      return { error: e instanceof Error ? e : new Error(e?.message || 'Erro inesperado ao resetar senha') };
    }
  };

  const ensureProfileExists = async (user: User) => {
    console.log('[Auth] ensureProfileExists for:', user.id);
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[Auth] Error checking profile:', fetchError);
      return;
    }

    if (!existingProfile) {
      console.log('[Auth] Profile not found in ensureProfileExists, creating...');
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          account_type: user.user_metadata?.account_type || 'customer',
        });

      if (error) {
        console.error('[Auth] Error creating profile:', error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signUpCustomer, signIn, signInWithGoogle, signOut, resetPassword, checkEmailAuthorized, clearLocalSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
