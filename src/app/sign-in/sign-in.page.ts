import { Component, inject } from '@angular/core';
import { IonicModule, NavController, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/auth.service';
import { BasePageComponent } from '../core/base-page.component';
import { NavigationService } from '../services/navigation.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [IonicModule, CommonModule],
  templateUrl: './sign-in.page.html',
  styleUrls: ['./sign-in.page.scss']
})
export class SignInPage extends BasePageComponent {
  private navCtrl = inject(NavController);
  private authService = inject(AuthService);
  private alertController = inject(AlertController);
  private router = inject(Router);
  
  isLoading = false;

  constructor(navigationService: NavigationService) {
    super(navigationService);
  }

  async signInWithGoogle() {
    this.isLoading = true;
    
    try {
      await this.authService.signInWithGoogle();
      // Navigation is handled in auth service
    } catch (error) {
      console.error('Sign-in error:', error);
      
      const alert = await this.alertController.create({
        header: 'Sign-In Failed',
        message: 'Unable to sign in with Google. Please try again.',
        buttons: ['OK']
      });
      
      await alert.present();
    } finally {
      this.isLoading = false;
    }
  }

  navigateToPrivacyPolicy() {
    this.navCtrl.navigateForward(['/privacy-policy'], { queryParams: { from: 'sign-in' }, animated: false });
  }

  navigateToTerms() {
    this.navCtrl.navigateForward(['/terms-of-use'], { queryParams: { from: 'sign-in' }, animated: false });
  }

  // Override to handle navigation state changes if needed
  protected override onNavigationStateChange(state: any): void {
    console.log('Sign-in page navigation state:', state);
  }
}
