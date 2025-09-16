import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BasePageComponent } from '../../core/base-page.component';
import { NavigationService } from '../../services/navigation.service';
import { BackButtonDirective } from '../../shared/directives/back-button.directive';

@Component({
  selector: 'app-back-button-test',
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button appBackButton>
            <ion-icon name="arrow-back"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>Back Button Test</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="container">
        <ion-card>
          <ion-card-header>
            <ion-card-title>Navigation State</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p><strong>Current URL:</strong> {{ getCurrentRoute() }}</p>
            <p><strong>Platform:</strong> {{ getPlatformInfo() }}</p>
            <p><strong>Back Button Handler:</strong> {{ isHandlerRegistered() }}</p>
            <p><strong>Global Service:</strong> {{ isGlobalServiceAvailable() }}</p>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>Test Actions</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-button expand="block" (click)="goBack()" color="secondary">
              Test Back Button Logic
            </ion-button>
            
            <ion-button expand="block" (click)="navigateToHome()">
              Go to Home
            </ion-button>
            
            <ion-button expand="block" (click)="navigateToExplore()">
              Go to Explore
            </ion-button>
            
            <ion-button expand="block" (click)="navigateToLibrary()">
              Go to Library
            </ion-button>
            
            <ion-button expand="block" (click)="navigateToProfile()">
              Go to Profile
            </ion-button>
            
            <ion-button expand="block" (click)="navigateToSeeAll()">
              Go to See All
            </ion-button>
            
            <ion-button expand="block" (click)="navigateToPrivacy()">
              Go to Privacy Policy
            </ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>Back Button Information</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p><strong>Back Button Logic:</strong></p>
            <ul>
              <li>Main pages (home, explore, library, profile) → Exit app</li>
              <li>All other pages → Go to home</li>
            </ul>
            <p><strong>Handler Location:</strong> AppComponent</p>
            <p><strong>Method:</strong> handleBackButton()</p>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  `,
  standalone: true,
  imports: [IonicModule, CommonModule, BackButtonDirective]
})
export class BackButtonTestPage extends BasePageComponent {
  constructor(
    private router: Router,
    navigationService: NavigationService
  ) {
    super(navigationService);
  }

  testBackButton() {
    console.log('🧪 Testing back button logic');
    this.goBack();
  }

  navigateToHome() {
    this.router.navigateByUrl('/home');
  }

  navigateToExplore() {
    this.router.navigateByUrl('/explore');
  }

  navigateToLibrary() {
    this.router.navigateByUrl('/library');
  }

  navigateToProfile() {
    this.router.navigateByUrl('/profile');
  }

  navigateToSeeAll() {
    this.router.navigateByUrl('/see-all');
  }

  navigateToPrivacy() {
    this.router.navigateByUrl('/privacy-policy');
  }

  getPlatformInfo(): string {
    return 'Android (Capacitor)';
  }

  isHandlerRegistered(): string {
    return 'AppComponent.handleBackButton()';
  }

  getCurrentRoute(): string {
    return this.router.url;
  }

  isGlobalServiceAvailable(): string {
    return 'Simplified - No global service needed';
  }
}
