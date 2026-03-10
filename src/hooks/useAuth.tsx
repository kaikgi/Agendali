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

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (data: SignUpData) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
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
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (initialSessionChecked.current) {
        setLoading(false);
      }

      if (event === 'SIGNED_IN' && session?.user) {
        setLoading(false);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        initialSessionChecked.current = true;
        setSession(session);
        setUser(session?.user ?? null);
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
   * Must exist in allowed_establishment_signups and not be used yet.
   */
  const checkEmailAuthorized = async (email: string): Promise<{ authorized: boolean; planId?: string }> => {
    const normalizedEmail = email.toLowerCase().trim();
    
    const { data, error } = await supabase
      .from('allowed_establishment_signups')
      .select('email, plan_id, used')
      .eq('email', normalizedEmail)
      .eq('used', false)
      .limit(1);

    if (error || !data || data.length === 0) {
      return { authorized: false };
    }

    return { authorized: true, planId: data[0].plan_id };
  };

  /**
   * Sign up for ESTABLISHMENT owners.
   * Requires pre-authorization via Kiwify payment.
   */
  const signUp = async ({ email, password, fullName, companyName }: SignUpData) => {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check authorization
    const { authorized, planId } = await checkEmailAuthorized(normalizedEmail);
    if (!authorized) {
      return { 
        error: new Error('Este email não está autorizado. Você precisa assinar um plano antes de criar sua conta.') 
      };
    }

    // 2. Create auth user
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${getPublicBaseUrl()}/dashboard`,
        data: {
          full_name: fullName,
          company_name: companyName,
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

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };


  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getPublicBaseUrl()}/resetar-senha`,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resetPassword, checkEmailAuthorized }}>
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
