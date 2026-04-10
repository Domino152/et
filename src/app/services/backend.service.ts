import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReceiptData {
  userId: string; // The email of the person
  name: string;
  imageUrl: string;
  description: string;
  category: string;
  date: string;
}


export interface ReceiptRecord extends ReceiptData {
  _id: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class BackendService {
  constructor(private http: HttpClient) {}

  async saveReceipt(data: ReceiptData): Promise<ReceiptRecord> {
    const url = `${environment.backendUrl}/receipts`;
    console.log(`[BackendService] Sending POST to ${url}`, data);
    try {
      const res = await firstValueFrom(this.http.post<ReceiptRecord>(url, data));
      console.log('[BackendService] Save SUCCESS', res);
      return res;
    } catch (err: any) {
      console.error('[BackendService] Save FAILED', err);
      throw err;
    }
  }

  async getReceipts(userId: string): Promise<ReceiptRecord[]> {
    const url = `${environment.backendUrl}/receipts`;
    console.log(`[BackendService] Fetching history from ${url} for ${userId}`);
    try {
      const res = await firstValueFrom(this.http.get<ReceiptRecord[]>(url, { params: { userId } }));
      console.log(`[BackendService] History LOADED (${res.length} items)`);
      return res;
    } catch (err: any) {
      console.error('[BackendService] Load FAILED', err);
      throw err;
    }
  }


}
