import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useAdminPermissions } from './useAdminPermissions';

/**
 * Diagnostic hook to help identify why a user might be seeing "Error loading establishment"
 * Use this only in development or for admin troubleshooting.
 */
export function useEstablishmentDiagnostics() {
  const { user } = useAuth();
  const { isSuperAdmin, role: adminRole } = useAdminPermissions();

  return useQuery({
    queryKey: ['establishment-diagnostics', user?.id],
    queryFn: async () => {
      if (!user) return { status: 'no_user' };

      const diagnostics: any = {
        userId: user.id,
        email: user.email,
        isSuperAdmin,
        adminRole,
        checks: []
      };

      // Check Profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      diagnostics.profile = profile || null;
      diagnostics.profileError = profileError?.message || null;
      diagnostics.checks.push({ 
        name: 'Profile exists', 
        status: !!profile ? 'ok' : 'error',
        details: !!profile ? 'Found' : 'Not found'
      });

      // Check Owned Establishments
      const { data: owned, error: ownedError } = await supabase
        .from('establishments')
        .select('id, name, status, plano')
        .eq('owner_user_id', user.id);
      
      diagnostics.ownedCount = owned?.length || 0;
      diagnostics.owned = owned || [];
      diagnostics.ownedError = ownedError?.message || null;
      diagnostics.checks.push({ 
        name: 'Establishments owned', 
        status: (owned?.length || 0) > 0 ? 'ok' : 'info',
        details: `${owned?.length || 0} found`
      });

      // Check Memberships
      const { data: memberships, error: memberError } = await supabase
        .from('establishment_members')
        .select('establishment_id, role, establishments(name)')
        .eq('user_id', user.id);
      
      diagnostics.memberships = memberships || [];
      diagnostics.memberError = memberError?.message || null;
      diagnostics.checks.push({ 
        name: 'Memberships found', 
        status: (memberships?.length || 0) > 0 ? 'ok' : 'info',
        details: `${memberships?.length || 0} found`
      });

      // Check Subscription (if owner)
      if ((owned?.length || 0) > 0) {
        const { data: subs, error: subsError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('owner_user_id', user.id)
          .in('status', ['active', 'past_due']);
        
        diagnostics.activeSubscriptions = subs || [];
        diagnostics.subsError = subsError?.message || null;
        diagnostics.checks.push({ 
          name: 'Active subscriptions', 
          status: (subs?.length || 0) > 0 ? 'ok' : 'warning',
          details: `${subs?.length || 0} found for owner`
        });
      }

      return diagnostics;
    },
    enabled: !!user,
  });
}
