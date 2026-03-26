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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, Play, Pause, StopCircle, Eye, Loader2, Clock, CheckCircle2,
  AlertTriangle, TimerReset, XCircle, ChevronDown, ChevronRight, User, FileSpreadsheet,
} from "lucide-react";
import {
  useBroadcastCampaigns,
  useBroadcastContacts,
  useContactBatches,
  useCreateCampaign,
  useStartCampaign,
  usePauseCampaign,
  useCancelCampaign,
  useCampaignDetails,
} from "@/hooks/useBroadcast";

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  draft: { label: "Rascunho", variant: "secondary", icon: TimerReset },
  running: { label: "Em andamento", variant: "outline", icon: Loader2 },
  paused: { label: "Pausada", variant: "secondary", icon: Clock },
  completed: { label: "Concluída", variant: "default", icon: CheckCircle2 },
  completed_with_failures: { label: "Concluída com falhas", variant: "outline", icon: AlertTriangle },
  failed: { label: "Falhou", variant: "destructive", icon: AlertTriangle },
  canceled: { label: "Cancelada", variant: "secondary", icon: StopCircle },
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
  const { data: batches } = useContactBatches();
  const createCampaign = useCreateCampaign();
  const startCampaign = useStartCampaign();
  const pauseCampaign = usePauseCampaign();
  const cancelCampaign = useCancelCampaign();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [delay, setDelay] = useState(60);
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());
  const [deselectedContacts, setDeselectedContacts] = useState<Set<string>>(new Set());
  const [expandedCreateBatches, setExpandedCreateBatches] = useState<Set<string>>(new Set());
  const [viewCampaignId, setViewCampaignId] = useState<string | null>(null);

  const { data: campaignDetails } = useCampaignDetails(viewCampaignId);

  // Group contacts by batch for campaign creation
  const contactsByBatch = useMemo(() => {
    const map = new Map<string, any[]>();
    (contacts || []).forEach((c: any) => {
      const key = c.batch_id || "orphan";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return map;
  }, [contacts]);

  // Compute selected contact IDs
  const selectedContactIds = useMemo(() => {
    const ids: string[] = [];
    selectedBatches.forEach((batchId) => {
      const batchContacts = contactsByBatch.get(batchId) || [];
      batchContacts.forEach((c: any) => {
        if (!deselectedContacts.has(c.id)) ids.push(c.id);
      });
    });
    return ids;
  }, [selectedBatches, deselectedContacts, contactsByBatch]);

  const detailSummary = useMemo(() => {
    const rows = campaignDetails || [];
    return {
      total: rows.length,
      sent: rows.filter((r: any) => r.status === "sent").length,
      failed: rows.filter((r: any) => r.status === "failed").length,
      pending: rows.filter((r: any) => ["pending", "sending"].includes(r.status)).length,
    };
  }, [campaignDetails]);

  const toggleBatchSelection = (batchId: string) => {
    setSelectedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
        // Remove deselections for this batch
        const batchContacts = contactsByBatch.get(batchId) || [];
        setDeselectedContacts((ds) => {
          const n = new Set(ds);
          batchContacts.forEach((c: any) => n.delete(c.id));
          return n;
        });
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const toggleContactInBatch = (contactId: string) => {
    setDeselectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const handleCreate = () => {
    if (!name || !message || selectedContactIds.length === 0) return;
    createCampaign.mutate(
      { name, message, delay_seconds: delay, contactIds: selectedContactIds },
      {
        onSuccess: () => {
          setShowCreate(false);
          setName("");
          setMessage("");
          setDelay(60);
          setSelectedBatches(new Set());
          setDeselectedContacts(new Set());
          setExpandedCreateBatches(new Set());
        },
      },
    );
  };

  const selectAllBatches = () => {
    if (!batches) return;
    const allIds = batches.map((b: any) => b.id);
    if (selectedBatches.size === allIds.length) {
      setSelectedBatches(new Set());
    } else {
      setSelectedBatches(new Set(allIds));
    }
    setDeselectedContacts(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Campanhas de disparo</h2>
          <p className="text-sm text-muted-foreground">Acompanhe progresso, sucessos, falhas e detalhes de cada envio.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="mr-1 h-4 w-4" />Nova Campanha
        </Button>
      </div>

      {/* Campaign list */}
      <Card>
        <CardHeader><CardTitle className="text-base">Fila de campanhas</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
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
                    const sm = STATUS_META[campaign.status] || STATUS_META.draft;
                    const Icon = sm.icon;
                    const processed = (campaign.total_sent || 0) + (campaign.total_failed || 0);
                    const progress = campaign.total_contacts > 0 ? Math.round((processed / campaign.total_contacts) * 100) : 0;

                    return (
                      <TableRow key={campaign.id}>
                        <TableCell className="min-w-[220px]">
                          <p className="font-medium">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{campaign.message}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sm.variant} className="gap-1">
                            <Icon className={`h-3.5 w-3.5 ${campaign.status === "running" ? "animate-spin" : ""}`} />
                            {sm.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <Progress value={progress} />
                          <p className="text-xs text-muted-foreground mt-1">{processed}/{campaign.total_contacts} ({progress}%)</p>
                        </TableCell>
                        <TableCell>{campaign.total_contacts}</TableCell>
                        <TableCell className="font-medium">{campaign.total_sent}</TableCell>
                        <TableCell className="font-medium text-destructive">{campaign.total_failed}</TableCell>
                        <TableCell className="text-xs">{campaign.delay_seconds}s</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {(campaign.status === "draft" || campaign.status === "paused") && (
                              <Button variant="outline" size="sm" onClick={() => startCampaign.mutate(campaign.id)} disabled={startCampaign.isPending} title={campaign.status === "paused" ? "Retomar" : "Iniciar"}>
                                {startCampaign.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                              </Button>
                            )}
                            {campaign.status === "running" && (
                              <Button variant="outline" size="sm" onClick={() => pauseCampaign.mutate(campaign.id)} disabled={pauseCampaign.isPending} title="Pausar">
                                {pauseCampaign.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
                              </Button>
                            )}
                            {(campaign.status === "running" || campaign.status === "paused") && (
                              <Button variant="destructive" size="sm" onClick={() => cancelCampaign.mutate(campaign.id)} disabled={cancelCampaign.isPending} title="Cancelar">
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setViewCampaignId(campaign.id)} title="Detalhes">
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

      {/* ── Create Campaign Dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Nova Campanha</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Campanha</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Lançamento Março 2026" />
            </div>
            <div>
              <Label>Mensagem</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Digite a mensagem..." rows={5} />
            </div>
            <div>
              <Label className="flex items-center gap-2"><Clock className="h-4 w-4" />Delay entre mensagens (segundos)</Label>
              <Input type="number" value={delay} onChange={(e) => setDelay(Number(e.target.value))} min={5} />
            </div>

            {/* ── Contact selection by batch ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Selecionar Contatos</Label>
                <Button variant="ghost" size="sm" onClick={selectAllBatches} className="text-xs h-7">
                  {batches && selectedBatches.size === batches.length ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
              </div>

              {/* Summary */}
              {selectedContactIds.length > 0 && (
                <div className="bg-muted/50 rounded-md px-3 py-2 mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium">{selectedBatches.size} grupo(s) selecionado(s)</span>
                  <Badge variant="secondary">{selectedContactIds.length} contato(s)</Badge>
                </div>
              )}

              {batches && batches.length > 0 ? (
                <div className="rounded-md border divide-y">
                  {batches.map((batch: any) => {
                    const batchContacts = contactsByBatch.get(batch.id) || [];
                    const isSelected = selectedBatches.has(batch.id);
                    const isExpanded = expandedCreateBatches.has(batch.id);
                    const activeCount = batchContacts.filter((c: any) => !deselectedContacts.has(c.id)).length;
                    const isManual = batch.type === "manual";

                    return (
                      <div key={batch.id}>
                        <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/30">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleBatchSelection(batch.id)}
                            disabled={batchContacts.length === 0}
                          />
                          {isManual ? <User className="h-4 w-4 text-muted-foreground" /> : <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />}
                          <span className="text-sm flex-1">{batch.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {isSelected ? `${activeCount}/` : ""}{batchContacts.length}
                          </Badge>
                          {isSelected && batchContacts.length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                setExpandedCreateBatches((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(batch.id)) next.delete(batch.id);
                                  else next.add(batch.id);
                                  return next;
                                });
                              }}
                            >
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                        </div>
                        {isSelected && isExpanded && (
                          <div className="bg-muted/20 border-t">
                            {batchContacts.map((c: any) => (
                              <div key={c.id} className="flex items-center gap-2 px-6 py-1.5 hover:bg-muted/30">
                                <Checkbox
                                  checked={!deselectedContacts.has(c.id)}
                                  onCheckedChange={() => toggleContactInBatch(c.id)}
                                />
                                <span className="text-xs flex-1">{c.establishment_name}</span>
                                <span className="text-xs text-muted-foreground">{c.normalized_phone}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum contato disponível.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!name || !message || selectedContactIds.length === 0 || createCampaign.isPending}>
              {createCampaign.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Criar Campanha ({selectedContactIds.length} contatos)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Details Dialog ── */}
      <Dialog open={!!viewCampaignId} onOpenChange={() => setViewCampaignId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>Detalhes da Campanha</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-4">
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-semibold">{detailSummary.total}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Enviados</p><p className="text-2xl font-semibold">{detailSummary.sent}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Falhas</p><p className="text-2xl font-semibold text-destructive">{detailSummary.failed}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-2xl font-semibold">{detailSummary.pending}</p></CardContent></Card>
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
                  {campaignDetails.map((cc: any) => {
                    const csm = CONTACT_STATUS_META[cc.status] || CONTACT_STATUS_META.pending;
                    return (
                      <TableRow key={cc.id}>
                        <TableCell className="text-sm">{cc.contact?.establishment_name || "—"}</TableCell>
                        <TableCell className="text-xs">{cc.contact?.normalized_phone || "—"}</TableCell>
                        <TableCell><Badge variant={csm.variant}>{csm.label}</Badge></TableCell>
                        <TableCell className="text-xs">{cc.attempt_count}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">{cc.provider_message_id || "—"}</TableCell>
                        <TableCell className="max-w-[320px] whitespace-pre-wrap break-words text-xs text-destructive">{cc.error_message || "—"}</TableCell>
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
