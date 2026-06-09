import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format, eachDayOfInterval, startOfDay, parseISO } from 'date-fns';
import { useCallback } from 'react';

export function useDashboardMetrics(establishmentId: string | undefined) {
  const queryClient = useQueryClient();

  const todayQuery = useQuery({
    queryKey: ['metrics-today', establishmentId],
    queryFn: async () => {
      const fetchToday = async () => {
        const now = new Date();
        const todayStart = startOfDay(now).toISOString();
        const tomorrowStart = startOfDay(subDays(now, -1)).toISOString();
        const { count, error } = await supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('establishment_id', establishmentId!)
          .gte('start_at', todayStart)
          .lt('start_at', tomorrowStart)
          .not('status', 'in', '("canceled","canceled_by_customer","canceled_by_establishment","rejected")');
        if (error) throw error;
        return count ?? 0;
      };

      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout metrics-today')), 5000)
        );
        return await Promise.race([fetchToday(), timeoutPromise]) as number;
      } catch (err) {
        console.error('[useDashboardMetrics] todayQuery error:', err);
        return 0;
      }

    },
    enabled: !!establishmentId,
    staleTime: 30000,
  });

  const weekQuery = useQuery({
    queryKey: ['metrics-week', establishmentId],
    queryFn: async () => {
      const fetchWeek = async () => {
        const weekStart = startOfDay(subDays(new Date(), 6)).toISOString();
        const { count, error } = await supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('establishment_id', establishmentId!)
          .gte('start_at', weekStart)
          .not('status', 'in', '("canceled","canceled_by_customer","canceled_by_establishment","rejected")');
        if (error) throw error;
        return count ?? 0;
      };

      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout metrics-week')), 5000)
        );
        return await Promise.race([fetchWeek(), timeoutPromise]) as number;
      } catch (err) {
        console.error('[useDashboardMetrics] weekQuery error:', err);
        return 0;
      }

    },
    enabled: !!establishmentId,
    staleTime: 30000,
  });

  const canceledQuery = useQuery({
    queryKey: ['metrics-canceled', establishmentId],
    queryFn: async () => {
      const fetchCanceled = async () => {
        const weekStart = startOfDay(subDays(new Date(), 6)).toISOString();
        const { count, error } = await supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('establishment_id', establishmentId!)
          .gte('start_at', weekStart)
          .in('status', ['canceled', 'canceled_by_customer', 'canceled_by_establishment']);
        if (error) throw error;
        return count ?? 0;
      };

      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout metrics-canceled')), 5000)
        );
        return await Promise.race([fetchCanceled(), timeoutPromise]) as number;
      } catch (err) {
        console.error('[useDashboardMetrics] canceledQuery error:', err);
        return 0;
      }

    },
    enabled: !!establishmentId,
    staleTime: 30000,
  });

  const byProfessionalQuery = useQuery({
    queryKey: ['metrics-by-professional', establishmentId],
    queryFn: async () => {
      try {
        const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

        // Get professionals
        const { data: profs, error: profsError } = await supabase
          .from('professionals')
          .select('id, name')
          .eq('establishment_id', establishmentId!)
          .eq('active', true);

        if (profsError) throw profsError;
        if (!profs || profs.length === 0) return [];

        // Get appointments in last 30 days
        const { data: appointments, error: aptError } = await supabase
          .from('appointments')
          .select('professional_id')
          .eq('establishment_id', establishmentId!)
          .gte('start_at', thirtyDaysAgo)
          .not('status', 'in', '("canceled","canceled_by_customer","canceled_by_establishment","rejected")');

        if (aptError) throw aptError;

        const countMap: Record<string, number> = {};
        (appointments ?? []).forEach(a => {
          countMap[a.professional_id] = (countMap[a.professional_id] || 0) + 1;
        });

        return profs.map(p => ({
          professional_id: p.id,
          professional_name: p.name,
          total_30d: countMap[p.id] || 0,
        }));
      } catch {
        return [];
      }
    },
    enabled: !!establishmentId,
    staleTime: 60000,
  });

  const topServicesQuery = useQuery({
    queryKey: ['metrics-top-services', establishmentId],
    queryFn: async () => {
      try {
        const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

        const { data: appointments, error: aptError } = await supabase
          .from('appointments')
          .select('service_id')
          .eq('establishment_id', establishmentId!)
          .gte('start_at', thirtyDaysAgo)
          .not('status', 'in', '("canceled","canceled_by_customer","canceled_by_establishment","rejected")');

        if (aptError) throw aptError;
        if (!appointments || appointments.length === 0) return [];

        const countMap: Record<string, number> = {};
        appointments.forEach(a => {
          countMap[a.service_id] = (countMap[a.service_id] || 0) + 1;
        });

        const serviceIds = Object.keys(countMap);
        const { data: services, error: svcError } = await supabase
          .from('services')
          .select('id, name')
          .in('id', serviceIds);

        if (svcError) throw svcError;

        const nameMap: Record<string, string> = {};
        (services ?? []).forEach(s => { nameMap[s.id] = s.name; });

        return serviceIds
          .map(id => ({
            service_id: id,
            service_name: nameMap[id] || 'Serviço removido',
            total_30d: countMap[id],
          }))
          .sort((a, b) => b.total_30d - a.total_30d)
          .slice(0, 5);
      } catch {
        return [];
      }
    },
    enabled: !!establishmentId,
    staleTime: 60000,
  });

  const totalCustomersQuery = useQuery({
    queryKey: ['metrics-total-customers', establishmentId],
    queryFn: async () => {
      const fetchTotal = async () => {
        const { count, error } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('establishment_id', establishmentId!);
        if (error) throw error;
        return count ?? 0;
      };

      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout metrics-total-customers')), 5000)
        );
        return await Promise.race([fetchTotal(), timeoutPromise]) as number;
      } catch (err) {
        console.error('[useDashboardMetrics] totalCustomersQuery error:', err);
        return 0;
      }

    },
    enabled: !!establishmentId,
    staleTime: 60000,
  });

  const recurringCustomersQuery = useQuery({
    queryKey: ['metrics-recurring-customers', establishmentId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('customer_id')
          .eq('establishment_id', establishmentId!);
        
        if (error) throw error;
        if (!data || data.length === 0) return 0;
        
        const countByCustomer = data.reduce((acc, apt) => {
          acc[apt.customer_id] = (acc[apt.customer_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        return Object.values(countByCustomer).filter(count => count > 1).length;
      } catch {
        return 0;
      }
    },
    enabled: !!establishmentId,
    staleTime: 60000,
  });

  const appointmentsByDayQuery = useQuery({
    queryKey: ['metrics-appointments-by-day', establishmentId],
    queryFn: async () => {
      try {
        const endDate = new Date();
        const startDate = subDays(endDate, 29);
        
        const { data, error } = await supabase
          .from('appointments')
          .select('start_at, status')
          .eq('establishment_id', establishmentId!)
          .gte('start_at', startDate.toISOString())
          .lte('start_at', endDate.toISOString());
        
        if (error) throw error;
        
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const dayMap = days.reduce((acc, day) => {
          acc[format(day, 'yyyy-MM-dd')] = { date: format(day, 'dd/MM'), count: 0 };
          return acc;
        }, {} as Record<string, { date: string; count: number }>);
        
        if (data) {
          data.forEach((apt) => {
            if (!['canceled', 'canceled_by_customer', 'canceled_by_establishment', 'rejected'].includes(apt.status)) {
              const dayKey = format(startOfDay(parseISO(apt.start_at)), 'yyyy-MM-dd');
              if (dayMap[dayKey]) {
                dayMap[dayKey].count += 1;
              }
            }
          });
        }
        
        return Object.values(dayMap);
      } catch {
        return [];
      }
    },
    enabled: !!establishmentId,
    staleTime: 60000,
  });

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['metrics-today', establishmentId] });
    queryClient.invalidateQueries({ queryKey: ['metrics-week', establishmentId] });
    queryClient.invalidateQueries({ queryKey: ['metrics-canceled', establishmentId] });
    queryClient.invalidateQueries({ queryKey: ['metrics-by-professional', establishmentId] });
    queryClient.invalidateQueries({ queryKey: ['metrics-top-services', establishmentId] });
    queryClient.invalidateQueries({ queryKey: ['metrics-total-customers', establishmentId] });
    queryClient.invalidateQueries({ queryKey: ['metrics-recurring-customers', establishmentId] });
    queryClient.invalidateQueries({ queryKey: ['metrics-appointments-by-day', establishmentId] });
  }, [queryClient, establishmentId]);

  return {
    today: todayQuery.data ?? 0,
    week: weekQuery.data ?? 0,
    canceled: canceledQuery.data ?? 0,
    byProfessional: byProfessionalQuery.data ?? [],
    topServices: topServicesQuery.data ?? [],
    totalCustomers: totalCustomersQuery.data ?? 0,
    recurringCustomers: recurringCustomersQuery.data ?? 0,
    appointmentsByDay: appointmentsByDayQuery.data ?? [],
    isLoading: todayQuery.isLoading || weekQuery.isLoading || canceledQuery.isLoading || totalCustomersQuery.isLoading,
    error: null, // errors are caught internally, never crash
    refetch,
  };
}
