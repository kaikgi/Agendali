import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle } from 'lucide-react';

const CHECKLIST = [
  'Container com padding responsivo (px-4 → px-6 → px-8)',
  'Tipografia escala suavemente (display-md → display-xl)',
  'Grids 1-col mobile → multi-col desktop',
  'Tabelas com scroll horizontal ou cards no mobile',
  'Botões/slots com min 44px de altura touch',
  'Floating elements ocultos em telas pequenas',
  'Modais não vazam da tela',
  'Sem overflow-x horizontal em nenhuma viewport',
  'Imagens com object-cover e max-w-full',
  'Focus visible em todos os elementos interativos',
];

export default function ResponsiveTest() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">
          Responsive Stress Test
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Viewport: <span className="font-mono font-bold">{typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : '?'}</span>
        </p>
      </div>

      {/* Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Checklist de Responsividade</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {CHECKLIST.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Typography stress */}
      <Card>
        <CardHeader><CardTitle>Tipografia — Textos Longos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <h2 className="text-display-md sm:text-display-lg lg:text-display-xl break-words">
            Agendamento do Sr. Francisco José Albuquerque da Silva Neto
          </h2>
          <p className="text-body-md text-muted-foreground break-words">
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, voluptatibus. 
            Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. 
            Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo.
          </p>
          <p className="text-xs text-muted-foreground font-mono break-all">
            superlongemailaddress_that_should_not_break_layout@longdomainname-example.com.br
          </p>
        </CardContent>
      </Card>

      {/* Grid stress */}
      <Card>
        <CardHeader><CardTitle>Grid — Cards Responsivos</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <p className="font-medium truncate">Serviço #{i + 1} — Corte Degradê Premium Exclusivo</p>
                  <p className="text-sm text-muted-foreground">R$ {(Math.random() * 500).toFixed(2)}</p>
                  <Badge variant="outline" className="mt-2">45 min</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table stress */}
      <Card>
        <CardHeader><CardTitle>Tabela com Scroll Horizontal</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="table-responsive">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-left whitespace-nowrap">Cliente</th>
                  <th className="p-3 text-left whitespace-nowrap">Telefone</th>
                  <th className="p-3 text-left whitespace-nowrap">Email</th>
                  <th className="p-3 text-left whitespace-nowrap">Serviço</th>
                  <th className="p-3 text-left whitespace-nowrap">Profissional</th>
                  <th className="p-3 text-left whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {['João da Silva Oliveira', 'Maria Aparecida Santos', 'Pedro Henrique de Souza'].map((name, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="p-3 whitespace-nowrap">{name}</td>
                    <td className="p-3 whitespace-nowrap">(11) 99999-{String(i).padStart(4, '0')}</td>
                    <td className="p-3 whitespace-nowrap">{name.toLowerCase().replace(/ /g, '.')}@email.com</td>
                    <td className="p-3 whitespace-nowrap">Corte + Barba Premium</td>
                    <td className="p-3 whitespace-nowrap">Carlos Eduardo Fernandes</td>
                    <td className="p-3"><Badge>Confirmado</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Touch targets */}
      <Card>
        <CardHeader><CardTitle>Alvos de Toque (44px min)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'].map((time) => (
              <button
                key={time}
                className="py-3 px-4 rounded-md text-sm font-medium border border-border hover:border-foreground/50 touch-target transition-colors"
              >
                {time}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Form stress */}
      <Card>
        <CardHeader><CardTitle>Formulário Responsivo</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="test-name">Nome completo</Label>
                <Input id="test-name" placeholder="Seu nome completo aqui" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-email">Email</Label>
                <Input id="test-email" type="email" placeholder="email@exemplo.com" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" className="flex-1">Salvar</Button>
              <Button type="button" variant="outline" className="flex-1">Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Viewport presets */}
      <Card>
        <CardHeader><CardTitle>Presets de Teste</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { label: 'iPhone SE', w: 320 },
              { label: 'iPhone 14', w: 390 },
              { label: 'Pixel', w: 412 },
              { label: 'iPad', w: 768 },
              { label: 'Laptop', w: 1024 },
              { label: 'Desktop', w: 1366 },
              { label: 'Large', w: 1440 },
              { label: '1080p', w: 1920 },
            ].map((preset) => (
              <Badge key={preset.label} variant="outline" className="font-mono">
                {preset.label} ({preset.w}px)
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
