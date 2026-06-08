import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Upload, Trash2, Loader2, AlertCircle, CheckCircle, ChevronDown, ChevronRight, FileSpreadsheet, User, Package } from "lucide-react";
import {
  useBroadcastContacts,
  useContactBatches,
  useAddContact,
  useDeleteContact,
  useDeleteBatch,
  useImportContacts,
  normalizePhone,
  isValidPhone,
} from "@/hooks/useBroadcast";
import * as XLSX from "xlsx";

export default function BroadcastContacts() {
  const { data: contacts, isLoading: contactsLoading } = useBroadcastContacts();
  const { data: batches, isLoading: batchesLoading } = useContactBatches();
  const addContact = useAddContact();
  const deleteContact = useDeleteContact();
  const deleteBatch = useDeleteBatch();
  const importContacts = useImportContacts();

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState<{ establishment_name: string; phone: string; valid: boolean }[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "manual" | "import">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const isLoading = contactsLoading || batchesLoading;

  const contactsByBatch = useMemo(() => {
    const map = new Map<string, any[]>();
    (contacts || []).forEach((c: any) => {
      const key = c.batch_id || "orphan";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return map;
  }, [contacts]);

  const filteredBatches = useMemo(() => {
    if (!batches) return [];
    if (filter === "all") return batches;
    return batches.filter((b: any) => b.type === filter);
  }, [batches, filter]);

  const toggleBatch = (id: string) => {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    if (!name || !phone) return;
    addContact.mutate(
      { establishment_name: name, phone },
      { onSuccess: () => { setShowAdd(false); setName(""); setPhone(""); } },
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(ws);
        const preview = rows.map((row: any) => {
          const estName = row.nome_estabelecimento || row.estabelecimento || row.name || row.nome || "";
          const ph = String(row.telefone || row.phone || row.celular || row.whatsapp || "");
          return { establishment_name: estName, phone: ph, valid: !!estName && isValidPhone(ph) };
        });
        setImportPreview(preview);
        setShowImport(true);
      } catch {
        alert("Erro ao ler arquivo");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleImport = () => {
    const valid = importPreview.filter((r) => r.valid);
    importContacts.mutate(
      { fileName: importFileName, contacts: valid.map((v) => ({ establishment_name: v.establishment_name, phone: v.phone })) },
      { onSuccess: () => { setShowImport(false); setImportPreview([]); setImportFileName(""); } },
    );
  };

  const validCount = importPreview.filter((r) => r.valid).length;
  const invalidCount = importPreview.filter((r) => !r.valid).length;

  const totalContacts = contacts?.length || 0;
  const manualCount = (contacts || []).filter((c: any) => c.source === "manual").length;
  const importedCount = totalContacts - manualCount;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Contatos ({totalContacts})</h2>
          <p className="text-sm text-muted-foreground">
            {manualCount} manuais • {importedCount} importados • {filteredBatches.length} grupos
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAdd(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />Adicionar
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" />Importar
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "manual", "import"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? <Package className="h-3.5 w-3.5 mr-1" /> : f === "manual" ? <User className="h-3.5 w-3.5 mr-1" /> : <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />}
            {f === "all" ? "Todos" : f === "manual" ? "Manuais" : "Importados"}
          </Button>
        ))}
      </div>

      {/* Batches */}
      {isLoading ? (
        <Card><CardContent className="py-8"><p className="text-sm text-muted-foreground text-center">Carregando...</p></CardContent></Card>
      ) : !filteredBatches.length ? (
        <Card><CardContent className="py-8"><p className="text-sm text-muted-foreground text-center">Nenhum grupo encontrado.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredBatches.map((batch: any) => {
            const batchContacts = contactsByBatch.get(batch.id) || [];
            const isExpanded = expandedBatches.has(batch.id);
            const isManual = batch.type === "manual";

            return (
              <Card key={batch.id}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleBatch(batch.id)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          {isManual ? <User className="h-4 w-4 text-primary" /> : <FileSpreadsheet className="h-4 w-4 text-primary" />}
                          <div>
                            <CardTitle className="text-sm font-medium">{batch.name}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isManual ? "Cadastro manual" : `Importado em ${new Date(batch.created_at).toLocaleDateString("pt-BR")}`}
                              {batch.source_file_name && !isManual ? ` • ${batch.source_file_name}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {batchContacts.length} contato{batchContacts.length !== 1 ? "s" : ""}
                          </Badge>
                          {!isManual && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Excluir o lote "${batch.name}" e todos os seus ${batchContacts.length} contatos?`)) {
                                  deleteBatch.mutate(batch.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {batchContacts.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">Nenhum contato neste grupo.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Estabelecimento</TableHead>
                                <TableHead>Telefone</TableHead>
                                <TableHead>Normalizado</TableHead>
                                <TableHead></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {batchContacts.map((c: any) => (
                                <TableRow key={c.id}>
                                  <TableCell className="font-medium text-sm">{c.establishment_name}</TableCell>
                                  <TableCell className="text-sm">{c.phone}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{c.normalized_phone}</TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => deleteContact.mutate({ id: c.id, batch_id: c.batch_id })}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Contact Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar Contato</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do Estabelecimento</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Barbearia do João" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex: 5511999999999" />
              {phone && !isValidPhone(phone) && <p className="text-xs text-destructive mt-1">Telefone inválido</p>}
              {phone && isValidPhone(phone) && <p className="text-xs text-green-600 mt-1">Normalizado: {normalizePhone(phone)}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!name || !phone || !isValidPhone(phone) || addContact.isPending}>
              {addContact.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar: {importFileName}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Os contatos serão agrupados automaticamente no lote "<strong>{importFileName}</strong>".
          </p>
          <div className="flex gap-3 mb-3">
            <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />{validCount} válidos</Badge>
            {invalidCount > 0 && <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{invalidCount} inválidos</Badge>}
          </div>
          <div className="overflow-x-auto max-h-[50vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Estabelecimento</TableHead>
                  <TableHead>Telefone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPreview.map((r, i) => (
                  <TableRow key={i} className={r.valid ? "" : "bg-destructive/5"}>
                    <TableCell>{r.valid ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-destructive" />}</TableCell>
                    <TableCell>{r.establishment_name || <span className="text-destructive text-xs">Vazio</span>}</TableCell>
                    <TableCell>{r.phone || <span className="text-destructive text-xs">Vazio</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={validCount === 0 || importContacts.isPending}>
              {importContacts.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Importar {validCount} contatos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
