import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Store, ArrowRight, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';

interface Establishment {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  instagram: string | null;
}

export default function ClientSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
    setDebounceTimer(timeoutId);
  };

  const { data: establishments = [], isLoading } = useQuery({
    queryKey: ['establishments-search', debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from('establishments')
        .select('id, name, slug, description, logo_url, address, city, state, phone, instagram')
        .eq('booking_enabled', true)
        .order('name');

      if (debouncedSearch.trim()) {
        const search = `%${debouncedSearch.trim()}%`;
        query = query.or(`name.ilike.${search},city.ilike.${search},slug.ilike.${search}`);
      }

      const { data, error } = await query.limit(50);
      
      if (error) throw error;
      return data as Establishment[];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Buscar Estabelecimentos</h1>
        <p className="text-muted-foreground">
          Encontre e agende em qualquer estabelecimento cadastrado
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, cidade ou slug..."
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : establishments.length === 0 ? (
        <div className="text-center py-12">
          <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium mb-2">
            {debouncedSearch ? 'Nenhum resultado encontrado' : 'Nenhum estabelecimento disponível'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {debouncedSearch
              ? 'Tente buscar com outros termos'
              : 'Não há estabelecimentos com agendamento online no momento'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {establishments.map((establishment) => (
            <Card key={establishment.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14 rounded-lg">
                    {establishment.logo_url && (
                      <AvatarImage src={establishment.logo_url} alt={establishment.name} />
                    )}
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                      {establishment.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{establishment.name}</h3>
                    {(establishment.city || establishment.state) && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {[establishment.city, establishment.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {establishment.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {establishment.description}
                      </p>
                    )}
                  </div>
                </div>
                <Button asChild className="w-full mt-4" variant="outline">
                  <Link to={`/${establishment.slug}`}>
                    Agendar
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info */}
      {establishments.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Mostrando {establishments.length} estabelecimento{establishments.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
