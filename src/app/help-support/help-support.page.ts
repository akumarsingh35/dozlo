import { Component, OnInit, inject } from '@angular/core';
import { IonicModule, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FirebaseDataService, AppContent } from '../services/firebase-data.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { AuthService } from '../core/auth.service';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-help-support',
  templateUrl: './help-support.page.html',
  styleUrls: ['./help-support.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class HelpSupportPage implements OnInit {
  private navCtrl = inject(NavController);
  private route = inject(ActivatedRoute);
  private firebaseDataService = inject(FirebaseDataService);
  private authService = inject(AuthService);
  private destroy$ = new Subject<void>();
  
  backHref = '/sign-in';
  isLoading = true;
  helpSupportContent: AppContent['helpSupport'] | null = null;
  contactInfo: AppContent['contactInfo'] | null = null;
  user: User | null = null;

  constructor() { 
    console.log('Help & Support page constructor called');
  }

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      const from = (params.get('from') || '').trim();
      
      // Allow returning to multiple known sources if provided via query param
      const allowedSources = new Set([
        'profile',
        'about',
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

      // Get current user
      this.authService.user$.subscribe(user => {
        this.user = user;
      });

      // Fetch from Firebase dozlo_abouts collection
      this.loadHelpSupportContentFromFirebase();
    });
    console.log('Help & Support page ngOnInit called');
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadHelpSupportContentFromFirebase() {
    this.isLoading = true;
    this.firebaseDataService.getHelpSupportContent()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (helpSupportContent) => {
          this.isLoading = false;
          if (helpSupportContent) {
            this.helpSupportContent = helpSupportContent;
            console.log('❓ Help & Support content loaded from dozlo_abouts:', helpSupportContent);
            console.log('❓ Title:', helpSupportContent.title);
            console.log('❓ Header:', helpSupportContent.header);
            console.log('❓ Quick Actions:', helpSupportContent.quickActions);
            console.log('❓ FAQ Items:', helpSupportContent.faq);
            console.log('❓ Contact Info:', helpSupportContent.contactInfo);
          } else {
            console.log('❓ No help & support content found in dozlo_abouts');
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('❌ Error loading help & support content from dozlo_abouts:', error);
        }
      });

    // Also load contact info for email addresses
    this.firebaseDataService.getContactInfo()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (contactInfo) => {
          this.contactInfo = contactInfo;
          console.log('📧 Contact info loaded from dozlo_abouts:', contactInfo);
          console.log('📧 Support email:', contactInfo?.support?.email);
          console.log('📧 Feedback email:', contactInfo?.feedback?.email);
          console.log('📧 Issues email:', contactInfo?.issues?.email);
        },
        error: (error) => {
          console.error('❌ Error loading contact info from dozlo_abouts:', error);
        }
      });
  }

  sendFeedback() {
    // Use email from quickActions instead of contactInfo
    const quickAction = this.helpSupportContent?.quickActions?.find(action => action.action === 'sendFeedback');
    const email = quickAction?.email || this.contactInfo?.feedback.email || 'support@dozlo.com';
    const subject = quickAction?.subject || this.contactInfo?.feedback.subject || 'Dozlo App - Support Request';
    const body = this.generateSupportBody();
    this.openEmailClient(subject, body, email);
  }

  reportIssue() {
    // Use email from quickActions instead of contactInfo
    const quickAction = this.helpSupportContent?.quickActions?.find(action => action.action === 'reportIssue');
    const email = quickAction?.email || this.contactInfo?.issues.email || 'bugs@dozlo.com';
    const subject = quickAction?.subject || this.contactInfo?.issues.subject || 'Dozlo App - Issue Report';
    const body = this.generateIssueReportBody();
    this.openEmailClient(subject, body, email);
  }

  private generateSupportBody(): string {
    const userInfo = this.user ? 
      `User: ${this.user.displayName || 'Anonymous'} (${this.user.email || 'No email'})` : 
      'User: Anonymous';
    
    const appInfo = `
App Version: ${this.getAppVersion()}
Platform: ${Capacitor.getPlatform()}
Device: ${navigator.userAgent}
Date: ${new Date().toLocaleString()}
`;

    return `Hi Dozlo Team,

I need help with the Dozlo app.

${userInfo}
${appInfo}

Please describe your issue below:
[Your issue here]

Thank you!
`;
  }

  private generateIssueReportBody(): string {
    const userInfo = this.user ? 
      `User: ${this.user.displayName || 'Anonymous'} (${this.user.email || 'No email'})` : 
      'User: Anonymous';
    
    const appInfo = `
App Version: ${this.getAppVersion()}
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

  private getAppVersion(): string {
    return '1.0.0'; // Replace with actual app version
  }

  private openEmailClient(subject: string, body: string, email: string) {
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  }

  navigateToPrivacyPolicy() {
    this.navCtrl.navigateForward(['/privacy-policy'], { 
      queryParams: { from: 'help-support' }, 
      animated: false 
    });
  }

  navigateToTerms() {
    this.navCtrl.navigateForward(['/terms-of-use'], { 
      queryParams: { from: 'help-support' }, 
      animated: false 
    });
  }
}
