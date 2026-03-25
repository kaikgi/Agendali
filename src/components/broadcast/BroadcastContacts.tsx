import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Upload, Trash2, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useBroadcastContacts, useAddContact, useDeleteContact, useImportContacts, normalizePhone, isValidPhone } from "@/hooks/useBroadcast";
import * as XLSX from "xlsx";

export default function BroadcastContacts() {
  const { data: contacts, isLoading } = useBroadcastContacts();
  const addContact = useAddContact();
  const deleteContact = useDeleteContact();
  const importContacts = useImportContacts();

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState<{ establishment_name: string; phone: string; valid: boolean }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    if (!name || !phone) return;
    addContact.mutate({ establishment_name: name, phone }, {
      onSuccess: () => { setShowAdd(false); setName(""); setPhone(""); },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(ws);
        const preview = rows.map((row: any) => {
          const estName = row.nome_estabelecimento || row.estabelecimento || row.name || row.nome || '';
          const ph = String(row.telefone || row.phone || row.celular || row.whatsapp || '');
          return { establishment_name: estName, phone: ph, valid: !!estName && isValidPhone(ph) };
        });
        setImportPreview(preview);
        setShowImport(true);
      } catch {
        alert("Erro ao ler arquivo");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleImport = () => {
    const valid = importPreview.filter(r => r.valid);
    importContacts.mutate(valid.map(v => ({ establishment_name: v.establishment_name, phone: v.phone })), {
      onSuccess: () => { setShowImport(false); setImportPreview([]); },
    });
  };

  const validCount = importPreview.filter(r => r.valid).length;
  const invalidCount = importPreview.filter(r => !r.valid).length;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="h-4 w-4 mr-1" />Adicionar Contato</Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" />Importar Excel
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Contatos ({contacts?.length || 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground text-sm">Carregando...</p> : !contacts?.length ? (
            <p className="text-muted-foreground text-sm">Nenhum contato cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estabelecimento</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Normalizado</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.establishment_name}</TableCell>
                      <TableCell>{c.phone}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.normalized_phone}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{c.source}</Badge></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteContact.mutate(c.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar Contato</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome do Estabelecimento</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Barbearia do João" /></div>
            <div><Label>Telefone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ex: 5511999999999" />
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
          <DialogHeader><DialogTitle>Preview da Importação</DialogTitle></DialogHeader>
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
