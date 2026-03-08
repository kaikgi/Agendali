import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addMinutes, parseISO, isAfter, isBefore, startOfDay, addDays } from 'date-fns';

interface UseAvailableSlotsParams {
  establishmentId: string | undefined;
  professionalId: string | undefined;
  serviceDurationMinutes: number;
  date: Date | undefined;
  slotIntervalMinutes: number;
  bufferMinutes: number;
}

export function useAvailableSlots({
  establishmentId,
  professionalId,
  serviceDurationMinutes,
  date,
  slotIntervalMinutes,
  bufferMinutes,
}: UseAvailableSlotsParams) {
  return useQuery({
    queryKey: ['available-slots', establishmentId, professionalId, date?.toISOString(), serviceDurationMinutes],
    queryFn: async () => {
      if (!establishmentId || !professionalId || !date) return [];

      const weekday = date.getDay();
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayStart = startOfDay(date);
      const dayEnd = addDays(dayStart, 1);

      // Fetch business hours and professional hours in parallel
      const [businessHoursRes, profHoursRes, appointmentsRes, timeBlocksRes, estTimeBlocksRes, recurringBlocksRes, estRecurringBlocksRes] = await Promise.all([
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
        supabase
          .from('appointments')
          .select('start_at, end_at')
          .eq('professional_id', professionalId)
          .gte('start_at', dayStart.toISOString())
          .lt('start_at', dayEnd.toISOString())
          .in('status', ['booked', 'confirmed']),
        // Professional-specific time blocks
        supabase
          .from('time_blocks')
          .select('start_at, end_at')
          .eq('professional_id', professionalId)
          .gte('start_at', dayStart.toISOString())
          .lt('start_at', dayEnd.toISOString()),
        // Establishment-wide time blocks (professional_id is null)
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

      const businessHours = businessHoursRes.data;
      const profHours = profHoursRes.data;

      // Determine working hours:
      // 1. If professional has specific hours → use them
      // 2. Else fall back to business hours
      // 3. If neither exists → no slots
      let openTime: string | null = null;
      let closeTime: string | null = null;

      if (profHours) {
        // Professional has hours configured for this weekday
        if (profHours.closed) return [];
        openTime = profHours.start_time;
        closeTime = profHours.end_time;
      }

      if (!openTime || !closeTime) {
        // Fall back to business hours
        if (!businessHours || businessHours.closed || !businessHours.open_time || !businessHours.close_time) {
          // No hours configured at all for this day
          console.log('[slots] No working hours found for weekday', weekday, {
            profHours,
            businessHours,
          });
          return [];
        }
        openTime = businessHours.open_time;
        closeTime = businessHours.close_time;
      }

      // Parse times
      const [openHour, openMin] = openTime.split(':').map(Number);
      const [closeHour, closeMin] = closeTime.split(':').map(Number);

      const startTime = new Date(date);
      startTime.setHours(openHour, openMin, 0, 0);

      const endTime = new Date(date);
      endTime.setHours(closeHour, closeMin, 0, 0);

      // Build blocked intervals
      const blockedIntervals: { start: Date; end: Date }[] = [];

      // Add appointments with buffer
      appointmentsRes.data?.forEach((apt) => {
        blockedIntervals.push({
          start: addMinutes(parseISO(apt.start_at), -bufferMinutes),
          end: addMinutes(parseISO(apt.end_at), bufferMinutes),
        });
      });

      // Add time blocks (professional + establishment-wide)
      [...(timeBlocksRes.data || []), ...(estTimeBlocksRes.data || [])].forEach((block) => {
        blockedIntervals.push({
          start: parseISO(block.start_at),
          end: parseISO(block.end_at),
        });
      });

      // Add recurring blocks (professional + establishment-wide)
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

      while (isBefore(addMinutes(current, serviceDurationMinutes), endTime) ||
             format(addMinutes(current, serviceDurationMinutes), 'HH:mm') === format(endTime, 'HH:mm')) {
        const slotEnd = addMinutes(current, serviceDurationMinutes);

        // Check if slot is in the future
        if (isAfter(current, now)) {
          // Check if slot conflicts with any blocked interval
          const hasConflict = blockedIntervals.some(
            (interval) =>
              (isAfter(current, interval.start) && isBefore(current, interval.end)) ||
              (isAfter(slotEnd, interval.start) && isBefore(slotEnd, interval.end)) ||
              (isBefore(current, interval.start) && isAfter(slotEnd, interval.end)) ||
              format(current, 'HH:mm') === format(interval.start, 'HH:mm')
          );

          if (!hasConflict) {
            slots.push(format(current, 'HH:mm'));
          }
        }

        current = addMinutes(current, slotIntervalMinutes);
      }

      console.log('[slots] Generated', slots.length, 'slots for', dateStr, { openTime, closeTime, blockedIntervals: blockedIntervals.length });

      return slots;
    },
    enabled: !!establishmentId && !!professionalId && !!date,
  });
}
