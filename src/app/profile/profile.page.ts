import { Component, inject } from '@angular/core';
import { IonicModule, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { OnInit } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { User } from '@angular/fire/auth';
import { NavFooterComponent } from '../shared/nav-footer/nav-footer.component';
import { Capacitor } from '@capacitor/core';
import { LibraryDataService } from '../services/library-data.service';
import { APP_VERSION } from '../version';
import { FirebaseDataService, AppContent } from '../services/firebase-data.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { ConnectivityService } from '../services/connectivity.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, NavFooterComponent]
})
export class ProfilePage implements OnInit {
  user: User | null = null;
  imageLoadError = false;
  isLoading = true; // Add loading state
  private isNavigating = false;
  totalListeningTime = '0 hours';
  recentListeningTime = '0 hours';
  appVersion = APP_VERSION;

  // Static profile items (original design)
  feedbackSupportItems = [
    { icon: 'chatbubble-ellipses-outline', text: 'Send Feedback', action: 'feedback' },
    { icon: 'star-outline', text: 'Rate Us on Play Store', action: 'rate' },
    { icon: 'alert-circle-outline', text: 'Report an Issue', action: 'report' }
  ];

  settingsItems = [
    { icon: 'log-out-outline', text: 'Log Out', action: 'logout' }
  ];

  legalItems = [
    { icon: 'shield-checkmark-outline', text: 'Privacy Policy', action: 'privacy' },
    { icon: 'document-text-outline', text: 'Terms of Use', action: 'terms' },
    { icon: 'information-circle-outline', text: 'About Dozlo', action: 'about' },
    { icon: 'help-circle-outline', text: 'Help & Support', action: 'help' },
    { icon: 'cellular-outline', text: 'Data Usage', action: 'data-usage' }
  ];

  // Firebase data (only for contact info)
  private firebaseDataService = inject(FirebaseDataService);
  private destroy$ = new Subject<void>();
  contactInfo: AppContent['contactInfo'] | null = null;

  constructor(
    private authService: AuthService, 
    private navController: NavController,
    private libraryDataService: LibraryDataService,
    private connectivity: ConnectivityService
  ) { }

  ngOnInit() {
    // Load Firebase contact info only
    this.loadContactInfoFromFirebase();
    
    // Load user data
    this.authService.user$.subscribe(user => {
      this.user = user;
      this.imageLoadError = false; // Reset error state when user changes
      this.isLoading = false; // Set loading to false when we get user state
      console.log('👤 Profile page - User state updated:', user ? 'signed in' : 'not signed in');
    });
    
    // Calculate listening time from local storage
    this.calculateListeningTime();
    
    // Fallback to ensure content is displayed even if auth service fails
    setTimeout(() => {
      if (this.isLoading) {
        console.log('👤 Profile page - Auth service timeout, setting loading to false');
        this.isLoading = false;
      }
    }, 3000); // 3 second timeout
  }

  ionViewWillEnter() {
    // Refresh listening time when entering the page
    this.calculateListeningTime();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadContactInfoFromFirebase() {
    // Load contact info for email addresses only
    this.firebaseDataService.getContactInfo()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (contactInfo) => {
          this.contactInfo = contactInfo;
          console.log('📧 Contact info loaded from dozlo_abouts:', contactInfo);
        },
        error: (error) => {
          console.error('❌ Error loading contact info from dozlo_abouts:', error);
        }
      });
  }

  private calculateListeningTime(): void {
    try {
      // Get recently played stories from local storage
      const recentlyPlayed = this.libraryDataService.getRecentlyPlayed();
      
      // Calculate total listening time
      const totalSeconds = recentlyPlayed.reduce((total: number, story: any) => {
        return total + (story.duration || 0);
      }, 0);
      
      // Calculate recent listening time (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentSeconds = recentlyPlayed
        .filter((story: any) => story.lastPlayedAt && new Date(story.lastPlayedAt) > sevenDaysAgo)
        .reduce((total: number, story: any) => {
          return total + (story.duration || 0);
        }, 0);
      
      // Convert to hours and format
      this.totalListeningTime = this.formatListeningTime(totalSeconds);
      this.recentListeningTime = this.formatListeningTime(recentSeconds);
      
      console.log('📊 Listening time calculated:', {
        total: this.totalListeningTime,
        recent: this.recentListeningTime,
        totalStories: recentlyPlayed.length
      });
    } catch (error) {
      console.error('Error calculating listening time:', error);
      this.totalListeningTime = '0 hours';
      this.recentListeningTime = '0 hours';
    }
  }

  private formatListeningTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  }

  get initials(): string {
    if (!this.user?.displayName) return '';
    return this.user.displayName.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  onImageError(event: any) {
    this.imageLoadError = true;
  }

  onImageLoad(event: any) {
    this.imageLoadError = false;
  }

  async signInWithGoogle() {
    if (this.isLoading) {
      return;
    }

    if (!this.connectivity.isOnline) {
      this.connectivity.notifyOfflineAction();
      return;
    }

    this.isLoading = true;
    try {
      await this.authService.signInWithGoogle();
    } catch (error) {
      console.error('Sign-in error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onSettingClick(item: any) {
    if (item.action === 'logout') {
      this.authService.signOut();
    }
  }

  onLegalClick(item: any) {
    switch (item.action) {
      case 'privacy':
        void this.navigateTo('/privacy-policy', { from: 'profile' });
        break;
      case 'terms':
        void this.navigateTo('/terms-of-use', { from: 'profile' });
        break;
      case 'about':
        void this.navigateTo('/about', { from: 'profile' });
        break;
      case 'help':
        void this.navigateTo('/help-support', { from: 'profile' });
        break;
      case 'data-usage':
        void this.navigateTo('/data-usage', { from: 'profile' });
        break;
      default:
        console.warn('Unknown legal action:', item.action);
        break;
    }
  }

  onFeedbackSupportClick(item: any) {
    switch (item.action) {
      case 'feedback':
        this.sendFeedback();
        break;
      case 'rate':
        this.rateApp();
        break;
      case 'report':
        this.reportIssue();
        break;
    }
  }

  sendFeedback() {
    const email = this.contactInfo?.feedback.email || 'feedback@dozlo.com';
    const subject = this.contactInfo?.feedback.subject || 'Dozlo App Feedback';
    const body = this.generateFeedbackBody();
    this.openEmailClient(subject, body, email);
  }

  rateApp() {
    if (!this.connectivity.isOnline) {
      this.connectivity.notifyOfflineAction();
      return;
    }

    // Open Play Store rating page
    const playStoreUrl = this.contactInfo?.playStoreUrl || 'https://play.google.com/store/apps/details?id=com.dozlo.app';
    window.open(playStoreUrl, '_blank');
  }

  reportIssue() {
    const email = this.contactInfo?.issues.email || 'bugs@dozlo.com';
    const subject = this.contactInfo?.issues.subject || 'Dozlo App - Issue Report';
    const body = this.generateIssueReportBody();
    this.openEmailClient(subject, body, email);
  }

  private generateFeedbackBody(): string {
    const userInfo = this.user ? 
      `User: ${this.user.displayName || 'Anonymous'} (${this.user.email || 'No email'})` : 
      'User: Anonymous';
    
    const appInfo = `
App Version: ${this.appVersion}
Platform: ${Capacitor.getPlatform()}
Device: ${navigator.userAgent}
Date: ${new Date().toLocaleString()}
`;

    return `Hi Dozlo Team,

I would like to share my feedback about the Dozlo app.

${userInfo}
${appInfo}

Please describe your feedback below:
[Your feedback here]

Thank you!
`;
  }

  private generateIssueReportBody(): string {
    const userInfo = this.user ? 
      `User: ${this.user.displayName || 'Anonymous'} (${this.user.email || 'No email'})` : 
      'User: Anonymous';
    
    const appInfo = `
App Version: ${this.appVersion}
Platform: ${Capacitor.getPlatform()}
Device: ${navigator.userAgent}
Date: ${new Date().toLocaleString()}
`;

    return `Hi Dozlo Team,

I'm experiencing an issue with the Dozlo app.

${userInfo}
${appInfo}

Issue Description:
[Please describe the issue you're experiencing]

Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Expected Behavior:
[What should happen]

Actual Behavior:
[What actually happens]

Additional Information:
[Any other relevant details]

Thank you for your help!
`;
  }

  private openEmailClient(subject: string, body: string, email: string) {
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  }

  // Needed for links in the sign-in prompt section of the template
  navigateToPrivacyPolicy() {
    void this.navigateTo('/privacy-policy', { from: 'profile' });
  }

  navigateToTerms() {
    void this.navigateTo('/terms-of-use', { from: 'profile' });
  }

  openLegalPage(page: 'privacy' | 'terms'): void {
    this.blurActiveElement();

    const target = page === 'privacy' ? '/privacy-policy' : '/terms-of-use';
    void this.navigateTo(target, { from: 'profile' });
  }

  private async navigateTo(path: string, queryParams?: Record<string, string>): Promise<void> {
    if (this.isNavigating) {
      return;
    }

    if (!this.connectivity.isOnline) {
      this.connectivity.notifyOfflineAction();
      return;
    }

    this.isNavigating = true;
    try {
      await this.navController.navigateForward([path], {
        animated: false,
        queryParams,
      });
    } catch (error) {
      console.error(`Navigation failed for ${path}:`, error);
    } finally {
      setTimeout(() => {
        this.isNavigating = false;
      }, 200);
    }
  }

  private blurActiveElement(): void {
    const activeElement = document.activeElement as HTMLElement | null;
    activeElement?.blur();
  }

}
