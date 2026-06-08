import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Skull, AlertTriangle, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DeletionJob {
  id: string;
  establishment_id: string;
  owner_user_id: string | null;
  requested_by_admin_user_id: string;
  status: string;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'done':
      return <Badge className="gap-1 bg-green-600 hover:bg-green-700"><CheckCircle2 size={12} /> Concluído</Badge>;
    case 'failed':
      return <Badge variant="destructive" className="gap-1"><XCircle size={12} /> Falhou</Badge>;
    case 'running':
      return <Badge variant="secondary" className="gap-1"><Loader2 size={12} className="animate-spin" /> Executando</Badge>;
    default:
      return <Badge variant="outline" className="gap-1"><Clock size={12} /> {status}</Badge>;
  }
}

export default function AdminDangerZone() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["admin-deletion-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("establishment_deletion_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as DeletionJob[];
    },
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-destructive flex items-center gap-2">
          <Skull className="h-6 w-6" />
          Danger Zone
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Histórico de exclusões permanentes de estabelecimentos.
        </p>
      </div>

      {/* Warning */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-destructive">Área restrita — Operações irreversíveis</p>
              <p className="text-sm text-muted-foreground mt-1">
                As exclusões permanentes são feitas na tela de Estabelecimentos usando o botão de lixeira. Aqui você pode acompanhar o histórico de execução.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deletion Jobs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Histórico de Exclusões</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !jobs?.length ? (
            <p className="text-muted-foreground text-center py-8 text-sm">Nenhuma exclusão registrada</p>
          ) : (
            <div className="divide-y">
              {jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="space-y-0.5">
                    <p className="text-sm font-mono">{job.establishment_id.slice(0, 8)}…</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(job.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusIcon status={job.status} />
                    {job.error && (
                      <span className="text-xs text-destructive max-w-[200px] truncate" title={job.error}>
                        {job.error}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
