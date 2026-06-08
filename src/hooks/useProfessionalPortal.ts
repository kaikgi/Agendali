import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const PORTAL_TOKEN_KEY = 'professional_portal_token';

interface PortalSession {
  valid: boolean;
  professional_id?: string;
  professional_name?: string;
  professional_photo_url?: string | null;
  establishment_id?: string;
  establishment_name?: string;
  establishment_slug?: string;
}

interface PortalAppointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  service_duration: number;
  customer_notes: string | null;
}

export function useProfessionalPortalAuth() {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(PORTAL_TOKEN_KEY);
    }
    return null;
  });

  const sessionQuery = useQuery({
    queryKey: ['professional-portal-session', token],
    queryFn: async () => {
      if (!token) return null;

      const { data, error } = await (supabase.rpc as any)('validate_professional_session', {
        p_token: token,
      });

      if (error) throw error;
      
      const session = data as unknown as PortalSession & { reason?: string };
      if (!session.valid) {
        // If portal was disabled, clear session and signal reason
        if (session.reason === 'portal_disabled') {
          localStorage.removeItem(PORTAL_TOKEN_KEY);
          setToken(null);
          return { valid: false, reason: 'portal_disabled' } as any;
        }
        localStorage.removeItem(PORTAL_TOKEN_KEY);
        setToken(null);
        return null;
      }

      return session;
    },
    enabled: !!token,
    staleTime: 2 * 60 * 1000, // 2 minutes - check portal_enabled more frequently
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({
      establishmentSlug,
      professionalSlug,
      password,
    }: {
      establishmentSlug: string;
      professionalSlug: string;
      password: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)('professional_portal_login', {
        p_establishment_slug: establishmentSlug,
        p_professional_slug: professionalSlug,
        p_password: password,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; token?: string; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao fazer login');
      }

      return result;
    },
    onSuccess: (data) => {
      if (data.token) {
        localStorage.setItem(PORTAL_TOKEN_KEY, data.token);
        setToken(data.token);
      }
    },
  });

  const logout = useCallback(() => {
    localStorage.removeItem(PORTAL_TOKEN_KEY);
    setToken(null);
  }, []);

  const isPortalDisabled = sessionQuery.data?.reason === 'portal_disabled';

  return {
    token,
    session: sessionQuery.data,
    isLoading: sessionQuery.isLoading,
    isAuthenticated: !!sessionQuery.data?.valid,
    isPortalDisabled,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    logout,
  };
}

export function useProfessionalPortalAppointments(
  token: string | null,
  startDate: Date,
  endDate: Date
) {
  return useQuery({
    queryKey: ['professional-portal-appointments', token, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      if (!token) return [];

      const { data, error } = await (supabase.rpc as any)('get_professional_appointments', {
        p_token: token,
        p_start_date: startDate.toISOString().split('T')[0],
        p_end_date: endDate.toISOString().split('T')[0],
      });

      if (error) throw error;
      
      const result = data as unknown as { success: boolean; appointments?: PortalAppointment[]; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar agendamentos');
      }

      return result.appointments || [];
    },
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useSetProfessionalPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      professionalId,
      password,
    }: {
      professionalId: string;
      password: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)('set_professional_portal_password', {
        p_professional_id: professionalId,
        p_password: password,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao definir senha');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage-professionals'] });
    },
  });
}
