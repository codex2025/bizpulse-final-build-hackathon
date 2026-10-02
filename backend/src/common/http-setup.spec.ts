import { allowedOrigins } from './http-setup';

describe('allowedOrigins', () => {
  it('allows every origin when nothing is configured (local development)', () => {
    expect(allowedOrigins('')).toBe('*');
    expect(allowedOrigins(undefined)).toBe('*');
  });
  it('reads a comma-separated list and drops trailing slashes', () => {
    expect(
      allowedOrigins('https://app.example.com/, http://localhost:5173'),
    ).toEqual(['https://app.example.com', 'http://localhost:5173']);
  });
});
