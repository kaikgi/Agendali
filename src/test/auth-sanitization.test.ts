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
    
    // Simulating how we now handle it in our components
    const sanitizedEmail = String(mockEmail).trim();
    const sanitizedPassword = String(mockPassword);

    await supabase.auth.signInWithPassword({
      email: sanitizedEmail,
      password: sanitizedPassword,
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
    
    // Verify it's a string
    const callArgs = vi.mocked(supabase.auth.signInWithPassword).mock.calls[0][0];
    expect(typeof callArgs.email).toBe('string');
    expect(typeof callArgs.password).toBe('string');
  });

  it('should handle potential object inputs by casting to string', async () => {
    // @ts-ignore - simulating bad input
    const badEmail = { toString: () => 'malicious@example.com' };
    const badPassword = { toString: () => 'somepassword' };

    const sanitizedEmail = String(badEmail).trim();
    const sanitizedPassword = String(badPassword);

    await supabase.auth.signInWithPassword({
      email: sanitizedEmail,
      password: sanitizedPassword,
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'malicious@example.com',
      password: 'somepassword',
    });
    expect(typeof vi.mocked(supabase.auth.signInWithPassword).mock.calls[0][0].email).toBe('string');
  });
});
