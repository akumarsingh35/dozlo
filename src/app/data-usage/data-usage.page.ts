import { Component, OnInit, inject } from '@angular/core';
import { IonicModule, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FirebaseDataService, AppContent } from '../services/firebase-data.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-data-usage',
  templateUrl: './data-usage.page.html',
  styleUrls: ['./data-usage.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class DataUsagePage implements OnInit {
  private route = inject(ActivatedRoute);
  private navController = inject(NavController);
  private firebaseDataService = inject(FirebaseDataService);
  private destroy$ = new Subject<void>();
  private isNavigating = false;
  
  backHref = '/sign-in';
  isLoading = true;
  dataUsageContent: AppContent['dataUsage'] | null = null;

  constructor() { 
    console.log('Data Usage page constructor called');
  }

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      const from = (params.get('from') || '').trim();
      
      // Allow returning to multiple known sources if provided via query param
      const allowedSources = new Set([
        'profile',
        'about',
        'help-support',
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
      this.loadDataUsageContentFromFirebase();
    });
    console.log('Data Usage page ngOnInit called');
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDataUsageContentFromFirebase() {
    this.isLoading = true;
    this.firebaseDataService.getDataUsageContent()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (dataUsageContent) => {
          this.isLoading = false;
          if (dataUsageContent) {
            this.dataUsageContent = dataUsageContent;
            console.log('📊 Data usage content loaded from dozlo_abouts:', dataUsageContent);
            console.log('📊 Title:', dataUsageContent.title);
            console.log('📊 Header:', dataUsageContent.header);
            console.log('📊 Usage Overview:', dataUsageContent.usageOverview);
            console.log('📊 Data Saving Tips:', dataUsageContent.dataSavingTips);
            console.log('📊 Privacy Note:', dataUsageContent.privacyNote);
            console.log('📊 Contact Info:', dataUsageContent.contactInfo);
          } else {
            console.log('📊 No data usage content found in dozlo_abouts');
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('❌ Error loading data usage content from dozlo_abouts:', error);
        }
      });
  }

  async navigateToPrivacyPolicy() {
    if (this.isNavigating) {
      return;
    }

    this.isNavigating = true;
    try {
      await this.navController.navigateForward(['/privacy-policy'], {
        animated: false,
        queryParams: { from: 'data-usage' },
      });
    } catch (error) {
      console.error('Navigation failed for /privacy-policy:', error);
    } finally {
      setTimeout(() => {
        this.isNavigating = false;
      }, 150);
    }
  }
}
