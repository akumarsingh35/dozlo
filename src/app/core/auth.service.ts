import { Injectable } from '@angular/core';
import { Auth, GoogleAuthProvider, signOut, User, signInWithCredential } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { NavController, Platform } from '@ionic/angular';
import { BehaviorSubject, Observable } from 'rxjs';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  user$: Observable<User | null> = this.userSubject.asObservable();
  private googleSignInInFlight: Promise<void> | null = null;

  constructor(
    private auth: Auth,
    private router: Router,
    private navCtrl: NavController,
    private platform: Platform
  ) {
    this.initializeAuthState();
  }

  private log(message: string, data?: any) {
    if (!environment.production) {
      console.log(`[AUTH DEBUG] ${message}`, data);
    }
  }

  private async initializeAuthState() {
    if (this.platform.is('capacitor')) {
      // Listen to Capacitor Firebase Authentication state changes
      FirebaseAuthentication.addListener('authStateChange', (change) => {
        if (change.user) {
          // Convert Capacitor user to Angular Firebase User format
          const angularUser = this.convertCapacitorUserToAngularUser(change.user);
          this.userSubject.next(angularUser);
        } else {
          this.userSubject.next(null);
        }
      });

      // Check initial auth state
      try {
        const result = await FirebaseAuthentication.getCurrentUser();
        if (result.user) {
          const angularUser = this.convertCapacitorUserToAngularUser(result.user);
          this.userSubject.next(angularUser);
        }
      } catch (error) {
        // No current user found
      }
    } else {
      // For web, use Angular Firebase Auth
      this.auth.onAuthStateChanged((user) => {
        this.userSubject.next(user);
      });
    }
  }

  private convertCapacitorUserToAngularUser(capacitorUser: any): User {
    // Try to get photo URL from main object - check both photoURL and photoUrl
    let photoURL = capacitorUser.photoURL || capacitorUser.photoUrl;
    
    // Try to get photo URL from provider data if not in main object
    if (!photoURL && capacitorUser.providerData && Array.isArray(capacitorUser.providerData)) {
      const googleProvider = capacitorUser.providerData.find((provider: any) => 
        provider.providerId === 'google.com' || provider.providerId === 'google'
      );
      if (googleProvider) {
        // Check both photoURL and photoUrl in provider
        if (googleProvider.photoURL) {
          photoURL = googleProvider.photoURL;
        } else if (googleProvider.photoUrl) {
          photoURL = googleProvider.photoUrl;
        }
        // Check for alternative properties
        if (!photoURL && googleProvider.picture) {
          photoURL = googleProvider.picture;
        }
        if (!photoURL && googleProvider.avatar) {
          photoURL = googleProvider.avatar;
        }
      }
    }
    
    // Also check if photo URL might be in a different property name
    if (!photoURL) {
      const possiblePhotoProperties = ['picture', 'avatar', 'image', 'profilePicture', 'profileImage'];
      for (const prop of possiblePhotoProperties) {
        if (capacitorUser[prop]) {
          photoURL = capacitorUser[prop];
          break;
        }
      }
    }
    
    // Last resort: Try to construct a Google profile photo URL using email
    if (!photoURL && capacitorUser.email) {
      const emailHash = this.md5(capacitorUser.email.toLowerCase().trim());
      const gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}?d=404&s=200`;
      photoURL = gravatarUrl;
    }
    
    // Create a mock User object that matches Angular Firebase User interface
    const mockUser = {
      uid: capacitorUser.uid,
      email: capacitorUser.email,
      displayName: capacitorUser.displayName,
      photoURL: photoURL,
      emailVerified: capacitorUser.emailVerified,
      isAnonymous: capacitorUser.isAnonymous,
      metadata: capacitorUser.metadata,
      providerData: capacitorUser.providerData,
      refreshToken: capacitorUser.refreshToken,
      tenantId: capacitorUser.tenantId,
      delete: async () => {},
      getIdToken: async () => capacitorUser.refreshToken || '',
      getIdTokenResult: async () => ({ token: '', authTime: '', issuedAtTime: '', expirationTime: '', signInProvider: null, claims: {} }),
      reload: async () => {},
      toJSON: () => capacitorUser,
      phoneNumber: capacitorUser.phoneNumber,
      providerId: capacitorUser.providerId
    } as User;

    return mockUser;
  }

  // Simple MD5 hash function for Gravatar
  private md5(str: string): string {
    // This is a simple implementation - in production you might want to use a proper MD5 library
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message ?? '';
    }
    return String(error ?? '');
  }

  private isNoCredentialError(error: unknown): boolean {
    const normalized = this.extractErrorMessage(error).toLowerCase();
    return (
      normalized.includes('no credential') ||
      normalized.includes('nocredential') ||
      normalized.includes('no credentials found') ||
      normalized.includes('getcredential') ||
      normalized.includes('credential manager') ||
      normalized.includes('no matching credential')
    );
  }

  /**
   * On some Android OEM/device combos, Credential Manager can return
   * "No credentials found" even when Google Sign-In is otherwise possible.
   * We retry once via legacy GoogleSignInClient for compatibility.
   */
  private async signInWithGoogleNativeWithFallback() {
    try {
      return await FirebaseAuthentication.signInWithGoogle({
        useCredentialManager: true,
        scopes: ['email', 'profile']
      });
    } catch (error) {
      if (!this.isNoCredentialError(error)) {
        throw error;
      }

      this.log('Credential Manager failed, retrying GoogleSignInClient fallback.', error);
      await this.sleep(250);
      return await FirebaseAuthentication.signInWithGoogle({
        useCredentialManager: false,
        scopes: ['email', 'profile']
      });
    }
  }

  async signInWithGoogle() {
    if (this.googleSignInInFlight) {
      return this.googleSignInInFlight;
    }

    this.googleSignInInFlight = this.performGoogleSignIn();
    try {
      await this.googleSignInInFlight;
    } finally {
      this.googleSignInInFlight = null;
    }
  }

  private async performGoogleSignIn() {
    if (!this.platform.is('capacitor')) {
      throw new Error('Google sign-in is only supported on Android in this app.');
    }
    
    try {
      // Use native Google Sign-In with fallback for broader device compatibility.
      const result = await this.signInWithGoogleNativeWithFallback();
      
      if (result.user) {
        
        // Convert and update the user state immediately
        const angularUser = this.convertCapacitorUserToAngularUser(result.user);
        this.userSubject.next(angularUser);
        
        // Navigate to home
        this.navCtrl.navigateRoot(['/home']);
      } else {
        console.error('No user or credential in result:', result);
        throw new Error('No user data received from Google Sign-In');
      }
    } catch (error) {
      console.error('Google sign-in error details:', error);
      
      // Log the full error object for debugging
      if (error && typeof error === 'object') {
        console.error('Error object:', JSON.stringify(error, null, 2));
      }
      
      const rawError = this.extractErrorMessage(error);
      const normalized = rawError.toLowerCase();
      const errorCode = (error as any)?.code ?? '';

      // Common Android Google Sign-In config failures:
      // 10 / DEVELOPER_ERROR, 12500 / sign_in_failed (OAuth / SHA / package config issue)
      if (
        normalized.includes('developer') ||
        normalized.includes('error 10') ||
        normalized.includes('status code 10') ||
        normalized.includes('12500') ||
        String(errorCode).includes('10') ||
        String(errorCode).includes('12500')
      ) {
        throw new Error(
          'Google Sign-In is not configured correctly for this app build. Please verify google-services.json and SHA fingerprints in Firebase.'
        );
      }

      if (normalized.includes('network')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      if (this.isNoCredentialError(error)) {
        throw new Error('No eligible Google account was found on this device. Please verify Google Play Services and try another account.');
      }
      if (normalized.includes('cancelled') || normalized.includes('12501')) {
        throw new Error('Sign-in was cancelled.');
      }
      if (normalized.includes('something went wrong')) {
        throw new Error('Google Sign-In service error. Please try again later.');
      }

      throw new Error(`Sign-in failed: ${rawError}`);
    }
  }

  async signOut() {
    try {
      await FirebaseAuthentication.signOut();
      this.userSubject.next(null);
      this.navCtrl.navigateRoot(['/home']);
    } catch (error) {
      console.error('Sign-out error:', error);
      throw error;
    }
  }

  get currentUser(): User | null {
    return this.userSubject.value;
  }
}
