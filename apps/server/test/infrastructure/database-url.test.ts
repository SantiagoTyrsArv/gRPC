import { describe, expect, it } from 'vitest';
import { normalizeDatabaseUrl } from '../../src/infrastructure/db/client.js';

describe('normalizeDatabaseUrl', () => {
  it('quita channel_binding (Neon) y conserva sslmode', () => {
    const url = normalizeDatabaseUrl(
      'postgresql://u:p@ep-x.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    );
    expect(url).toBe('postgresql://u:p@ep-x.us-west-2.aws.neon.tech/neondb?sslmode=require');
  });

  it('deja intactas las URL sin channel_binding', () => {
    const url = 'postgres://typerace:typerace@localhost:5433/typerace';
    expect(normalizeDatabaseUrl(url)).toBe(url);
  });
});
