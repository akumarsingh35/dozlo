import { enableProdMode, importProvidersFrom } from '@angular/core';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { firebaseConfig } from './firebase-config';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withViewTransitions, withEnabledBlockingInitialNavigation } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { register } from 'swiper/element/bundle';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

// register Swiper custom elements
register();

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    importProvidersFrom(IonicModule.forRoot({
      mode: 'ios' // Use iOS mode for consistent behavior across platforms
    })),
    provideRouter(routes, withEnabledBlockingInitialNavigation()),
    provideHttpClient(),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
 
    // NOTE: No AngularFire provideAnalytics here — analytics is handled natively via Capacitor on Android.
  ],
});
   
