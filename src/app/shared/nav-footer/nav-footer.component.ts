import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { IonicModule, NavController } from '@ionic/angular';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-nav-footer',
  templateUrl: './nav-footer.component.html',
  styleUrls: ['./nav-footer.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule],
})
export class NavFooterComponent {
  tabs = [
    { path: '/home', icon: 'home', label: 'Home' },
    { path: '/explore', icon: 'compass', label: 'Explore' },
    { path: '/library', icon: 'book', label: 'Library' },
    { path: '/profile', icon: 'person', label: 'Profile' },
  ];

  activePath: string = '';

  constructor(private navCtrl: NavController, private router: Router) {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.activePath = event.urlAfterRedirects;
    });
  }

  navigateTo(path: string) {
    this.navCtrl.navigateRoot(path, { animated: false });
  }

  isActive(path: string): boolean {
    return this.activePath === path;
  }
}
