'use client';
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts"
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { Poll, Vote, VoterStatus } from '@/lib/types';
import { collection } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useMemo } from "react";
import { Skeleton } from "../ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Separator } from "../ui/separator";
import { Info, UserCheck, UserX, Vote as VoteIcon, Clock, Users, Download, CheckCircle2, XCircle, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "../ui/button";
import * as XLSX from 'xlsx';
import { Badge } from "../ui/badge";

interface PollResultsDialogProps {
  poll: Poll;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PollResultsDialog({ poll, open, onOpenChange }: PollResultsDialogProps) {
    const firestore = useFirestore();
    const { user } = useUser();

    const votesRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'admins', user.uid, 'polls', poll.id, 'votes');
    }, [firestore, user, poll.id]);

    const votersRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'admins', user.uid, 'polls', poll.id, 'voters');
    }, [firestore, user, poll.id]);

    const { data: votes, isLoading: votesLoading } = useCollection<Vote>(votesRef);
    const { data: votersStatus, isLoading: votersStatusLoading } = useCollection<VoterStatus>(votersRef);

    const isLoading = votesLoading || votersStatusLoading;

    const stats = useMemo(() => {
        if (!votersStatus || !votes) return null;

        const universe = votersStatus.length;
        const enabled = votersStatus.filter(v => v.enabled !== false).length;
        const disabled = universe - enabled;
        const cast = votes.length;
        const participation = enabled > 0 ? (cast / enabled) * 100 : 0;

        return { universe, enabled, disabled, cast, participation };
    }, [votersStatus, votes]);

    const chartData = useMemo(() => {
        if (!votes) return [];

        const results: { [key: string]: number } = poll.options.reduce((acc, option) => {
            acc[option.id] = 0;
            return acc;
        }, {} as { [key: string]: number });

        votes.forEach(vote => {
            vote.selectedOptions.forEach(optionId => {
                if (results[optionId] !== undefined) {
                    results[optionId]++;
                }
            });
        });

        const totalSelections = votes.length > 0 ? votes.reduce((acc, v) => acc + v.selectedOptions.length, 0) : 0;

        return poll.options.map(option => ({
            name: option.text,
            votes: results[option.id] || 0,
            percentage: totalSelections > 0 ? ((results[option.id] || 0) / totalSelections) * 100 : 0,
        })).sort((a, b) => b.votes - a.votes);
    }, [votes, poll.options]);

    const handleDownloadExcel = () => {
        if (!stats || !votersStatus) return;

        const wb = XLSX.utils.book_new();
        
        // 1. Hoja de Informe General
        const reportInfo = [
            ["INFORME DE VOTACIÓN E-LECTOR"],
            [""],
            ["Pregunta:", poll.question],
            ["Estado:", poll.status === 'closed' ? "Cerrada" : (poll.status === 'active' ? "Activa" : "Pendiente")],
            ["Fecha Activación:", poll.activatedAt ? format(poll.activatedAt.toDate(), "d MMM yyyy, HH:mm", { locale: es }) : "N/A"],
            ["Fecha Cierre:", poll.closedAt ? format(poll.closedAt.toDate(), "d MMM yyyy, HH:mm", { locale: es }) : "N/A"],
            [""],
            ["RESUMEN ESTADÍSTICO"],
            ["Universo de Votantes:", stats.universe],
            ["Habilitados:", stats.enabled],
            ["No Habilitados:", stats.disabled],
            ["Votos Emitidos:", stats.cast],
            ["Participación:", `${stats.participation.toFixed(1)}%`],
            [""],
            ["RESULTADOS POR OPCIÓN"],
            ["Opción", "Votos Recibidos", "Porcentaje (%)"]
        ];

        chartData.forEach(item => {
            reportInfo.push([item.name, item.votes.toString(), `${item.percentage.toFixed(1)}%`]);
        });

        const wsReport = XLSX.utils.aoa_to_sheet(reportInfo);
        wsReport['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsReport, "Informe de Resultados");

        // 2. Hoja de Detalle de Votantes
        const voterHeaders = [["ID Votante", "Nombres", "Apellidos", "Estado Habilitación", "Emitió Voto"]];
        const voterData = votersStatus.map(v => [
            v.voterId,
            v.nombre || '',
            v.apellido || '',
            v.enabled !== false ? 'Habilitado' : 'Deshabilitado',
            v.hasVoted ? 'SÍ' : 'NO'
        ]);

        const wsVoters = XLSX.utils.aoa_to_sheet([...voterHeaders, ...voterData]);
        wsVoters['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsVoters, "Lista de Votantes");

        XLSX.writeFile(wb, `Informe_Votacion_${poll.id}.xlsx`);
    };

    const chartConfig = {
      votes: {
        label: "Votos",
        color: "hsl(var(--primary))",
      },
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[95dvh] overflow-y-auto">
                <DialogHeader className="flex flex-row items-start justify-between gap-4 pr-8">
                    <div className="space-y-1">
                        <DialogTitle className="text-xl">Informe de Votación</DialogTitle>
                        <DialogDescription className="text-primary font-medium">
                           {poll.question}
                        </DialogDescription>
                    </div>
                    <Button onClick={handleDownloadExcel} variant="outline" size="sm" className="shrink-0" disabled={isLoading}>
                        <Download className="mr-2 h-4 w-4" /> Exportar a Excel
                    </Button>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Sección de Tiempos y Estado */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="bg-muted/50 p-3 rounded-lg flex items-center gap-3">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Inicio</span>
                                <span className="text-sm">{poll.activatedAt ? format(poll.activatedAt.toDate(), "d MMM, HH:mm", { locale: es }) : 'N/A'}</span>
                            </div>
                         </div>
                         <div className="bg-muted/50 p-3 rounded-lg flex items-center gap-3">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Término</span>
                                <span className="text-sm">{poll.closedAt ? format(poll.closedAt.toDate(), "d MMM, HH:mm", { locale: es }) : (poll.status === 'active' ? 'En curso...' : 'N/A')}</span>
                            </div>
                         </div>
                    </div>

                    <Separator />

                    {/* Resumen Estadístico */}
                    {isLoading ? (
                        <div className="space-y-2"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
                    ) : stats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center border rounded-lg p-3">
                                <div className="flex justify-center mb-1"><Users className="h-4 w-4 text-muted-foreground" /></div>
                                <div className="text-xl font-bold">{stats.universe}</div>
                                <div className="text-[10px] text-muted-foreground uppercase">Universo</div>
                            </div>
                            <div className="text-center border rounded-lg p-3 bg-green-50/50 border-green-100">
                                <div className="flex justify-center mb-1"><UserCheck className="h-4 w-4 text-green-600" /></div>
                                <div className="text-xl font-bold text-green-700">{stats.enabled}</div>
                                <div className="text-[10px] text-green-600 uppercase">Habilitados</div>
                            </div>
                            <div className="text-center border rounded-lg p-3 bg-red-50/50 border-red-100">
                                <div className="flex justify-center mb-1"><UserX className="h-4 w-4 text-red-600" /></div>
                                <div className="text-xl font-bold text-red-700">{stats.disabled}</div>
                                <div className="text-[10px] text-red-600 uppercase">No Habilitados</div>
                            </div>
                            <div className="text-center border rounded-lg p-3 bg-primary/5 border-primary/20">
                                <div className="flex justify-center mb-1"><VoteIcon className="h-4 w-4 text-primary" /></div>
                                <div className="text-xl font-bold text-primary">{stats.cast}</div>
                                <div className="text-[10px] text-primary uppercase">Votaron ({stats.participation.toFixed(1)}%)</div>
                            </div>
                        </div>
                    )}

                    <Separator />

                    {/* Resultados Gráficos */}
                    <div>
                        <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                            <Info className="h-4 w-4" /> Distribución de Resultados
                        </h4>
                        <div className="h-72 w-full">
                        {!isLoading && votes?.length === 0 ? (
                            <p className="text-center text-muted-foreground pt-16 italic">Aún no hay votos registrados.</p>
                        ) : (
                            <ChartContainer config={chartConfig} className="w-full h-full">
                                <BarChart accessibilityLayer data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                                        width={120}
                                        />
                                    <Tooltip
                                        cursor={{ fill: "hsl(var(--muted))" }}
                                        content={<ChartTooltipContent 
                                            formatter={(value, name, item) => (
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{(item as any).payload.name}</span>
                                                    <span>{value} Votos ({ (item as any).payload.percentage.toFixed(1)}%)</span>
                                                </div>
                                            )}
                                            hideIndicator
                                            hideLabel 
                                        />}
                                    />
                                    <Bar dataKey="votes" radius={4}>
                                         {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground)/0.4)'} />
                                         ))}
                                    </Bar>
                                </BarChart>
                            </ChartContainer>
                        )}
                        </div>
                    </div>

                    {/* Desglose de Opciones */}
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="text-xs">Opción</TableHead>
                                    <TableHead className="text-right text-xs">Votos</TableHead>
                                    <TableHead className="text-right text-xs">%</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {chartData.map((item) => (
                                    <TableRow key={item.name}>
                                        <TableCell className="text-sm py-2 font-medium">{item.name}</TableCell>
                                        <TableCell className="text-right text-sm py-2">{item.votes}</TableCell>
                                        <TableCell className="text-right text-sm py-2">{item.percentage.toFixed(1)}%</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <Separator />

                    {/* Detalle de Participantes */}
                    <div>
                        <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                            <Users className="h-4 w-4" /> Detalle de Participación Individual
                        </h4>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="text-xs">Votante</TableHead>
                                        <TableHead className="text-xs">Estado</TableHead>
                                        <TableHead className="text-right text-xs">¿Votó?</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {votersStatus?.map((voter) => (
                                        <TableRow key={voter.id}>
                                            <TableCell className="py-2">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">{voter.nombre} {voter.apellido}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">{voter.voterId}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                {voter.enabled !== false ? (
                                                    <Badge variant="outline" className="text-[10px] py-0 border-green-200 text-green-700 bg-green-50">Habilitado</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] py-0 border-red-200 text-red-700 bg-red-50">No Hab.</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right py-2">
                                                {voter.hasVoted ? (
                                                    <div className="flex justify-end"><CheckCircle2 className="h-4 w-4 text-green-500" /></div>
                                                ) : (
                                                    <div className="flex justify-end"><XCircle className="h-4 w-4 text-muted-foreground/30" /></div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {(!votersStatus || votersStatus.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm italic">
                                                No hay registros de votantes disponibles.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
                
                <div className="text-center text-[10px] text-muted-foreground border-t pt-4">
                    Este informe fue generado automáticamente por E-lector. Todos los votos individuales son anónimos, el sistema solo registra quién participó.
                </div>
            </DialogContent>
        </Dialog>
    );
}
