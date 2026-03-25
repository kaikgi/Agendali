import { useState } from "react";
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
import { Plus, Play, StopCircle, Eye, Loader2, Clock } from "lucide-react";
import { useBroadcastCampaigns, useBroadcastContacts, useCreateCampaign, useStartCampaign, useCancelCampaign, useCampaignDetails } from "@/hooks/useBroadcast";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-zinc-500" },
  running: { label: "Em andamento", color: "bg-amber-500" },
  paused: { label: "Pausada", color: "bg-blue-500" },
  completed: { label: "Concluída", color: "bg-green-600" },
  failed: { label: "Falha", color: "bg-red-600" },
  canceled: { label: "Cancelada", color: "bg-zinc-400" },
};

export default function BroadcastCampaigns() {
  const { data: campaigns, isLoading } = useBroadcastCampaigns();
  const { data: contacts } = useBroadcastContacts();
  const createCampaign = useCreateCampaign();
  const startCampaign = useStartCampaign();
  const cancelCampaign = useCancelCampaign();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [delay, setDelay] = useState(60);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  const [viewCampaignId, setViewCampaignId] = useState<string | null>(null);
  const { data: campaignDetails } = useCampaignDetails(viewCampaignId);

  const handleCreate = () => {
    if (!name || !message || selectedContacts.length === 0) return;
    createCampaign.mutate({ name, message, delay_seconds: delay, contactIds: selectedContacts }, {
      onSuccess: () => { setShowCreate(false); setName(""); setMessage(""); setDelay(60); setSelectedContacts([]); },
    });
  };

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (!contacts) return;
    if (selectedContacts.length === contacts.length) setSelectedContacts([]);
    else setSelectedContacts(contacts.map((c: any) => c.id));
  };

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowCreate(true)} size="sm"><Plus className="h-4 w-4 mr-1" />Nova Campanha</Button>

      <Card>
        <CardHeader><CardTitle className="text-base">Campanhas</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground text-sm">Carregando...</p> : !campaigns?.length ? (
            <p className="text-muted-foreground text-sm">Nenhuma campanha criada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contatos</TableHead>
                    <TableHead>Enviados</TableHead>
                    <TableHead>Falhas</TableHead>
                    <TableHead>Delay</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c: any) => {
                    const s = STATUS_MAP[c.status] || { label: c.status, color: "bg-zinc-500" };
                    const progress = c.total_contacts > 0 ? ((c.total_sent + c.total_failed) / c.total_contacts) * 100 : 0;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell><Badge className={`${s.color} text-white`}>{s.label}</Badge></TableCell>
                        <TableCell>{c.total_contacts}</TableCell>
                        <TableCell className="text-green-600">{c.total_sent}</TableCell>
                        <TableCell className="text-destructive">{c.total_failed}</TableCell>
                        <TableCell className="text-xs">{c.delay_seconds}s</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {c.status === 'draft' && (
                              <Button variant="outline" size="sm" onClick={() => startCampaign.mutate(c.id)} disabled={startCampaign.isPending}>
                                {startCampaign.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                              </Button>
                            )}
                            {c.status === 'running' && (
                              <Button variant="destructive" size="sm" onClick={() => cancelCampaign.mutate(c.id)}>
                                <StopCircle className="h-3 w-3" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setViewCampaignId(c.id)}>
                              <Eye className="h-3 w-3" />
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

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Campanha</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome da Campanha</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Lançamento Março 2026" /></div>
            <div><Label>Mensagem</Label><Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Digite a mensagem que será enviada..." rows={5} /></div>
            <div>
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Delay entre mensagens (segundos)
              </Label>
              <Input type="number" value={delay} onChange={e => setDelay(Number(e.target.value))} min={5} />
              <p className="text-xs text-muted-foreground mt-1">
                Intervalo em segundos entre o envio de cada mensagem. Ex: 600 = 10 minutos entre cada envio.
              </p>
            </div>

            <div>
              <Label>Selecionar Contatos ({selectedContacts.length} selecionados)</Label>
              {contacts && contacts.length > 0 ? (
                <div className="border rounded-md max-h-48 overflow-y-auto mt-2">
                  <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50">
                    <Checkbox checked={selectedContacts.length === contacts.length} onCheckedChange={toggleAll} />
                    <span className="text-xs font-medium">Selecionar todos</span>
                  </div>
                  {contacts.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30">
                      <Checkbox checked={selectedContacts.includes(c.id)} onCheckedChange={() => toggleContact(c.id)} />
                      <span className="text-sm">{c.establishment_name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{c.normalized_phone}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">Nenhum contato disponível. Cadastre contatos primeiro.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!name || !message || selectedContacts.length === 0 || createCampaign.isPending}>
              {createCampaign.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Criar Campanha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Details Dialog */}
      <Dialog open={!!viewCampaignId} onOpenChange={() => setViewCampaignId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes da Campanha</DialogTitle></DialogHeader>
          {campaignDetails && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignDetails.map((cc: any) => (
                    <TableRow key={cc.id}>
                      <TableCell className="text-sm">{cc.contact?.establishment_name || '—'}</TableCell>
                      <TableCell className="text-xs">{cc.contact?.normalized_phone || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={cc.status === 'sent' ? 'default' : cc.status === 'failed' ? 'destructive' : 'secondary'}
                          className={cc.status === 'sent' ? 'bg-green-600' : ''}>
                          {cc.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate">{cc.error_message || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
