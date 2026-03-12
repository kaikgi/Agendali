import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserEstablishment } from './useUserEstablishment';

export interface InAppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  is_read: boolean;
  appointment_id: string | null;
  created_at: string;
}

export function useInAppNotifications() {
  const { data: establishment } = useUserEstablishment();
  const queryClient = useQueryClient();
  const establishmentId = establishment?.id;

  // Fetch notifications from DB
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['establishment-notifications', establishmentId],
    queryFn: async () => {
      if (!establishmentId) return [];
      const { data, error } = await supabase
        .from('establishment_notifications')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[Notifications] Error fetching:', error);
        return [];
      }

      return (data || []).map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data || {},
        is_read: n.is_read,
        appointment_id: n.appointment_id,
        created_at: n.created_at,
      })) as InAppNotification[];
    },
    enabled: !!establishmentId,
    refetchInterval: 30000, // Fallback polling every 30s
  });

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!establishmentId) return;

    const channel = supabase
      .channel(`notifications-${establishmentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'establishment_notifications',
          filter: `establishment_id=eq.${establishmentId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['establishment-notifications', establishmentId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [establishmentId, queryClient]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = useCallback(
    async (notificationId: string) => {
      // Optimistic update
      queryClient.setQueryData(
        ['establishment-notifications', establishmentId],
        (old: InAppNotification[] | undefined) =>
          (old || []).map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );

      const { error } = await supabase
        .from('establishment_notifications')
        .update({ is_read: true } as any)
        .eq('id', notificationId);

      if (error) console.error('[Notifications] Error marking as read:', error);
    },
    [establishmentId, queryClient]
  );

  const markAllAsRead = useCallback(async () => {
    if (!establishmentId) return;

    queryClient.setQueryData(
      ['establishment-notifications', establishmentId],
      (old: InAppNotification[] | undefined) =>
        (old || []).map((n) => ({ ...n, is_read: true }))
    );

    const { error } = await supabase
      .from('establishment_notifications')
      .update({ is_read: true } as any)
      .eq('establishment_id', establishmentId)
      .eq('is_read', false);

    if (error) console.error('[Notifications] Error marking all as read:', error);
  }, [establishmentId, queryClient]);

  const removeNotification = useCallback(
    async (notificationId: string) => {
      queryClient.setQueryData(
        ['establishment-notifications', establishmentId],
        (old: InAppNotification[] | undefined) =>
          (old || []).filter((n) => n.id !== notificationId)
      );

      const { error } = await supabase
        .from('establishment_notifications')
        .delete()
        .eq('id', notificationId);

      if (error) console.error('[Notifications] Error removing:', error);
    },
    [establishmentId, queryClient]
  );

  const clearNotifications = useCallback(async () => {
    if (!establishmentId) return;

    queryClient.setQueryData(['establishment-notifications', establishmentId], []);

    const { error } = await supabase
      .from('establishment_notifications')
      .delete()
      .eq('establishment_id', establishmentId);

    if (error) console.error('[Notifications] Error clearing:', error);
  }, [establishmentId, queryClient]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearNotifications,
  };
}
