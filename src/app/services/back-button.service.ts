import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Platform, NavController, AlertController, ActionSheetController, ModalController, PopoverController, ToastController, MenuController, IonRouterOutlet } from '@ionic/angular';
import { App } from '@capacitor/app';

@Injectable({ providedIn: 'root' })
export class BackButtonService {
  private routerOutlet?: IonRouterOutlet;
  private initialized = false;

  private readonly rootRoutes = new Set<string>(['/home', '/explore', '/library', '/profile']);

  constructor(
    private platform: Platform,
    private router: Router,
    private navController: NavController,
    private alertController: AlertController,
    private actionSheetController: ActionSheetController,
    private modalController: ModalController,
    private popoverController: PopoverController,
    private toastController: ToastController,
    private menuController: MenuController,
  ) {}

  init(outlet: IonRouterOutlet) {
    // Always update the outlet reference in case it's set after first init
    this.routerOutlet = outlet;
    if (!this.initialized) {
      this.initialized = true;
      this.platform.ready().then(() => {
        App.addListener('backButton', async () => {
          await this.handleBackNavigation();
        });
      });
    }
  }

  async handleBackNavigation() {
    // 1) Close any open menus first
    const isMenuOpen = await this.menuController.isOpen();
    if (isMenuOpen) {
      await this.menuController.close();
      return;
    }

    // 2) Dismiss top-most overlays in priority order
    if (await this.dismissTopOverlay()) {
      return;
    }

    const currentUrl = this.router.url;
    const pathOnly = currentUrl.split('?')[0];

    // 3) Check for main pages FIRST - these should always go to home
    if (pathOnly === '/explore' || pathOnly === '/library' || pathOnly === '/profile') {
      // Use navigateRoot to clear history and prevent back navigation
      this.navController.navigateRoot(['/home'], { animated: false });
      return;
    }

    // 4) If on home page, exit app
    if (pathOnly === '/home') {
      App.exitApp();
      return;
    }

    // 5) If router outlet can go back, pop it (for sub-pages)
    if (this.routerOutlet && this.routerOutlet.canGoBack()) {
      await this.routerOutlet.pop();
      return;
    }

    // 6) Fallback: if NavController has history, go back
    try {
      // @ts-ignore: canGoBack exists on NavController in Ionic Angular
      if (typeof this.navController.canGoBack === 'function' && this.navController.canGoBack()) {
        this.navController.back();
        return;
      }
    } catch {}

    const urlTree = this.router.parseUrl(currentUrl);
    const fromParam = (urlTree.queryParams && urlTree.queryParams['from']) ? String(urlTree.queryParams['from']).trim() : '';
    const allowedSources = new Set<string>(['home', 'explore', 'library', 'profile', 'about', 'help-support', 'data-usage', 'sign-in']);

    // Special-case: category subpage should go back to explore tab
    if (pathOnly.startsWith('/explore-category')) {
      await this.router.navigateByUrl('/explore');
      return;
    }

    // Special-case: see-all page back should go to home if no history
    if (pathOnly.startsWith('/see-all')) {
      await this.router.navigateByUrl('/home');
      return;
    }

    // Legal pages should return to their source (from query) or sensible default
    if (pathOnly === '/privacy-policy' || pathOnly === '/terms-of-use') {
      if (fromParam && allowedSources.has(fromParam)) {
        await this.router.navigateByUrl(`/${fromParam}`);
      } else {
        await this.router.navigateByUrl('/sign-in');
      }
      return;
    }

    // 7) Otherwise, navigate to home as a safe default
    this.navController.navigateRoot(['/home']);
  }

  private async dismissTopOverlay(): Promise<boolean> {
    const actionSheet = await this.actionSheetController.getTop();
    if (actionSheet) {
      await actionSheet.dismiss();
      return true;
    }

    const alert = await this.alertController.getTop();
    if (alert) {
      await alert.dismiss();
      return true;
    }

    const popover = await this.popoverController.getTop();
    if (popover) {
      await popover.dismiss();
      return true;
    }

    const modal = await this.modalController.getTop();
    if (modal) {
      await modal.dismiss();
      return true;
    }

    const toast = await this.toastController.getTop();
    if (toast) {
      await toast.dismiss();
      return true;
    }

    return false;
  }
}


