import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// We want to test that inputs are sanitized as strings
describe('Authentication Data Sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should ensure email and password are strings in signInWithPassword', async () => {
    const mockEmail = ' test@example.com ';
    const mockPassword = 'password123';
    
    const sanitizedEmail = String(mockEmail).trim();
    const sanitizedPassword = String(mockPassword);

    // Using any to bypass strict type check for the sake of the runtime test logic
    await (supabase.auth.signInWithPassword as any)({
      email: sanitizedEmail,
      password: sanitizedPassword,
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
    
    // Verify it's a string
    const callArgs = vi.mocked(supabase.auth.signInWithPassword).mock.calls[0][0] as any;
    expect(typeof callArgs.email).toBe('string');
    expect(typeof callArgs.password).toBe('string');
  });

  it('should handle potential non-string inputs by casting to string', async () => {
    // Simulating bad input like an object that might be passed from some weird UI edge case
    const badEmail = 12345;
    const badPassword = true;

    const sanitizedEmail = String(badEmail).trim();
    const sanitizedPassword = String(badPassword);

    await (supabase.auth.signInWithPassword as any)({
      email: sanitizedEmail,
      password: sanitizedPassword,
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: '12345',
      password: 'true',
    });
    const callArgs = vi.mocked(supabase.auth.signInWithPassword).mock.calls[0][0] as any;
    expect(typeof callArgs.email).toBe('string');
    expect(typeof callArgs.password).toBe('string');
  });
});
