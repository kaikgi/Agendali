import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <Link to="/" className="inline-block mb-8">
          <Logo />
        </Link>
        <h1 className="text-7xl font-bold text-foreground mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-2">
          Página não encontrada
        </p>
        <p className="text-body-sm text-muted-foreground mb-8">
          O link pode estar incorreto ou a página foi removida.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Voltar ao início
            </Link>
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Página anterior
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
