
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Users, LogIn } from "lucide-react";
import { ElectorIcon } from "@/components/icons";

export default function Home() {
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-image');

  return (
    <div className="flex flex-col min-h-dvh">
      <header className="px-4 lg:px-6 h-16 flex items-center bg-card border-b">
        <Link href="/" className="flex items-center justify-center gap-2" prefetch={false}>
          <ElectorIcon className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold tracking-tight text-primary font-headline">E-lector</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Button variant="outline" asChild>
            <Link
              href="/admin/login"
              prefetch={false}
            >
              Acceso Administrador
            </Link>
          </Button>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_500px] lg:gap-12 xl:grid-cols-[1fr_600px]">
                {heroImage && (
                    <Image
                    src={heroImage.imageUrl}
                    alt={heroImage.description}
                    data-ai-hint={heroImage.imageHint}
                    width={1200}
                    height={600}
                    className="mx-auto aspect-video overflow-hidden rounded-xl object-cover sm:w-full lg:order-last"
                    />
                )}
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-4">
                  <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none font-headline text-primary">
                    Votación Digital Segura y Auditada
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    Utiliza tu enlace directo o código QR para acceder a la bandeja de votación. Sistema anónimo, transparente y de alta seguridad.
                  </p>
                </div>
                <div className="flex flex-col gap-4 min-[400px]:flex-row">
                  <Button asChild size="lg" variant="secondary" className="border-primary/20">
                    <Link href="/admin/login">
                      <Users className="mr-2 h-5 w-5" />
                      Gestión de Sala
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t text-muted-foreground">
        <p className="text-xs">&copy; 2024 E-lector. Todos los derechos reservados.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Términos
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Privacidad
          </Link>
        </nav>
      </footer>
    </div>
  );
}
