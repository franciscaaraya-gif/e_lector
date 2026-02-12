import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

function LoadingPollCard() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-5 w-20 mt-2 rounded-full" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-5 w-40" />
            </CardContent>
            <CardFooter>
                <Skeleton className="h-9 w-full" />
            </CardFooter>
        </Card>
    )
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
        <CardHeader className="p-0">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-5 w-80 mt-2" />
        </CardHeader>
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <CardTitle>Tus Votaciones</CardTitle>
                    <Button disabled className="w-full sm:w-auto">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Crear Votación
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {/* Mobile Skeleton */}
                <div className="md:hidden space-y-4">
                    <LoadingPollCard />
                    <LoadingPollCard />
                    <LoadingPollCard />
                </div>
                {/* Desktop Skeleton */}
                <div className="hidden md:block">
                    <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Pregunta</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Creado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-10 w-10" /></TableCell>
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
