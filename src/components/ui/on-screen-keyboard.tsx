'use client';

import { useState } from 'react';
import { Delete, X, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Updater = (prev: string) => string;

interface OnScreenKeyboardProps {
  /** Recibe una función que transforma el texto actual (compatible con setState). */
  onChange: (updater: Updater) => void;
  onEnter?: () => void;
  onClose: () => void;
  className?: string;
}

const ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];
const ACCENTS = ['á', 'é', 'í', 'ó', 'ú', 'ü'];

/**
 * Teclado propio de la app. Sirve cuando el sistema operativo oculta el teclado
 * del dispositivo porque hay un lector RFID (o teclado físico) conectado.
 */
export function OnScreenKeyboard({ onChange, onEnter, onClose, className }: OnScreenKeyboardProps) {
  const [shift, setShift] = useState(true);

  // Evita que al tocar una tecla el campo de texto pierda el foco.
  const keep = (e: React.SyntheticEvent) => e.preventDefault();

  const press = (key: string) => {
    const isLetter = /\p{L}/u.test(key);
    const out = isLetter && shift ? key.toUpperCase() : key;
    onChange((prev) => prev + out);
    if (isLetter) setShift(false);
  };

  const space = () => {
    onChange((prev) => (prev.endsWith(' ') || prev === '' ? prev : prev + ' '));
    setShift(true);
  };

  const backspace = () => onChange((prev) => Array.from(prev).slice(0, -1).join(''));

  const keyClass =
    'h-12 min-w-0 flex-1 rounded-md border bg-background text-lg font-medium shadow-sm active:bg-primary active:text-primary-foreground select-none touch-manipulation';

  const renderKey = (k: string) => (
    <button
      key={k}
      type="button"
      className={keyClass}
      onMouseDown={keep}
      onPointerDown={keep}
      onClick={() => press(k)}
    >
      {shift && /\p{L}/u.test(k) ? k.toUpperCase() : k}
    </button>
  );

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-[100] border-t bg-muted p-2 shadow-2xl',
        className
      )}
      onMouseDown={keep}
      onPointerDown={keep}
    >
      <div className="mx-auto max-w-3xl space-y-1.5">
        <div className="flex justify-between items-center px-1">
          <span className="text-[11px] font-semibold uppercase text-muted-foreground">Teclado en pantalla</span>
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md hover:bg-background"
            onMouseDown={keep}
            onClick={onClose}
          >
            <X className="h-4 w-4" /> Cerrar
          </button>
        </div>

        {ROWS.map((row, i) => (
          <div key={i} className="flex gap-1.5">
            {i === 3 && (
              <button
                type="button"
                className={cn(keyClass, 'flex-[1.5] flex items-center justify-center', shift && 'bg-primary text-primary-foreground')}
                onMouseDown={keep}
                onPointerDown={keep}
                onClick={() => setShift((s) => !s)}
                aria-label="Mayúsculas"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            )}
            {row.map(renderKey)}
            {i === 3 && (
              <button
                type="button"
                className={cn(keyClass, 'flex-[1.5] flex items-center justify-center')}
                onMouseDown={keep}
                onPointerDown={keep}
                onClick={backspace}
                aria-label="Borrar"
              >
                <Delete className="h-5 w-5" />
              </button>
            )}
          </div>
        ))}

        <div className="flex gap-1.5">
          {ACCENTS.map(renderKey)}
          <button type="button" className={cn(keyClass, 'flex-[3]')} onMouseDown={keep} onPointerDown={keep} onClick={space}>
            espacio
          </button>
          {onEnter && (
            <button
              type="button"
              className={cn(keyClass, 'flex-[1.5] bg-primary text-primary-foreground')}
              onMouseDown={keep}
              onPointerDown={keep}
              onClick={onEnter}
            >
              Enter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
