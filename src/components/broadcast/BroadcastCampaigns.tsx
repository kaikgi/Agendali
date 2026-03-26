import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Play, Pause, StopCircle, Eye, Loader2, Clock, CheckCircle2, AlertTriangle, TimerReset, XCircle } from "lucide-react";
import {
  useBroadcastCampaigns,
  useBroadcastContacts,
  useCreateCampaign,
  useStartCampaign,
  usePauseCampaign,
  useCancelCampaign,
  useCampaignDetails,
} from "@/hooks/useBroadcast";

const STATUS_META: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: typeof CheckCircle2;
    tone: string;
  }
> = {
  draft: { label: "Rascunho", variant: "secondary", icon: TimerReset, tone: "text-muted-foreground" },
  running: { label: "Em andamento", variant: "outline", icon: Loader2, tone: "text-foreground" },
  paused: { label: "Pausada", variant: "secondary", icon: Clock, tone: "text-muted-foreground" },
  completed: { label: "Concluída", variant: "default", icon: CheckCircle2, tone: "text-foreground" },
  completed_with_failures: { label: "Concluída com falhas", variant: "outline", icon: AlertTriangle, tone: "text-foreground" },
  failed: { label: "Falhou", variant: "destructive", icon: AlertTriangle, tone: "text-destructive" },
  canceled: { label: "Cancelada", variant: "secondary", icon: StopCircle, tone: "text-muted-foreground" },
};

const CONTACT_STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  sending: { label: "Enviando", variant: "outline" },
  sent: { label: "Enviado", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
};

export default function BroadcastCampaigns() {
  const { data: campaigns, isLoading } = useBroadcastCampaigns();
  const { data: contacts } = useBroadcastContacts();
  const createCampaign = useCreateCampaign();
  const startCampaign = useStartCampaign();
  const pauseCampaign = usePauseCampaign();
  const cancelCampaign = useCancelCampaign();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [delay, setDelay] = useState(60);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [viewCampaignId, setViewCampaignId] = useState<string | null>(null);

  const { data: campaignDetails } = useCampaignDetails(viewCampaignId);

  const detailSummary = useMemo(() => {
    const rows = campaignDetails || [];
    return {
      total: rows.length,
      sent: rows.filter((row: any) => row.status === "sent").length,
      failed: rows.filter((row: any) => row.status === "failed").length,
      pending: rows.filter((row: any) => ["pending", "sending"].includes(row.status)).length,
    };
  }, [campaignDetails]);

  const handleCreate = () => {
    if (!name || !message || selectedContacts.length === 0) return;

    createCampaign.mutate(
      { name, message, delay_seconds: delay, contactIds: selectedContacts },
      {
        onSuccess: () => {
          setShowCreate(false);
          setName("");
          setMessage("");
          setDelay(60);
          setSelectedContacts([]);
        },
      },
    );
  };

  const handleStartCampaign = (campaignId: string) => {
    console.log("[BroadcastCampaigns] start button clicked", { campaignId });
    startCampaign.mutate(campaignId);
  };

  const openCampaignDetails = (campaignId: string) => {
    console.log("[BroadcastCampaigns] opening details", { campaignId });
    setViewCampaignId(campaignId);
  };

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) => (prev.includes(id) ? prev.filter((contactId) => contactId !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (!contacts) return;
    if (selectedContacts.length === contacts.length) setSelectedContacts([]);
    else setSelectedContacts(contacts.map((contact: any) => contact.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Campanhas de disparo</h2>
          <p className="text-sm text-muted-foreground">Acompanhe progresso real, sucessos, falhas e os detalhes de cada envio.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fila de campanhas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando campanhas...</p>
          ) : !campaigns?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma campanha criada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Andamento</TableHead>
                    <TableHead>Contatos</TableHead>
                    <TableHead>Enviados</TableHead>
                    <TableHead>Falhas</TableHead>
                    <TableHead>Delay</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign: any) => {
                    const statusMeta = STATUS_META[campaign.status] || STATUS_META.draft;
                    const StatusIcon = statusMeta.icon;
                    const processed = (campaign.total_sent || 0) + (campaign.total_failed || 0);
                    const progress = campaign.total_contacts > 0 ? Math.round((processed / campaign.total_contacts) * 100) : 0;

                    return (
                      <TableRow key={campaign.id}>
                        <TableCell className="min-w-[220px]">
                          <div className="space-y-1">
                            <p className="font-medium">{campaign.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{campaign.message}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusMeta.variant} className="gap-1">
                            <StatusIcon className={`h-3.5 w-3.5 ${campaign.status === "running" ? "animate-spin" : ""}`} />
                            {statusMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="space-y-2">
                            <Progress value={progress} />
                            <p className="text-xs text-muted-foreground">{processed} de {campaign.total_contacts} processados ({progress}%)</p>
                          </div>
                        </TableCell>
                        <TableCell>{campaign.total_contacts}</TableCell>
                        <TableCell className="font-medium">{campaign.total_sent}</TableCell>
                        <TableCell className="font-medium text-destructive">{campaign.total_failed}</TableCell>
                        <TableCell className="text-xs">{campaign.delay_seconds}s</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {campaign.status === "draft" || campaign.status === "paused" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStartCampaign(campaign.id)}
                                disabled={startCampaign.isPending}
                              >
                                {startCampaign.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                              </Button>
                            ) : null}

                            {campaign.status === "running" ? (
                              <Button variant="destructive" size="sm" onClick={() => cancelCampaign.mutate(campaign.id)}>
                                <StopCircle className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}

                            <Button variant="ghost" size="sm" onClick={() => openCampaignDetails(campaign.id)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Campanha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Campanha</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Lançamento Março 2026" />
            </div>

            <div>
              <Label>Mensagem</Label>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Digite a mensagem que será enviada..."
                rows={5}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Delay entre mensagens (segundos)
              </Label>
              <Input type="number" value={delay} onChange={(event) => setDelay(Number(event.target.value))} min={5} />
              <p className="mt-1 text-xs text-muted-foreground">
                O processamento respeita o intervalo definido entre cada contato da campanha.
              </p>
            </div>

            <div>
              <Label>Selecionar Contatos ({selectedContacts.length} selecionados)</Label>
              {contacts && contacts.length > 0 ? (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border">
                  <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
                    <Checkbox checked={selectedContacts.length === contacts.length} onCheckedChange={toggleAll} />
                    <span className="text-xs font-medium">Selecionar todos</span>
                  </div>
                  {contacts.map((contact: any) => (
                    <div key={contact.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30">
                      <Checkbox checked={selectedContacts.includes(contact.id)} onCheckedChange={() => toggleContact(contact.id)} />
                      <span className="text-sm">{contact.establishment_name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{contact.normalized_phone}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Nenhum contato disponível. Cadastre contatos primeiro.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!name || !message || selectedContacts.length === 0 || createCampaign.isPending}>
              {createCampaign.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Criar Campanha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewCampaignId} onOpenChange={() => setViewCampaignId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Campanha</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-semibold">{detailSummary.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Enviados</p>
                <p className="text-2xl font-semibold">{detailSummary.sent}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Falhas</p>
                <p className="text-2xl font-semibold text-destructive">{detailSummary.failed}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-semibold">{detailSummary.pending}</p>
              </CardContent>
            </Card>
          </div>

          {campaignDetails ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tentativas</TableHead>
                    <TableHead>ID Provedor</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignDetails.map((campaignContact: any) => {
                    const statusMeta = CONTACT_STATUS_META[campaignContact.status] || CONTACT_STATUS_META.pending;
                    return (
                      <TableRow key={campaignContact.id}>
                        <TableCell className="text-sm">{campaignContact.contact?.establishment_name || "—"}</TableCell>
                        <TableCell className="text-xs">{campaignContact.contact?.normalized_phone || campaignContact.contact?.phone || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{campaignContact.attempt_count}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">{campaignContact.provider_message_id || "—"}</TableCell>
                        <TableCell className="max-w-[320px] whitespace-pre-wrap break-words text-xs text-destructive">
                          {campaignContact.error_message || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Carregando detalhes...</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}