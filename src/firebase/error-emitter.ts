type EventMap = Record<string, any>;
type EventKey<T extends EventMap> = string & keyof T;

interface Emitter<T extends EventMap> {
  on<K extends EventKey<T>>(eventName: K, fn: (payload: T[K]) => void): void;
  off<K extends EventKey<T>>(eventName: K, fn: (payload: T[K]) => void): void;
  emit<K extends EventKey<T>>(eventName: K, payload: T[K]): void;
}

function createEmitter<T extends EventMap>(): Emitter<T> {
  const listeners: { [K in keyof T]?: ((payload: T[K]) => void)[] } = {};

  return {
    on(eventName, fn) {
      listeners[eventName] = (listeners[eventName] || []).concat(fn);
    },
    off(eventName, fn) {
      listeners[eventName] = (listeners[eventName] || []).filter(
        (f) => f !== fn
      );
    },
    emit(eventName, payload) {
      (listeners[eventName] || []).forEach((fn) => {
        fn(payload);
      });
    },
  };
}

import { FirestorePermissionError } from './errors';

interface AppEvents {
  'permission-error': FirestorePermissionError;
}

export const errorEmitter = createEmitter<AppEvents>();
