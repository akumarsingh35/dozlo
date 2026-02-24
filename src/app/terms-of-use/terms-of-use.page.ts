import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { IonicModule, IonContent } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FirebaseDataService, AppContent } from '../services/firebase-data.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-terms-of-use',
  templateUrl: './terms-of-use.page.html',
  styleUrls: ['./terms-of-use.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class TermsOfUsePage implements OnInit {
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private firebaseDataService = inject(FirebaseDataService);
  private destroy$ = new Subject<void>();
  @ViewChild(IonContent, { static: false }) content?: IonContent;
  
  backHref = '/sign-in';
  termsOfUseData: SafeHtml = '';
  showDefaultContent = true;
  isLoading = true;
  termsOfUse: AppContent['termsOfUse'] | null = null;

  constructor() { 
    console.log('Terms of Use page constructor called');
  }

  async ionViewDidEnter() {
    // Ensure the legal page starts from top and no hidden-page element keeps focus.
    (document.activeElement as HTMLElement | null)?.blur();
    if (this.content) {
      await this.content.scrollToTop(0);
    }
  }

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      const from = (params.get('from') || '').trim();
      const data = params.get('data');
      
      // Allow returning to multiple known sources if provided via query param
      const allowedSources = new Set([
        'profile',
        'about',
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

      // Handle terms of use data - prioritize query param data over Firebase
      if (data) {
        this.showDefaultContent = false;
        this.isLoading = false;
        // Convert <br> tags to line breaks and sanitize the HTML
        const processedData = data.replace(/<br\s*\/?>/gi, '<br>');
        this.termsOfUseData = this.sanitizer.bypassSecurityTrustHtml(processedData);
      } else {
        // Fetch from Firebase dozlo_abouts collection
        this.loadTermsOfUseFromFirebase();
      }
    });
    console.log('Terms of Use page ngOnInit called');
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTermsOfUseFromFirebase() {
    this.isLoading = true;
    this.firebaseDataService.getTermsOfUseFromAbout()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (termsOfUse) => {
          this.isLoading = false;
          if (termsOfUse) {
            this.termsOfUse = termsOfUse;
            this.showDefaultContent = false;
            // Convert <br> tags to line breaks and sanitize the HTML
            const processedData = termsOfUse.content.replace(/<br\s*\/?>/gi, '<br>');
            this.termsOfUseData = this.sanitizer.bypassSecurityTrustHtml(processedData);
            console.log('📄 Terms of use loaded from dozlo_abouts:', termsOfUse.title);
          } else {
            this.showDefaultContent = true;
            console.log('📄 No terms of use found in dozlo_abouts, showing default content');
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.showDefaultContent = true;
          console.error('❌ Error loading terms of use from dozlo_abouts:', error);
        }
      });
  }
} 
