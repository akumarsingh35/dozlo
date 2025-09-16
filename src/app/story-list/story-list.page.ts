import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-story-list',
  templateUrl: './story-list.page.html',
  styleUrls: ['./story-list.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class StoryListPage implements OnInit {
  section: any;

  constructor(
    private router: Router,
    private navCtrl: NavController
  ) {
    // Use history.state to reliably get navigation state.
    // This is more robust than getCurrentNavigation() which can be null.
    const state = this.router.getCurrentNavigation()?.extras.state || window.history.state;
    if (state && state['section']) {
      this.section = state['section'];
    } else {
      // If no state is found (e.g., on a page refresh), navigate back to home.
      console.warn('Story list page loaded without section data. Redirecting to home.');
      this.navCtrl.navigateBack('/home');
    }
  }

  ngOnInit() {
  }

  goBack() {
    this.navCtrl.navigateBack('/home');
  }
}
