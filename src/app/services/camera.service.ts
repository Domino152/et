import { Injectable } from '@angular/core';
import {
  Camera,
  CameraResultType,
  CameraSource,
  Photo,
  PermissionStatus
} from '@capacitor/camera';

export interface CapturedImage {
  base64Data: string;   // raw base64 (no data-URI prefix)
  dataUrl: string;      // data:image/jpeg;base64,... – ready for <img src>
  mimeType: string;
  format: string;
}

@Injectable({ providedIn: 'root' })
export class CameraService {

  // ─── Permission ────────────────────────────────────────────────────────────

  /** Returns true when the app has (or just obtained) camera permission. */
  async requestPermission(): Promise<boolean> {
    try {
      const status: PermissionStatus = await Camera.checkPermissions();

      if (status.camera === 'granted') {
        return true;
      }

      if (status.camera === 'denied') {
        // Permanently denied – the user must open Settings manually
        return false;
      }

      // 'prompt' or 'prompt-with-rationale' → ask
      const requested = await Camera.requestPermissions({ permissions: ['camera'] });
      return requested.camera === 'granted';

    } catch (err) {
      // On web / Capacitor web layer, permissions behave differently
      console.warn('CameraService: permission check failed', err);
      return true; // optimistic – let getPhoto() throw if truly unavailable
    }
  }

  // ─── Capture ───────────────────────────────────────────────────────────────

  /**
   * Opens the camera, captures a photo, and returns it as base64.
   * Throws a descriptive error if the user denies permission or cancels.
   */
  async capturePhoto(): Promise<CapturedImage> {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      throw new Error(
        'Camera permission denied. Please enable it in device Settings.'
      );
    }

    let photo: Photo;
    try {
      photo = await Camera.getPhoto({
        quality:      85,
        allowEditing: false,
        resultType:   CameraResultType.Base64,
        source:       CameraSource.Camera,
        correctOrientation: true,
        saveToGallery: false
      });
    } catch (err: any) {
      // User cancelled – don't surface as a crash
      if (
        typeof err?.message === 'string' &&
        (err.message.toLowerCase().includes('cancel') ||
         err.message.toLowerCase().includes('no image'))
      ) {
        throw new Error('CANCELLED');
      }
      throw new Error(`Failed to capture photo: ${err?.message ?? err}`);
    }

    if (!photo.base64String) {
      throw new Error('Camera returned an empty image. Please try again.');
    }

    const mimeType = `image/${photo.format ?? 'jpeg'}`;
    return {
      base64Data: photo.base64String,
      dataUrl:    `data:${mimeType};base64,${photo.base64String}`,
      mimeType,
      format: photo.format ?? 'jpeg'
    };
  }

  // ─── Utility ───────────────────────────────────────────────────────────────

  /** Converts a base64 string to a Blob – useful for multipart upload. */
  base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers    = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([byteNumbers], { type: mimeType });
  }
}
