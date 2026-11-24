'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, serverTimestamp, doc, query, where, writeBatch } from 'firebase/firestore';
import { PlusCircle, Loader2, Trash2, Plus, GripVertical } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn, sortPeople, formatFullName } from '@/lib/utils';
import { Poll, PollTemplate, ListaCompletaItem } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';
import { Alert, AlertDescription } from '../ui/alert';

const formSchema = z.object({
  question: z.string().min(5, 'La pregunta debe tener al menos 5 caracteres.').max(200, 'La pregunta no puede exceder los 200 caracteres.'),
  options: z.array(
    z.object({
      text: z.string().min(1, 'La opción no puede estar vacía.'),
    })
  ).min(2, 'Debe haber al menos 2 opciones.'),
  pollType: z.enum(['simple', 'multiple'], {
    required_error: 'Debes seleccionar un tipo de votación.',
  }),
  maxSelections: z.coerce.number().optional(),
}).refine(data => {
    if (data.pollType === 'multiple') {
        return data.maxSelections && data.maxSelections > 1 && data.maxSelections <= data.options.length;
    }
    return true;
}, {
    message: 'Para selección múltiple, el número de opciones a marcar debe ser mayor que 1 y menor o igual al total de opciones.',
    path: ['maxSelections'],
});

// Minúsculas y sin tildes, para que "munoz" encuentre a "Muñoz" y "nunez" a "Núñez".
const normalizeText = (s: string) =>
    (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const AutocompleteInput = ({ field, index, volunteers, onEnter }: { field: any, index: number, volunteers: ListaCompletaItem[], onEnter?: (e: React.KeyboardEvent<HTMLInputElement>) => void }) => {
    const [suggestions, setSuggestions] = useState<ListaCompletaItem[]>([]);
    const [popoverOpen, setPopoverOpen] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        field.onChange(value);

        if (value.length >= 2) {
            // Todas las palabras escritas deben aparecer, en cualquier orden
            // ("juan perez" encuentra a "Pérez Soto Juan").
            const terms = normalizeText(value).split(/\s+/).filter(Boolean);
            const filtered = volunteers.filter(v => {
                const haystack = normalizeText(`${v.apellidos} ${v.nombres}`);
                return terms.every(t => haystack.includes(t));
            });
            const sorted = sortPeople(filtered, (v) => ({ nombres: v.nombres, apellidos: v.apellidos }));
            setSuggestions(sorted);
            setPopoverOpen(sorted.length > 0);
        } else {
            setSuggestions([]);
            setPopoverOpen(false);
        }
    };

    const handleSuggestionClick = (volunteer: ListaCompletaItem) => {
        const fullName = formatFullName(volunteer.nombres, volunteer.apellidos);
        field.onChange(fullName);
        setPopoverOpen(false);
    };

    return (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            {/* IMPORTANTE: PopoverAnchor, no PopoverTrigger. El Trigger le agrega type="button"
                al <input> y deja de poder escribirse en él. */}
            <PopoverAnchor asChild>
                <Input
                    type="text"
                    placeholder={`Opción ${index + 1}`}
                    value={field.value || ''}
                    onChange={handleInputChange}
                    onBlur={field.onBlur}
                    onKeyDown={onEnter}
                    name={field.name}
                    ref={field.ref}
                    autoComplete="off"
                    className="flex-1"
                />
            </PopoverAnchor>
            <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                {/* div con scroll propio: ScrollArea con max-h no permite desplazarse */}
                <div className="max-h-48 overflow-y-auto overscroll-contain">
                    {suggestions.map(v => (
                        <div
                            key={v.id}
                            className="p-2 hover:bg-accent cursor-pointer text-sm flex justify-between items-center"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleSuggestionClick(v);
                            }}
                        >
                            <span>{formatFullName(v.nombres, v.apellidos)}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{v.tipo}</span>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
};

// "Blanco" y "Nulo" son opciones fijas que siempre van al final.
const FIXED_OPTION_NAMES = ['blanco', 'nulo'];

// Valores iniciales del formulario. Con `source` (duplicar una votación) se copian la pregunta,
// las opciones propias y el tipo; "Blanco" y "Nulo" se vuelven a agregar al final.
function buildInitialValues(source?: Poll | null): z.infer<typeof formSchema> {
  if (!source) {
    return {
      question: '',
      options: [{ text: '' }, { text: 'Blanco' }, { text: 'Nulo' }],
      pollType: 'simple',
    };
  }
  const custom = (source.options || [])
    .map(o => o.text)
    .filter(text => !FIXED_OPTION_NAMES.includes(normalizeText(text).trim()));
  return {
    question: source.question,
    options: [...(custom.length > 0 ? custom : ['']).map(text => ({ text })), { text: 'Blanco' }, { text: 'Nulo' }],
    pollType: source.pollType,
    maxSelections: source.pollType === 'multiple' ? source.maxSelections : undefined,
  };
}

type CreatePollDialogProps = {
  /** Votación a duplicar: precarga pregunta, opciones y tipo (se crea una votación nueva). */
  sourcePoll?: Poll | null;
  /** Control externo del diálogo (opcional). Sin esto el diálogo maneja su propio estado. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Oculta el botón "Crear Votación" (cuando el diálogo se abre desde otro botón). */
  hideTrigger?: boolean;
};

export function CreatePollDialog({ sourcePoll, open: openProp, onOpenChange, hideTrigger }: CreatePollDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('custom');
  const [isCargoElection, setIsCargoElection] = useState(false);

  const templatesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, `admins/${user.uid}/poll_templates`);
  }, [user, firestore]);
  const { data: pollTemplates, isLoading: templatesLoading } = useCollection<PollTemplate>(templatesQuery);

  const volunteersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !isCargoElection) return null;
    return query(collection(firestore, 'admins', user.uid, 'lista_completa'), where('tipo', '!=', 'Martir '));
  }, [firestore, user, isCargoElection]);
  const { data: volunteers } = useCollection<ListaCompletaItem>(volunteersQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: buildInitialValues(sourcePoll),
  });

  const { fields, insert, remove, move } = useFieldArray({
    control: form.control,
    name: 'options',
  });

  const pollType = form.watch('pollType');

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === 'custom') {
        form.setValue('question', '');
        form.setValue('pollType', 'simple');
        form.setValue('maxSelections', undefined);
        form.clearErrors('maxSelections');
        setIsCargoElection(false);
    } else {
        const template = pollTemplates?.find(t => t.id === templateId);
        if (template) {
            form.setValue('question', template.question);
            form.setValue('pollType', template.pollType);
            if (template.pollType === 'multiple' && template.maxSelections) {
                form.setValue('maxSelections', template.maxSelections);
            } else {
                form.setValue('maxSelections', undefined);
            }
            form.trigger('maxSelections');
            setIsCargoElection(template.eleccionDeCargo || false);
        }
    }
  };

  const resetDialog = () => {
    form.reset(buildInitialValues(sourcePoll));
    setIsLoading(false);
    setSelectedTemplateId('custom');
    setIsCargoElection(false);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) return;
    
    setIsLoading(true);

    try {
        const pollsCollection = collection(firestore, 'admins', user.uid, 'polls');
        const newPollRef = doc(pollsCollection);

        const newPollData = {
            id: newPollRef.id,
            question: values.question,
            options: values.options.map((opt, index) => ({ id: `opt_${index + 1}`, text: opt.text })),
            pollType: values.pollType,
            ...(values.pollType === 'multiple' && { maxSelections: values.maxSelections }),
            status: 'pending' as const,
            adminId: user.uid,
            createdAt: serverTimestamp(),
        };

        const batch = writeBatch(firestore);
        batch.set(newPollRef, newPollData);
        
        const lookupRef = doc(firestore, 'poll-lookup', newPollRef.id);
        batch.set(lookupRef, { adminId: user.uid });
        
        await batch.commit();

        toast({
            title: '¡Votación Creada!',
            description: `La votación se ha guardado como pendiente.`,
        });

        setOpen(false);
        resetDialog();

    } catch (error: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `admins/${user?.uid}/polls`,
            operation: 'create',
            requestResourceData: values,
        }));
    } finally {
        setIsLoading(false);
    }
  }

  const addOptionBeforeDefaults = () => {
    const indexToInsert = Math.max(0, fields.length - 2);
    insert(indexToInsert, { text: '' });
    // Dejar el cursor listo en la opción nueva
    setTimeout(() => form.setFocus(`options.${indexToInsert}.text` as const), 0);
  };

  // Enter dentro de una opción: agrega otra opción (no crea la votación).
  // Si la opción actual está vacía no se agrega otra, para no acumular campos en blanco.
  const handleOptionEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.currentTarget.value.trim() === '') return;
    addOptionBeforeDefaults();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if(!isOpen) resetDialog(); }}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Votación
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-xl max-h-[90dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{sourcePoll ? 'Duplicar Votación' : 'Crear Nueva Votación'}</DialogTitle>
          <DialogDescription>
            {sourcePoll
              ? 'Se copiaron la pregunta, las opciones y el tipo. Revísalos y guarda: se crea una votación nueva y pendiente, sin grupo ni votos.'
              : 'Configura los detalles de tu votación. "Blanco" y "Nulo" siempre estarán al final.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            // Enter en cualquier campo de texto NO envía el formulario: la votación solo se crea con el botón.
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault();
            }}
            className="space-y-4 overflow-y-auto pr-6 pl-1 -mr-4"
          >
            <div className="space-y-2">
              <Label>Plantilla (Opcional)</Label>
              <Select onValueChange={handleTemplateChange} value={selectedTemplateId} disabled={templatesLoading}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={templatesLoading ? "Cargando..." : "Usar plantilla..."} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="custom">Personalizada</SelectItem>
                  {pollTemplates?.map(template => (
                    <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pregunta</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: ¿Quién debe ser el nuevo oficial?" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='space-y-2'>
              <Label>Opciones</Label>
              {isCargoElection && (
                <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800 p-2">
                    <AlertDescription className="text-xs">
                        Búsqueda de voluntarios activa para las opciones.
                    </AlertDescription>
                </Alert>
              )}
              {fields.map((field, index) => {
                  const isFixed = index >= fields.length - 2;
                  return (
                    <FormField
                    key={field.id}
                    control={form.control}
                    name={`options.${index}.text`}
                    render={({ field: formField }) => (
                        <FormItem>
                            <FormControl>
                                <div className="flex items-center gap-2">
                                    <GripVertical className={cn("h-4 w-4 text-muted-foreground", isFixed && "invisible")} />
                                    {isCargoElection && !isFixed ? (
                                        <AutocompleteInput
                                            field={formField}
                                            index={index}
                                            volunteers={volunteers || []}
                                            onEnter={handleOptionEnter}
                                        />
                                    ) : (
                                        <Input 
                                            placeholder={`Opción ${index + 1}`} 
                                            {...formField} 
                                            onKeyDown={handleOptionEnter}
                                            disabled={isFixed}
                                            className={isFixed ? "bg-muted" : ""}
                                        />
                                    )}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className={cn('h-8 w-8', (isFixed || fields.length <= 3) && "invisible")}
                                        onClick={() => remove(index)}
                                        disabled={isFixed}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                    />
                  );
              })}
              <Button type="button" variant="outline" size="sm" onClick={addOptionBeforeDefaults}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Opción Personalizada
              </Button>
            </div>

            <FormField
              control={form.control}
              name="pollType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Tipo</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-1"
                      disabled={selectedTemplateId !== 'custom'}
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="simple" /></FormControl>
                        <FormLabel className="font-normal">Simple</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="multiple" /></FormControl>
                        <FormLabel className="font-normal">Múltiple</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            {pollType === 'multiple' && (
              <FormField
                control={form.control}
                name="maxSelections"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Máximo de Selección</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} disabled={selectedTemplateId !== 'custom'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-0 -mx-6 px-6 border-t">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
