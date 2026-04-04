import { Injectable } from '@angular/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser: { accessToken: string; email: string; name: string } | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await GoogleAuth.initialize({
        clientId: environment.googleClientId,
        scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file'],
      });
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

    this.currentUser = {
      accessToken: token,
      email: googleUser?.email ?? '',
      name: googleUser?.name ?? 'Google User',
    };
    return token;
  }

  async getAccessToken(): Promise<string> {
    if (this.currentUser?.accessToken) return this.currentUser.accessToken;
    return this.signIn();
  }

  getUser() { return this.currentUser; }

  async signOut(): Promise<void> {
    try { await GoogleAuth.signOut(); } catch {}
    this.currentUser = null;
  }
}