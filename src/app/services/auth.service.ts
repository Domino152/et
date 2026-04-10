import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../environments/environment';


@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<{ accessToken: string; email: string; name: string } | null>(null);
  public user$ = this.currentUserSubject.asObservable();
  
  private initialized = false;
  private readonly AUTH_KEY = 'costtrack_auth_user';


  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await GoogleAuth.initialize({
        clientId: environment.googleClientId,
        scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file'],
      });
      
      // Load persisted user session
      const { value } = await Preferences.get({ key: this.AUTH_KEY });
      if (value) {
        try {
          const user = JSON.parse(value);
          this.currentUserSubject.next(user);
        } catch {
          this.currentUserSubject.next(null);
        }
      }

      
      this.initialized = true;
    } catch (e) {
      console.warn('GoogleAuth init error', e);
    }
  }



  async signIn(): Promise<string> {
    await this.initialize();
    let googleUser: any;
    try {
      googleUser = await GoogleAuth.signIn();
    } catch (e: any) {
      console.error('SignIn Error Detailed:', e);
      let msg = e?.message;
      if (!msg) {
        try { msg = typeof e === 'object' ? JSON.stringify(e) : String(e); }
        catch { msg = String(e); }
      }
      if (msg.includes('cancel') || msg.includes('12501')) {
        throw new Error('Sign-in cancelled.');
      }
      throw new Error(`Google sign-in failed: ${msg}. If on web, ensure localhost:8100/8101 is in Authorized Origins. If on Android, check SHA-1.`);
    }

    const token = googleUser?.authentication?.accessToken ?? '';
    if (!token) {
      throw new Error('No access token returned. Check Android OAuth client and SHA-1 in Google Cloud Console.');
    }

    const user = {
      accessToken: token,
      email: googleUser?.email ?? '',
      name: googleUser?.name ?? 'Google User',
    };
    
    this.currentUserSubject.next(user);
    
    // Persist session
    await Preferences.set({
      key: this.AUTH_KEY,
      value: JSON.stringify(user)
    });
    
    return token;
  }

  async getAccessToken(): Promise<string> {
    const user = this.currentUserSubject.value;
    if (user?.accessToken) return user.accessToken;
    return this.signIn();
  }

  getUser() { return this.currentUserSubject.value; }

  async signOut(): Promise<void> {
    try { await GoogleAuth.signOut(); } catch {}
    this.currentUserSubject.next(null);
    await Preferences.remove({ key: this.AUTH_KEY });
  }
}