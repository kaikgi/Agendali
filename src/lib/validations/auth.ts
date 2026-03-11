import { z } from 'zod';

// Brazilian phone validation: 10 or 11 digits (DDD + phone)
const phoneRegex = /^\d{10,11}$/;

// Strong password: min 8 chars, uppercase, lowercase, number, special char
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~';]).{8,}$/;

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
  password: z
    .string()
    .min(1, 'Senha é obrigatória')
    .min(8, 'Senha deve ter pelo menos 8 caracteres'),
});

export const clientSignupSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo'),
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
  phone: z
    .string()
    .regex(phoneRegex, 'Telefone deve ter DDD + 8 ou 9 dígitos'),
  password: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(strongPasswordRegex, 'Senha deve conter maiúscula, minúscula, número e caractere especial'),
  confirmPassword: z
    .string()
    .min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export const signupSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo'),
  companyName: z
    .string()
    .min(2, 'Nome da empresa deve ter pelo menos 2 caracteres')
    .max(100, 'Nome da empresa muito longo'),
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
  phone: z
    .string()
    .regex(phoneRegex, 'Telefone deve ter DDD + 8 ou 9 dígitos'),
  password: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(strongPasswordRegex, 'Senha deve conter maiúscula, minúscula, número e caractere especial'),
  confirmPassword: z
    .string()
    .min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type ClientSignupFormData = z.infer<typeof clientSignupSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
