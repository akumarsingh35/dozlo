import { Component, OnInit, inject } from '@angular/core';
import { IonicModule, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FirebaseDataService, AppContent } from '../services/firebase-data.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.page.html',
  styleUrls: ['./privacy-policy.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class PrivacyPolicyPage implements OnInit {
  private navCtrl = inject(NavController);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private firebaseDataService = inject(FirebaseDataService);
  private destroy$ = new Subject<void>();
  
  backHref = '/sign-in';
  privacyPolicyData: SafeHtml = '';
  showDefaultContent = true;
  isLoading = true;
  privacyPolicy: AppContent['privacyPolicy'] | null = null;

  constructor() { 
    console.log('Privacy Policy page constructor called');
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

      // Handle privacy policy data - prioritize query param data over Firebase
      if (data) {
        this.showDefaultContent = false;
        this.isLoading = false;
        // Convert <br> tags to line breaks and sanitize the HTML
        const processedData = data.replace(/<br\s*\/?>/gi, '<br>');
        this.privacyPolicyData = this.sanitizer.bypassSecurityTrustHtml(processedData);
      } else {
        // Fetch from Firebase dozlo_abouts collection
        this.loadPrivacyPolicyFromFirebase();
      }
    });
    console.log('Privacy Policy page ngOnInit called');
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadPrivacyPolicyFromFirebase() {
    this.isLoading = true;
    this.firebaseDataService.getPrivacyPolicyFromAbout()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (privacyPolicy) => {
          this.isLoading = false;
          if (privacyPolicy) {
            this.privacyPolicy = privacyPolicy;
            this.showDefaultContent = false;
            // Convert <br> tags to line breaks and sanitize the HTML
            const processedData = privacyPolicy.content.replace(/<br\s*\/?>/gi, '<br>');
            this.privacyPolicyData = this.sanitizer.bypassSecurityTrustHtml(processedData);
            console.log('🔒 Privacy policy loaded from dozlo_abouts:', privacyPolicy.title);
          } else {
            this.showDefaultContent = true;
            console.log('🔒 No privacy policy found in dozlo_abouts, showing default content');
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.showDefaultContent = true;
          console.error('❌ Error loading privacy policy from dozlo_abouts:', error);
        }
      });
  }
} 