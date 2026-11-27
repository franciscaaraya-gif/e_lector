'use client';

import { Suspense } from 'react';
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ElectorIcon } from "@/components/icons";
import { Skeleton } from '@/components/ui/skeleton';

function VoteSuccessClient() {
  const searchParams = useSearchParams();
  const voterId = searchParams.get('voterId');
  const salaId = searchParams.get('salaId');
  const token = searchParams.get('t');

  const inboxHref = (voterId && salaId) ? `/inbox/polls?salaId=${salaId}&voterId=${encodeURIComponent(voterId)}${token ? `&t=${token}` : ''}` : '/inbox';

  return (
    <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-8">
            <div className="flex items-center justify-center gap-2">
                <ElectorIcon className="h-10 w-10 text-primary" />
                <span className="text-2xl font-bold tracking-tight text-primary font-headline">E-lector</span>
            </div>
        </div>
        <Card className="shadow-lg">
            <CardHeader className="items-center">
                <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                <CardTitle className="text-3xl font-headline">¡Voto Emitido Exitosamente!</CardTitle>
                <CardDescription>Gracias por participar.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
                <p className="text-muted-foreground">Tu voto anónimo ha sido registrado de forma segura.</p>
                <div className="flex flex-col gap-3 w-full">
                    <Button asChild size="lg" className="w-full font-bold">
                        <Link href={inboxHref}>
                            <ArrowLeft className="mr-2 h-5 w-5" />
                            Volver a mis votaciones
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}

function SuccessLoadingFallback() {
    return (
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-8">
          <div className="flex items-center justify-center gap-2">
              <ElectorIcon className="h-10 w-10 text-primary" />
              <span className="text-2xl font-bold tracking-tight text-primary font-headline">E-lector</span>
          </div>
        </div>
        <Card className="shadow-lg">
            <CardHeader className="items-center">
                <Skeleton className="h-16 w-16 rounded-full mb-4" />
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
                <Skeleton className="h-4 w-full" />
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </CardContent>
        </Card>
      </div>
    )
}

export default function VoteSuccessPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
      <Suspense fallback={<SuccessLoadingFallback />}>
        <VoteSuccessClient />
      </Suspense>
    </div>
  );
}
