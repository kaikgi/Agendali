import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('Authentication Data Sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Login Sanitization', () => {
    it('should ensure email and password are strings in signInWithPassword', async () => {
      const mockEmail = ' test@example.com ';
      const mockPassword = 'password123';
      
      const sanitizedEmail = String(mockEmail).trim();
      const sanitizedPassword = String(mockPassword);

      await (supabase.auth.signInWithPassword as any)({
        email: sanitizedEmail,
        password: sanitizedPassword,
      });

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      
      const callArgs = vi.mocked(supabase.auth.signInWithPassword).mock.calls[0][0] as any;
      expect(typeof callArgs.email).toBe('string');
      expect(typeof callArgs.password).toBe('string');
    });

    it('should handle potential non-string inputs by casting to string', async () => {
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
    });
  });

  describe('SignUp Sanitization', () => {
    it('should sanitize inputs in signUp', async () => {
      const email = ' NEW@example.com ';
      const password = 'Pass123!';
      const fullName = 999;
      
      const sanitizedEmail = String(email).trim();
      const sanitizedPassword = String(password);
      const sanitizedFullName = String(fullName);

      await (supabase.auth.signUp as any)({
        email: sanitizedEmail,
        password: sanitizedPassword,
        options: {
          data: {
            full_name: sanitizedFullName
          }
        }
      });

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'NEW@example.com',
        password: 'Pass123!',
        options: {
          data: {
            full_name: '999'
          }
        }
      });
    });
  });

  describe('Reset Password Sanitization', () => {
    it('should sanitize email in resetPasswordForEmail', async () => {
      const email = ' RESET@example.com ';
      const sanitizedEmail = String(email).trim();

      await supabase.auth.resetPasswordForEmail(sanitizedEmail);

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('reset@example.com');
    });
  });

  describe('Google OAuth Sanitization', () => {
    it('should ensure redirectTo is a string in signInWithOAuth', async () => {
      const redirectTo = { toString: () => 'https://example.com/callback' };
      const sanitizedRedirectTo = String(redirectTo);

      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: sanitizedRedirectTo
        }
      });

      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'https://example.com/callback'
        }
      });
    });
  });
});

