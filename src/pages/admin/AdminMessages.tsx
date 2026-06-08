import { useState } from "react";
import { useAdminContactMessages, useUpdateContactMessageStatus } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, Mail, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function AdminMessages() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [selectedMessage, setSelectedMessage] = useState<{
    id: string;
    name: string;
    email: string;
    message: string;
  } | null>(null);
  const [reply, setReply] = useState("");

  const { data, isLoading, error } = useAdminContactMessages(statusFilter);
  const updateStatus = useUpdateContactMessageStatus();

  const handleMarkAsReplied = async (messageId: string, replyText?: string) => {
    try {
      await (updateStatus as any).mutateAsync({
        messageId,
        status: "replied",
        reply: replyText,
      });
      toast.success("Mensagem marcada como respondida");
      setSelectedMessage(null);
      setReply("");
    } catch (err) {
      toast.error("Erro ao atualizar mensagem");
    }
  };

  const handleMarkAsClosed = async (messageId: string) => {
    try {
      await (updateStatus as any).mutateAsync({
        messageId,
        status: "closed",
      });
      toast.success("Mensagem fechada");
    } catch (err) {
      toast.error("Erro ao fechar mensagem");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return <Badge variant="destructive">Nova</Badge>;
      case "replied":
        return <Badge variant="secondary">Respondida</Badge>;
      case "closed":
        return <Badge variant="outline">Fechada</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Erro ao carregar mensagens</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mensagens de Contato</h1>
        <p className="text-muted-foreground">Gerencie as mensagens recebidas pelo formulário de contato</p>
      </div>

      {/* Tabs for filtering */}
      <Tabs defaultValue="all" onValueChange={(v) => setStatusFilter(v === "all" ? undefined : v)}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="new">Novas</TabsTrigger>
          <TabsTrigger value="replied">Respondidas</TabsTrigger>
          <TabsTrigger value="closed">Fechadas</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Results count */}
      {data && (
        <p className="text-sm text-muted-foreground">
          {data.total} mensagem(ns) encontrada(s)
        </p>
      )}

      {/* Messages List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : data?.messages?.length ? (
        <div className="space-y-4">
          {data.messages.map((msg) => (
            <Card key={msg.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{msg.name}</CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {msg.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(msg.status)}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(msg.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>

                {msg.admin_reply && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Resposta:</p>
                    <p className="text-sm">{msg.admin_reply}</p>
                    {msg.replied_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Respondido em {format(new Date(msg.replied_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {msg.status === "new" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          setSelectedMessage({
                            id: msg.id,
                            name: msg.name,
                            email: msg.email,
                            message: msg.message,
                          })
                        }
                      >
                        Responder
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkAsReplied(msg.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Marcar como Respondida
                      </Button>
                    </>
                  )}
                  {msg.status !== "closed" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAsClosed(msg.id)}
                    >
                      Fechar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma mensagem encontrada</p>
          </CardContent>
        </Card>
      )}

      {/* Reply Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Responder Mensagem</DialogTitle>
            <DialogDescription>
              Responder para: {selectedMessage?.name} ({selectedMessage?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-1">Mensagem original:</p>
              <p className="text-sm">{selectedMessage?.message}</p>
            </div>

            <div>
              <label className="text-sm font-medium">Sua resposta</label>
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Digite sua resposta..."
                rows={5}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMessage(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => selectedMessage && handleMarkAsReplied(selectedMessage.id, reply)}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? "Enviando..." : "Enviar Resposta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
