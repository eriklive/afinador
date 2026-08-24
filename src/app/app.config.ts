import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // O service worker é o que faz o afinador abrir sem internet depois da
    // primeira visita. Fora da build de produção não há `ngsw-worker.js` para
    // registrar, e um worker antigo grudado no `localhost` esconderia as
    // mudanças em desenvolvimento.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Espera o app estabilizar: no primeiro carregamento o que importa é
      // abrir o microfone, não pré-carregar arquivos para a próxima visita.
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
