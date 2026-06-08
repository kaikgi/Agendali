import { supabase } from '@/integrations/supabase/client';

type EmailType = 'confirmation' | 'reminder' | 'cancellation' | 'reschedule';

interface SendEmailResult {
  success: boolean;
  emailId?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

/**
 * Send appointment notification email
 * This function calls the send-appointment-email edge function
 */
export async function sendAppointmentEmail(
  type: EmailType,
  appointmentId: string
): Promise<SendEmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-appointment-email', {
      body: { type, appointmentId },
    });

    if (error) {
      console.error('Error sending appointment email:', error);
      return { success: false, error: error.message };
    }

    return data as SendEmailResult;
  } catch (err) {
    console.error('Exception sending appointment email:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}

/**
 * Send confirmation email for new appointments
 */
export function sendConfirmationEmail(appointmentId: string) {
  return sendAppointmentEmail('confirmation', appointmentId);
}

/**
 * Send cancellation email
 */
export function sendCancellationEmail(appointmentId: string) {
  return sendAppointmentEmail('cancellation', appointmentId);
}

/**
 * Send reschedule notification email
 */
export function sendRescheduleEmail(appointmentId: string) {
  return sendAppointmentEmail('reschedule', appointmentId);
}

/**
 * Send reminder email (typically called by a scheduled job)
 */
export function sendReminderEmail(appointmentId: string) {
  return sendAppointmentEmail('reminder', appointmentId);
}

/**
 * Send rating notification email to establishment owner
 */
export async function sendRatingNotificationEmail(ratingId: string): Promise<SendEmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-rating-email', {
      body: { ratingId },
    });

    if (error) {
      console.error('Error sending rating notification email:', error);
      return { success: false, error: error.message };
    }

    return data as SendEmailResult;
  } catch (err) {
    console.error('Exception sending rating notification email:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}
