import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BackButtonService } from './back-button.service';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  constructor(
    private router: Router,
    private backButton: BackButtonService,
  ) {
    console.log('🧭 NavigationService initialized (simplified)');
  }

  // Simple method to navigate to home
  public goToHome() {
    this.router.navigateByUrl('/home');
  }

  // Back action that mirrors hardware behavior
  public goBack() {
    this.backButton.handleBackNavigation();
  }
}
