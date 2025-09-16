import { Component, OnInit, inject } from '@angular/core';
import { IonicModule, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FirebaseDataService, AppContent } from '../services/firebase-data.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { APP_VERSION } from '../version';

@Component({
  selector: 'app-about',
  templateUrl: './about.page.html',
  styleUrls: ['./about.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class AboutPage implements OnInit {
  private navCtrl = inject(NavController);
  private route = inject(ActivatedRoute);
  private firebaseDataService = inject(FirebaseDataService);
  private destroy$ = new Subject<void>();
  
  backHref = '/sign-in';
  isLoading = true;
  aboutContent: AppContent['about'] | null = null;
  appVersion = APP_VERSION;

  constructor() { 
    console.log('About page constructor called');
  }

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      const from = (params.get('from') || '').trim();
      
      // Allow returning to multiple known sources if provided via query param
      const allowedSources = new Set([
        'profile',
        'help-support',
        'data-usage',
        'home',
        'explore',
        'library',
        'sign-in'
      ]);

      if (from && allowedSources.has(from)) {
        this.backHref = `/${from}`;
      } else {
        // Default to sign-in when opened from authentication flow or deep link
        this.backHref = '/sign-in';
      }

      // Fetch from Firebase dozlo_abouts collection
      this.loadAboutContentFromFirebase();
    });
    console.log('About page ngOnInit called');
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAboutContentFromFirebase() {
    this.isLoading = true;
    this.firebaseDataService.getAboutContent()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (aboutContent) => {
          this.isLoading = false;
          if (aboutContent) {
            this.aboutContent = aboutContent;
            console.log('ℹ️ About content loaded from dozlo_abouts:', aboutContent);
            console.log('ℹ️ App Name:', aboutContent.appName);
            console.log('ℹ️ Title:', aboutContent.title);
            console.log('ℹ️ Description:', aboutContent.description);
            console.log('ℹ️ Features:', aboutContent.features);
            console.log('ℹ️ Copyright:', aboutContent.copyright);
          } else {
            console.log('ℹ️ No about content found in dozlo_abouts');
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('❌ Error loading about content from dozlo_abouts:', error);
        }
      });
  }

  navigateToPrivacyPolicy() {
    this.navCtrl.navigateForward(['/privacy-policy'], { 
      queryParams: { from: 'about' }, 
      animated: false 
    });
  }

  navigateToTerms() {
    this.navCtrl.navigateForward(['/terms-of-use'], { 
      queryParams: { from: 'about' }, 
      animated: false 
    });
  }
}
