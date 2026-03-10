import { z } from 'zod';

// Brazilian phone validation: 10 or 11 digits (DDD + phone)
const phoneRegex = /^\d{10,11}$/;

export const customerFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome é obrigatório')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  phone: z
    .string()
    .min(1, 'Telefone é obrigatório')
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(z.string().regex(phoneRegex, 'Telefone deve ter DDD + 8 ou 9 dígitos')),
  email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(500, 'Observações devem ter no máximo 500 caracteres')
    .optional(),
  acceptPolicy: z.boolean().optional(),
});

export type CustomerFormData = z.infer<typeof customerFormSchema>;

// Phone mask helper (keeping for backwards compatibility)
export function formatPhone(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers.length ? `(${numbers}` : '';
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
}
