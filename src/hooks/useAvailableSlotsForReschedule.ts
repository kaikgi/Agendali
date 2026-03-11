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
  ignoreAppointmentId?: string; // Current appointment to ignore for rescheduling
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
      const dayStart = startOfDay(date);
      const dayEnd = addDays(dayStart, 1);

      // Fetch business hours
      const { data: businessHours } = await supabase
        .from('business_hours')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('weekday', weekday)
        .single();

      if (!businessHours || businessHours.closed || !businessHours.open_time || !businessHours.close_time) {
        return [];
      }

      // Fetch professional hours
      const { data: profHours } = await supabase
        .from('professional_hours')
        .select('*')
        .eq('professional_id', professionalId)
        .eq('weekday', weekday)
        .single();

      // If professional has specific hours and is closed, return empty
      if (profHours?.closed) return [];

      // Determine working hours
      const openTime = profHours?.start_time || businessHours.open_time;
      const closeTime = profHours?.end_time || businessHours.close_time;

      // Parse times
      const [openHour, openMin] = openTime.split(':').map(Number);
      const [closeHour, closeMin] = closeTime.split(':').map(Number);

      let startTime = new Date(date);
      startTime.setHours(openHour, openMin, 0, 0);

      const endTime = new Date(date);
      endTime.setHours(closeHour, closeMin, 0, 0);

      // Fetch existing appointments - EXCLUDE the current appointment being rescheduled
      let appointmentsQuery = supabase
        .from('appointments')
        .select('id, start_at, end_at')
        .eq('professional_id', professionalId)
        .gte('start_at', dayStart.toISOString())
        .lt('start_at', dayEnd.toISOString())
        .in('status', ['booked', 'confirmed', 'pending_approval']);
      
      // Exclude the current appointment from conflict check
      if (ignoreAppointmentId) {
        appointmentsQuery = appointmentsQuery.neq('id', ignoreAppointmentId);
      }

      const { data: appointments } = await appointmentsQuery;

      // Fetch time blocks
      const { data: timeBlocks } = await supabase
        .from('time_blocks')
        .select('start_at, end_at')
        .eq('professional_id', professionalId)
        .gte('start_at', dayStart.toISOString())
        .lt('start_at', dayEnd.toISOString());

      // Fetch recurring time blocks
      const { data: recurringBlocks } = await supabase
        .from('recurring_time_blocks')
        .select('start_time, end_time')
        .eq('professional_id', professionalId)
        .eq('weekday', weekday)
        .eq('active', true);

      // Build blocked intervals
      const blockedIntervals: { start: Date; end: Date }[] = [];

      // Add appointments with buffer
      appointments?.forEach((apt) => {
        blockedIntervals.push({
          start: addMinutes(parseISO(apt.start_at), -bufferMinutes),
          end: addMinutes(parseISO(apt.end_at), bufferMinutes),
        });
      });

      // Add time blocks
      timeBlocks?.forEach((block) => {
        blockedIntervals.push({
          start: parseISO(block.start_at),
          end: parseISO(block.end_at),
        });
      });

      // Add recurring blocks
      recurringBlocks?.forEach((block) => {
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
      let current = startTime;

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

      return slots;
    },
    enabled: !!establishmentId && !!professionalId && !!date,
  });
}
