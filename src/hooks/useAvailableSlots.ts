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

export type SlotResult = {
  slots: string[];
  reason?: 'closed' | 'professional_closed' | 'no_hours' | 'all_past' | 'all_booked' | 'no_data';
};

export function useAvailableSlots({
  establishmentId,
  professionalId,
  serviceDurationMinutes,
  date,
  slotIntervalMinutes,
  bufferMinutes,
}: UseAvailableSlotsParams) {
  return useQuery<SlotResult>({
    queryKey: ['available-slots', establishmentId, professionalId, date?.toISOString(), serviceDurationMinutes],
    queryFn: async (): Promise<SlotResult> => {
      if (!establishmentId || !professionalId || !date) {
        return { slots: [], reason: 'no_data' };
      }

      const weekday = date.getDay();
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayStart = startOfDay(date);
      const dayEnd = addDays(dayStart, 1);

      // Fetch all data in parallel
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
        // Professional custom hours (if configured, they override establishment hours)
        supabase
          .from('professional_hours')
          .select('*')
          .eq('professional_id', professionalId)
          .eq('weekday', weekday)
          .maybeSingle(),
        (supabase.rpc as any)('public_get_booked_slots', {
          p_professional_id: professionalId,
          p_range_start: dayStart.toISOString(),
          p_range_end: dayEnd.toISOString(),
        }),
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
      const professionalHours = professionalHoursRes.data;

      // 1. Check if establishment is closed this day
      if (!businessHours || businessHours.closed || !businessHours.open_time || !businessHours.close_time) {
        console.log('[slots] Establishment closed on weekday', weekday);
        return { slots: [], reason: 'closed' };
      }

      // 2. Check if professional has custom hours and is closed this day
      // professionalHoursRes.data will be null if no custom hours configured (no row found)
      // If a row exists and closed=true, the professional doesn't work this day
      if (professionalHours && professionalHours.closed) {
        console.log('[slots] Professional closed on weekday', weekday);
        return { slots: [], reason: 'professional_closed' };
      }

      // 3. Determine effective working hours
      // If professional has custom hours for this day, use those (intersected with establishment)
      // If not, use establishment hours
      let effectiveOpenTime: string;
      let effectiveCloseTime: string;

      if (professionalHours && professionalHours.start_time && professionalHours.end_time) {
        // Use the later start and earlier end (intersection)
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

      // Validate the effective window
      if (effectiveOpenTime >= effectiveCloseTime) {
        console.log('[slots] Invalid effective hours window', { effectiveOpenTime, effectiveCloseTime });
        return { slots: [], reason: 'no_hours' };
      }

      // Parse effective times
      const [openHour, openMin] = effectiveOpenTime.split(':').map(Number);
      const [closeHour, closeMin] = effectiveCloseTime.split(':').map(Number);

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
      let totalCandidates = 0;
      let pastCount = 0;
      let conflictCount = 0;

      while (isBefore(current, endTime) || format(current, 'HH:mm') === format(endTime, 'HH:mm')) {
        const slotEnd = addMinutes(current, serviceDurationMinutes);

        // Slot must end within working hours
        if (isAfter(slotEnd, endTime) && format(slotEnd, 'HH:mm') !== format(endTime, 'HH:mm')) {
          current = addMinutes(current, slotIntervalMinutes);
          continue;
        }

        totalCandidates++;

        // Check if slot is in the future
        if (!isAfter(current, now)) {
          pastCount++;
          current = addMinutes(current, slotIntervalMinutes);
          continue;
        }

        // Check if slot conflicts with any blocked interval
        const hasConflict = blockedIntervals.some(
          (interval) =>
            // Slot starts during blocked interval
            (isAfter(current, interval.start) && isBefore(current, interval.end)) ||
            // Slot ends during blocked interval
            (isAfter(slotEnd, interval.start) && isBefore(slotEnd, interval.end)) ||
            // Slot completely contains blocked interval
            (isBefore(current, interval.start) && isAfter(slotEnd, interval.end)) ||
            // Slot starts exactly at blocked interval start
            format(current, 'HH:mm:ss') === format(interval.start, 'HH:mm:ss')
        );

        if (hasConflict) {
          conflictCount++;
        } else {
          slots.push(format(current, 'HH:mm'));
        }

        current = addMinutes(current, slotIntervalMinutes);
      }

      console.log('[slots]', dateStr, {
        effectiveOpenTime,
        effectiveCloseTime,
        totalCandidates,
        pastCount,
        conflictCount,
        available: slots.length,
        blocked: blockedIntervals.length,
      });

      if (slots.length === 0) {
        if (totalCandidates > 0 && pastCount === totalCandidates) {
          return { slots: [], reason: 'all_past' };
        }
        if (totalCandidates > 0 && conflictCount > 0) {
          return { slots: [], reason: 'all_booked' };
        }
      }

      return { slots };
    },
    enabled: !!establishmentId && !!professionalId && !!date,
  });
}
