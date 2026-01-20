import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ElectorIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

function VotePageClient() {
    const headerContent = (
        <div className="flex justify-center mb-8">
            <Link href="/" className="flex items-center justify-center gap-2" prefetch={false}>
                <ElectorIcon className="h-10 w-10 text-primary" />
                <span className="text-2xl font-bold tracking-tight text-primary font-headline">E-lector</span>
            </Link>
        </div>
    );

    const bodyContent = (
        <Card>
            <CardHeader>
                <CardTitle>Funcionalidad de Votación Deshabilitada</CardTitle>
                <CardDescription>
                    Esta funcionalidad requería una base de datos. Al eliminar Firebase, la votación ya no es posible.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild variant="outline" className='w-full'>
                    <Link href="/login">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
    
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
            <div className="w-full max-w-2xl">
                {headerContent}
                {bodyContent}
            </div>
        </div>
    );
}

// A simple loading skeleton to show during server render and initial client load.
function LoadingSkeleton() {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
            <div className="w-full max-w-2xl">
                <Card>
                    <CardHeader>
                        <CardTitle>Cargando...</CardTitle>
                        <CardDescription>Por favor, espera un momento.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="h-16 w-full bg-muted animate-pulse rounded-md" />
                        <div className="h-16 w-full bg-muted animate-pulse rounded-md" />
                        <div className="h-12 w-full bg-muted animate-pulse rounded-md mt-4" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// This is a Server Component.
export default function VotePage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <VotePageClient />
    </Suspense>
  );
}
