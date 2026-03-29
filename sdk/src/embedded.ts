import type {
  BrowserSession,
  CreateBrowserSessionParams,
  SigningIntent,
  SigningResult,
  SubmitSignatureParams,
} from './types.js';
import { throwFromResponse } from './errors.js';

export class EmbeddedAPI {
  constructor(
    private baseUrl: string,
    private headers: () => Record<string, string>,
  ) {}

  /**
   * Create a browser session token (server-side only).
   *
   * This token is short-lived and scoped to a single agreement.
   * Pass it to your frontend for the embedded signing flow.
   * Never expose your API key to the browser — use this instead.
   */
  async createBrowserSession(
    params: CreateBrowserSessionParams,
  ): Promise<BrowserSession> {
    const res = await fetch(`${this.baseUrl}/v1/auth/browser-session`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<BrowserSession>;
  }

  /**
   * Prepare a signing session (frontend — uses browser session token).
   *
   * Returns the filled document and an intent token to submit with the signature.
   *
   * @param agreementId - The agreement to sign
   * @param browserSessionToken - Token from createBrowserSession()
   */
  async createSigningIntent(
    agreementId: string,
    browserSessionToken: string,
  ): Promise<SigningIntent> {
    const res = await fetch(`${this.baseUrl}/v1/embed/signing-intent`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${browserSessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agreement_id: agreementId }),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<SigningIntent>;
  }

  /**
   * Submit a signature (frontend — uses browser session token).
   *
   * @param params - Signature submission parameters
   * @param browserSessionToken - Token from createBrowserSession()
   */
  async sign(
    params: SubmitSignatureParams,
    browserSessionToken: string,
  ): Promise<SigningResult> {
    const res = await fetch(`${this.baseUrl}/v1/embed/sign`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${browserSessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) await throwFromResponse(res);
    return res.json() as Promise<SigningResult>;
  }
}
