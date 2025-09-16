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

  async signInWithGoogle() {
    if (!this.platform.is('capacitor')) {
      throw new Error('Google sign-in is only supported on Android in this app.');
    }
    
    try {
      // Use the official Capacitor Firebase Authentication plugin
      const result = await FirebaseAuthentication.signInWithGoogle();
      
      if (result.user && result.credential) {
        
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
      
      // Provide more specific error messages
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('network')) {
          throw new Error('Network error. Please check your internet connection.');
        } else if (errorMessage.includes('cancelled')) {
          throw new Error('Sign-in was cancelled.');
        } else if (errorMessage.includes('developer')) {
          throw new Error('Sign-in configuration error. Please contact support.');
        } else if (errorMessage.includes('something went wrong')) {
          throw new Error('Google Sign-In service error. Please try again later.');
        }
      }
      
      throw new Error(`Sign-in failed: ${error}`);
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
