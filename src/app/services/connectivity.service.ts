import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { Network, ConnectionStatus } from '@capacitor/network';

@Injectable({
  providedIn: 'root',
})
export class ConnectivityService implements OnDestroy {
  private readonly onlineSubject = new BehaviorSubject<boolean>(true);
  readonly isOnline$ = this.onlineSubject.asObservable();

  private networkListener?: PluginListenerHandle;
  private browserOnlineHandler = () => this.onlineSubject.next(true);
  private browserOfflineHandler = () => this.onlineSubject.next(false);
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await this.refreshStatus();

    if (Capacitor.isNativePlatform()) {
      this.networkListener = await Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
        this.onlineSubject.next(!!status.connected);
      });
      return;
    }

    window.addEventListener('online', this.browserOnlineHandler);
    window.addEventListener('offline', this.browserOfflineHandler);
  }

  async refreshStatus(): Promise<boolean> {
    try {
      const status = await Network.getStatus();
      const isOnline = !!status.connected;
      this.onlineSubject.next(isOnline);
      return isOnline;
    } catch {
      const fallback = typeof navigator !== 'undefined' ? navigator.onLine : true;
      this.onlineSubject.next(fallback);
      return fallback;
    }
  }

  get isOnline(): boolean {
    return this.onlineSubject.getValue();
  }

  ngOnDestroy(): void {
    if (this.networkListener) {
      this.networkListener.remove();
      this.networkListener = undefined;
    }
    window.removeEventListener('online', this.browserOnlineHandler);
    window.removeEventListener('offline', this.browserOfflineHandler);
  }
}
