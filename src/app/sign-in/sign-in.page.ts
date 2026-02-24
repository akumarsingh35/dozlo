import { Component, inject } from '@angular/core';
import { IonicModule, AlertController, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/auth.service';
import { BasePageComponent } from '../core/base-page.component';
import { NavigationService } from '../services/navigation.service';
import { ConnectivityService } from '../services/connectivity.service';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [IonicModule, CommonModule],
  templateUrl: './sign-in.page.html',
  styleUrls: ['./sign-in.page.scss']
})
export class SignInPage extends BasePageComponent {
  private authService = inject(AuthService);
  private alertController = inject(AlertController);
  private navController = inject(NavController);
  private connectivity = inject(ConnectivityService);
  
  isLoading = false;
  private isLegalNavigationInFlight = false;

  constructor(navigationService: NavigationService) {
    super(navigationService);
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
      // Navigation is handled in auth service
    } catch (error) {
      console.error('Sign-in error:', error);
      const message = error instanceof Error ? error.message : 'Unable to sign in with Google. Please try again.';
      
      const alert = await this.alertController.create({
        header: 'Sign-In Failed',
        message,
        buttons: ['OK']
      });
      
      await alert.present();
    } finally {
      this.isLoading = false;
    }
  }

  async openLegalPage(page: 'privacy' | 'terms'): Promise<void> {
    if (this.isLegalNavigationInFlight) {
      return;
    }

    if (!this.connectivity.isOnline) {
      this.connectivity.notifyOfflineAction();
      return;
    }

    this.isLegalNavigationInFlight = true;
    const target = page === 'privacy' ? '/privacy-policy' : '/terms-of-use';
    this.blurActiveElement();

    try {
      await this.navController.navigateForward([target], {
        animated: false,
        queryParams: { from: 'sign-in' },
      });
    } catch (error) {
      console.error(`Failed to navigate to ${target}:`, error);
    } finally {
      setTimeout(() => {
        this.isLegalNavigationInFlight = false;
      }, 150);
    }
  }

  private blurActiveElement(): void {
    const activeElement = document.activeElement as HTMLElement | null;
    activeElement?.blur();
  }

  // Override to handle navigation state changes if needed
  protected override onNavigationStateChange(state: any): void {
    console.log('Sign-in page navigation state:', state);
  }
}
