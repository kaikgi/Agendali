import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Mail, Plus, RefreshCw, CheckCircle2, XCircle, Send } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface AllowedSignup {
  email: string;
  plan_id: string;
  kiwify_order_id: string;
  paid_at: string;
  used: boolean;
  created_at: string;
  activation_sent_at: string | null;
}

export default function AdminAllowedEmails() {
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPlan, setNewPlan] = useState("solo");
  const queryClient = useQueryClient();

  const { data: signups, isLoading, refetch } = useQuery({
    queryKey: ["admin-allowed-emails", search],
    queryFn: async () => {
      let query = supabase
        .from("allowed_establishment_signups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (search) {
        query = query.ilike("email", `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AllowedSignup[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({ email, plan }: { email: string; plan: string }) => {
      const normalized = email.toLowerCase().trim();
      const { error } = await supabase
        .from("allowed_establishment_signups")
        .upsert({
          email: normalized,
          plan_id: plan,
          kiwify_order_id: `manual-admin-${crypto.randomUUID()}`,
          paid_at: new Date().toISOString(),
          used: false,
        }, { onConflict: "email" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Email autorizado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["admin-allowed-emails"] });
      setAddDialogOpen(false);
      setNewEmail("");
      setNewPlan("solo");
    },
    onError: () => toast.error("Erro ao autorizar email"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ email, used }: { email: string; used: boolean }) => {
      const { error } = await supabase
        .from("allowed_establishment_signups")
        .update({ used })
        .eq("email", email);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      queryClient.invalidateQueries({ queryKey: ["admin-allowed-emails"] });
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const resendMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      // Clear activation_sent_at to allow resend, then trigger via edge function
      await supabase
        .from("allowed_establishment_signups")
        .update({ activation_sent_at: null })
        .eq("email", email);

      // Call a lightweight edge function to trigger the resend
      const response = await supabase.functions.invoke("admin-resend-activation", {
        body: { email },
      });
      if (response.error) throw response.error;
      const data = response.data as { ok?: boolean; error?: string };
      if (!data?.ok) throw new Error(data?.error || "Erro ao reenviar");
    },
    onSuccess: () => {
      toast.success("Link de ativação reenviado!");
      queryClient.invalidateQueries({ queryKey: ["admin-allowed-emails"] });
    },
    onError: (err: Error) => toast.error(`Erro ao reenviar: ${err.message}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Emails Autorizados</h1>
          <p className="text-muted-foreground">
            Emails liberados para criar conta de estabelecimento
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : signups?.length ? (
        <div className="space-y-3">
          {signups.map((s) => (
            <Card key={s.email}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:py-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{s.email}</span>
                    <Badge variant={s.used ? "secondary" : "default"}>
                      {s.used ? "Usado" : "Disponível"}
                    </Badge>
                    <Badge variant="outline">{s.plan_id}</Badge>
                    {s.activation_sent_at && (
                      <Badge variant="outline" className="text-xs">
                        ✉️ Enviado
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Pago em {format(new Date(s.paid_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    {" · "}
                    Order: {s.kiwify_order_id.substring(0, 20)}...
                    {s.activation_sent_at && (
                      <>
                        {" · "}
                        Email enviado em {format(new Date(s.activation_sent_at), "dd/MM HH:mm", { locale: ptBR })}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resendMutation.mutate({ email: s.email })}
                    disabled={resendMutation.isPending}
                    title="Reenviar link de ativação"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Reenviar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleMutation.mutate({ email: s.email, used: !s.used })}
                  >
                    {s.used ? (
                      <>
                        <XCircle className="h-4 w-4 mr-1" />
                        Reabrir
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Marcar Usado
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum email autorizado encontrado</p>
          </CardContent>
        </Card>
      )}

      {/* Add Email Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Autorizar Email</DialogTitle>
            <DialogDescription>
              Adicione manualmente um email para criar conta de estabelecimento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={newPlan} onValueChange={setNewPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solo">Solo</SelectItem>
                  <SelectItem value="studio">Studio</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => addMutation.mutate({ email: newEmail, plan: newPlan })}
              disabled={!newEmail || addMutation.isPending}
            >
              {addMutation.isPending ? "Salvando..." : "Autorizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
