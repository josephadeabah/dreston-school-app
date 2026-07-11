import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Caches Next.js's own pages/scripts/styles (network-first, falling back
  // to cache when offline). All actual school data (students, attendance,
  // fees, etc.) is handled separately by the app's own IndexedDB layer in
  // lib/offline — this only makes sure the app itself can still open.
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
