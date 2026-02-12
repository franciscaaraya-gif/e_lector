import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users } from 'lucide-react';

function LoadingVoterCard() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-6 w-24 rounded-full" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-9 w-full" />
            </CardContent>
        </Card>
    )
}

export default function PollDetailsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-36" />
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className='w-full'>
              <Skeleton className="h-8 w-full max-w-lg" />
              <Skeleton className="h-5 w-64 max-w-full mt-2" />
            </div>
            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
              <Skeleton className="h-6 w-12 rounded-lg" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
            <h3 className="font-semibold mb-2">Opciones</h3>
            <div className="list-disc list-inside space-y-2 pl-5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-40" />
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users />Registro de Votantes</CardTitle>
          <CardDescription>Una lista de votantes elegibles para esta votación y su estado de votación.</CardDescription>
        </CardHeader>
        <CardContent>
            {/* Mobile Skeleton */}
            <div className="md:hidden space-y-4">
                <LoadingVoterCard />
                <LoadingVoterCard />
                <LoadingVoterCard />
            </div>
            {/* Desktop Skeleton */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID de Votante</TableHead>
                            <TableHead>Ha Votado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...Array(3)].map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                <TableCell>
                                    <Skeleton className="h-6 w-16 rounded-full" />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Skeleton className="h-8 w-8" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
