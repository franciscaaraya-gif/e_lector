import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigured } from './config';

type FirebaseInstances = {
  app: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
};

let firebase: FirebaseInstances | null = null;

export function initializeFirebase(): FirebaseInstances | null {
  if (!isFirebaseConfigured) {
    console.warn('Firebase is not configured. Please add your Firebase config to your project settings.');
    return null;
  }

  if (firebase) {
    return firebase;
  }

  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const firestore = getFirestore(app);
  const auth = getAuth(app);

  firebase = { app, firestore, auth };
  return firebase;
}

export { FirebaseProvider, useFirebaseApp, useFirestore, useAuth } from './provider';
export { FirebaseClientProvider } from './client-provider';
export { useUser } from './auth/use-user';
export { useDoc } from './firestore/use-doc';
export { useCollection } from './firestore/use-collection';
