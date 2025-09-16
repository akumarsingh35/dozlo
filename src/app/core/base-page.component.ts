import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationService } from '../services/navigation.service';
import { Subscription } from 'rxjs';

@Component({
  template: ''
})
export abstract class BasePageComponent implements OnInit, OnDestroy {
  protected navigationSubscription: Subscription | undefined;

  constructor(protected navigationService: NavigationService) {}

  ngOnInit() {
    // Simple initialization - no complex navigation state tracking
    console.log('BasePageComponent initialized');
  }

  ngOnDestroy() {
    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
    }
  }

  /**
   * Override this method in child components to handle navigation state changes
   */
  protected onNavigationStateChange(state: any): void {
    // Default implementation - can be overridden by child components
  }

  /**
   * Programmatically trigger back button behavior
   */
  protected goBack(): void {
    this.navigationService.goBack();
  }

  /**
   * Navigate to home
   */
  protected goToHome(): void {
    this.navigationService.goToHome();
  }
}
