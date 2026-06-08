import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addMinutes, parseISO, isAfter, isBefore, startOfDay, addDays } from 'date-fns';

interface UseAvailableSlotsForRescheduleParams {
  establishmentId: string | undefined;
  professionalId: string | undefined;
  serviceDurationMinutes: number;
  date: Date | undefined;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  ignoreAppointmentId?: string;
}

export function useAvailableSlotsForReschedule({
  establishmentId,
  professionalId,
  serviceDurationMinutes,
  date,
  slotIntervalMinutes,
  bufferMinutes,
  ignoreAppointmentId,
}: UseAvailableSlotsForRescheduleParams) {
  return useQuery({
    queryKey: ['available-slots-reschedule', establishmentId, professionalId, date?.toISOString(), serviceDurationMinutes, ignoreAppointmentId],
    queryFn: async () => {
      if (!establishmentId || !professionalId || !date) return [];

      const weekday = date.getDay();
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayStart = startOfDay(date);
      const dayEnd = addDays(dayStart, 1);

      console.log('[reschedule-slots] Fetching slots for:', {
        establishmentId,
        professionalId,
        date: dateStr,
        weekday,
        serviceDurationMinutes,
        slotIntervalMinutes,
        bufferMinutes,
        ignoreAppointmentId,
      });

      // Fetch all data in parallel (mirrors useAvailableSlots)
      const [
        businessHoursRes,
        professionalHoursRes,
        appointmentsRes,
        timeBlocksRes,
        estTimeBlocksRes,
        recurringBlocksRes,
        estRecurringBlocksRes,
      ] = await Promise.all([
        supabase
          .from('business_hours')
          .select('*')
          .eq('establishment_id', establishmentId)
          .eq('weekday', weekday)
          .maybeSingle(),
        supabase
          .from('professional_hours')
          .select('*')
          .eq('professional_id', professionalId)
          .eq('weekday', weekday)
          .maybeSingle(),
        (() => {
          let q = supabase
            .from('appointments')
            .select('id, start_at, end_at')
            .eq('professional_id', professionalId)
            .gte('start_at', dayStart.toISOString())
            .lt('start_at', dayEnd.toISOString())
            .in('status', ['booked', 'confirmed', 'pending_approval', 'paid_confirmed', 'paid_pending_confirmation', 'pending_payment']);
          if (ignoreAppointmentId) {
            q = q.neq('id', ignoreAppointmentId);
          }
          return q;
        })(),
        // Professional-specific time blocks
        supabase
          .from('time_blocks')
          .select('start_at, end_at')
          .eq('professional_id', professionalId)
          .gte('start_at', dayStart.toISOString())
          .lt('start_at', dayEnd.toISOString()),
        // Establishment-wide time blocks
        supabase
          .from('time_blocks')
          .select('start_at, end_at')
          .eq('establishment_id', establishmentId)
          .is('professional_id', null)
          .gte('start_at', dayStart.toISOString())
          .lt('start_at', dayEnd.toISOString()),
        // Professional-specific recurring blocks
        supabase
          .from('recurring_time_blocks')
          .select('start_time, end_time')
          .eq('professional_id', professionalId)
          .eq('weekday', weekday)
          .eq('active', true),
        // Establishment-wide recurring blocks
        supabase
          .from('recurring_time_blocks')
          .select('start_time, end_time')
          .eq('establishment_id', establishmentId)
          .is('professional_id', null)
          .eq('weekday', weekday)
          .eq('active', true),
      ]);

      // Check for query errors - log them and throw if critical
      const queryErrors = [
        businessHoursRes.error && `business_hours: ${businessHoursRes.error.message}`,
        professionalHoursRes.error && `professional_hours: ${professionalHoursRes.error.message}`,
        appointmentsRes.error && `appointments: ${appointmentsRes.error.message}`,
        timeBlocksRes.error && `time_blocks: ${timeBlocksRes.error.message}`,
        estTimeBlocksRes.error && `est_time_blocks: ${estTimeBlocksRes.error.message}`,
        recurringBlocksRes.error && `recurring_blocks: ${recurringBlocksRes.error.message}`,
        estRecurringBlocksRes.error && `est_recurring_blocks: ${estRecurringBlocksRes.error.message}`,
      ].filter(Boolean);

      if (queryErrors.length > 0) {
        console.error('[reschedule-slots] Query errors:', queryErrors);
      }

      // Critical: if business_hours query failed, throw instead of returning empty
      if (businessHoursRes.error) {
        throw new Error(`Erro ao buscar horários: ${businessHoursRes.error.message}`);
      }

      const businessHours = businessHoursRes.data;
      const professionalHours = professionalHoursRes.data;

      // Check if establishment is closed
      if (!businessHours || businessHours.closed || !businessHours.open_time || !businessHours.close_time) {
        console.log('[reschedule-slots] Establishment closed on weekday', weekday, { businessHours });
        return [];
      }

      // Check if professional is closed
      if (professionalHours && professionalHours.closed) {
        console.log('[reschedule-slots] Professional closed on weekday', weekday);
        return [];
      }

      // Determine effective working hours (intersection of business + professional)
      let effectiveOpenTime: string;
      let effectiveCloseTime: string;

      if (professionalHours && professionalHours.start_time && professionalHours.end_time) {
        effectiveOpenTime = professionalHours.start_time > businessHours.open_time
          ? professionalHours.start_time
          : businessHours.open_time;
        effectiveCloseTime = professionalHours.end_time < businessHours.close_time
          ? professionalHours.end_time
          : businessHours.close_time;
      } else {
        effectiveOpenTime = businessHours.open_time;
        effectiveCloseTime = businessHours.close_time;
      }

      if (effectiveOpenTime >= effectiveCloseTime) {
        console.log('[reschedule-slots] Invalid effective hours', { effectiveOpenTime, effectiveCloseTime });
        return [];
      }

      const [openHour, openMin] = effectiveOpenTime.split(':').map(Number);
      const [closeHour, closeMin] = effectiveCloseTime.split(':').map(Number);

      const startTime = new Date(date);
      startTime.setHours(openHour, openMin, 0, 0);
      const endTime = new Date(date);
      endTime.setHours(closeHour, closeMin, 0, 0);

      // Build blocked intervals
      const blockedIntervals: { start: Date; end: Date }[] = [];

      appointmentsRes.data?.forEach((apt) => {
        blockedIntervals.push({
          start: addMinutes(parseISO(apt.start_at), -bufferMinutes),
          end: addMinutes(parseISO(apt.end_at), bufferMinutes),
        });
      });

      [...(timeBlocksRes.data || []), ...(estTimeBlocksRes.data || [])].forEach((block) => {
        blockedIntervals.push({
          start: parseISO(block.start_at),
          end: parseISO(block.end_at),
        });
      });

      [...(recurringBlocksRes.data || []), ...(estRecurringBlocksRes.data || [])].forEach((block) => {
        const [startH, startM] = block.start_time.split(':').map(Number);
        const [endH, endM] = block.end_time.split(':').map(Number);
        const blockStart = new Date(date);
        blockStart.setHours(startH, startM, 0, 0);
        const blockEnd = new Date(date);
        blockEnd.setHours(endH, endM, 0, 0);
        blockedIntervals.push({ start: blockStart, end: blockEnd });
      });

      // Generate slots
      const slots: string[] = [];
      const now = new Date();
      let current = new Date(startTime);
      let totalCandidates = 0;
      let pastCount = 0;
      let conflictCount = 0;

      const effectiveInterval = slotIntervalMinutes > 0 ? slotIntervalMinutes : 15;

      while (isBefore(current, endTime) || format(current, 'HH:mm') === format(endTime, 'HH:mm')) {
        const slotEnd = addMinutes(current, serviceDurationMinutes);

        if (isAfter(slotEnd, endTime) && format(slotEnd, 'HH:mm') !== format(endTime, 'HH:mm')) {
          current = addMinutes(current, effectiveInterval);
          continue;
        }

        totalCandidates++;

        if (!isAfter(current, now)) {
          pastCount++;
          current = addMinutes(current, effectiveInterval);
          continue;
        }

        const hasConflict = blockedIntervals.some(
          (interval) =>
            (isAfter(current, interval.start) && isBefore(current, interval.end)) ||
            (isAfter(slotEnd, interval.start) && isBefore(slotEnd, interval.end)) ||
            (isBefore(current, interval.start) && isAfter(slotEnd, interval.end)) ||
            format(current, 'HH:mm:ss') === format(interval.start, 'HH:mm:ss')
        );

        if (hasConflict) {
          conflictCount++;
        } else {
          slots.push(format(current, 'HH:mm'));
        }

        current = addMinutes(current, effectiveInterval);
      }

      console.log('[reschedule-slots]', dateStr, {
        effectiveOpenTime,
        effectiveCloseTime,
        totalCandidates,
        pastCount,
        conflictCount,
        available: slots.length,
        blockedIntervals: blockedIntervals.length,
        appointments: appointmentsRes.data?.length ?? 0,
        ignoredId: ignoreAppointmentId,
      });

      return slots;
    },
    enabled: !!establishmentId && !!professionalId && !!date,
  });
}
