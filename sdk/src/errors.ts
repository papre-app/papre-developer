import type { PapreErrorBody } from './types.js';

export class PapreError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(body: PapreErrorBody) {
    super(body.error.message);
    this.name = 'PapreError';
    this.code = body.error.code;
    this.status = body.error.status;
  }
}

/** Parse a fetch Response into a PapreError (or generic Error on unexpected format). */
export async function throwFromResponse(res: Response): Promise<never> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error(`Papre API returned ${res.status} with non-JSON body`);
  }
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as PapreErrorBody).error?.code === 'string'
  ) {
    throw new PapreError(body as PapreErrorBody);
  }
  throw new Error(`Papre API returned ${res.status}: ${JSON.stringify(body)}`);
}
