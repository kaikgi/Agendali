import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getPublicBaseUrl } from '@/lib/publicUrl';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initialSessionChecked = useRef(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN' && session?.user) {
        // Ensure profile exists
        await ensureProfileExists(session.user);
        setLoading(false);
      } else if (initialSessionChecked.current) {
        setLoading(false);
      }
    });

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        initialSessionChecked.current = true;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await ensureProfileExists(session.user);
        }
        setLoading(false);
      })
      .catch(() => {
        initialSessionChecked.current = true;
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Check if an email is authorized to create an account.
   * Uses a secure RPC that doesn't expose the table directly.
   */
  const checkEmailAuthorized = async (email: string): Promise<{ authorized: boolean; planId?: string; pendingPayment?: boolean }> => {
    const normalizedEmail = email.toLowerCase().trim();
    
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
  };

  /**
   * Sign up for ESTABLISHMENT owners.
   * Requires pre-authorization via Kiwify payment.
   */
  const signUp = async ({ email, password, fullName, companyName }: SignUpData) => {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check authorization
    const { authorized, planId, pendingPayment } = await checkEmailAuthorized(normalizedEmail);
    if (!authorized) {
      const message = pendingPayment
        ? 'Seu pagamento ainda não foi confirmado. Assim que a Kiwify confirmar o pagamento, seu email será liberado para criar a conta.'
        : 'Este email não está autorizado. Você precisa assinar um plano antes de criar sua conta.';
      return { error: new Error(message) };
    }

    // 2. Create auth user
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

    // 3. Create establishment with active status and correct plan
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

    // 4. Create owner member
    await supabase.from('establishment_members').insert({
      establishment_id: establishment.id,
      user_id: userId,
      role: 'owner',
    });

    // 5. Create default business hours
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

    // 6. Mark the allowed signup as used
    await supabase
      .from('allowed_establishment_signups')
      .update({ used: true })
      .eq('email', normalizedEmail);

    return { error: null };
  };

  const signUpCustomer = async ({ email, password, fullName, phone }: CustomerSignUpData) => {
    const normalizedEmail = email.toLowerCase().trim();

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

    if (error) {
      return { error };
    }

    const userId = data.user?.id;
    if (userId) {
      const { error: updateError } = await supabase.from('profiles').update({ phone }).eq('id', userId);
      if (updateError) {
        console.error('Error updating customer phone:', updateError);
      }
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    // @ts-ignore - Using import.meta.env for Vite
    if (import.meta.env?.DEV) {
      console.log("Login payload types:", { email: typeof email, password: typeof password });
    }
    
    const { error } = await supabase.auth.signInWithPassword({ 
      email: String(email).trim(), 
      password: String(password)
    });
    return { error };
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo || `${getPublicBaseUrl()}/dashboard`,
        },
      });
      return { error };
    } catch (error: any) {
      console.error('OAuth sign-in error:', error);
      return { error: error instanceof Error ? error : new Error('Erro ao iniciar sessão com Google') };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), {
      redirectTo: `${getPublicBaseUrl()}/resetar-senha`,
    });
    return { error };
  };

  const ensureProfileExists = async (user: User) => {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!existingProfile) {
      // Create profile for OAuth users (default to customer)
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          account_type: 'customer', // Default to customer for OAuth
        });

      if (error) {
        console.error('Error creating profile for OAuth user:', error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signUpCustomer, signIn, signInWithGoogle, signOut, resetPassword, checkEmailAuthorized }}>
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
