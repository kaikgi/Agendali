import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  max_professionals: number;
  max_appointments_month: number;
  allow_multi_establishments: boolean;
  features: string[];
  popular: boolean;
}

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("plans")
        .select("*")
        .order("price_cents", { ascending: true });

      if (error) throw error;
      return data as Plan[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour - plans rarely change
  });
}

export function formatPriceBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function getProfessionalsLabel(maxProfessionals: number): string {
  if (maxProfessionals === 1) {
    return "1 profissional";
  }
  return `Até ${maxProfessionals} profissionais`;
}
