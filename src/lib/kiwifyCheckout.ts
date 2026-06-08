// Kiwify checkout URLs for each plan
// These map to the hardcoded plans in hardcodedPlans.ts

export const KIWIFY_CHECKOUT_URLS = {
  solo: 'https://pay.kiwify.com.br/3Zeym7r',
  studio: 'https://pay.kiwify.com.br/uc7CCUY',
  pro: 'https://pay.kiwify.com.br/i9OOO1',
} as const;

export type PlanCode = keyof typeof KIWIFY_CHECKOUT_URLS;

/**
 * Get the Kiwify checkout URL for a plan, optionally with user tracking
 * @param planCode - The plan code (solo, studio, or pro)
 * @param userId - Optional user ID to pass for tracking (helps with auto-linking subscription)
 * @param email - Optional email to pre-fill in checkout
 */
export function getKiwifyCheckoutUrl(
  planCode: PlanCode | string,
  userId?: string,
  email?: string
): string {
  // Get base URL or default to solo
  const baseUrl = KIWIFY_CHECKOUT_URLS[planCode as PlanCode] || KIWIFY_CHECKOUT_URLS.solo;
  
  // Build URL with tracking parameters
  const url = new URL(baseUrl);
  
  // Add user_id as s1 parameter (Kiwify uses s1-s3 for custom tracking)
  if (userId) {
    url.searchParams.set('s1', userId);
  }
  
  // Add email as pre-fill if available
  if (email) {
    url.searchParams.set('email', email);
  }
  
  return url.toString();
}

/**
 * Check if a plan code is valid
 */
export function isValidPlanCode(planCode: string): planCode is PlanCode {
  return planCode in KIWIFY_CHECKOUT_URLS;
}
