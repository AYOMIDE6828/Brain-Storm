/**
 * Issue #1279: Freighter detection lives in a typed hook, not in UI components.
 */

import fs from 'fs';
import path from 'path';

import { describe, it, expect, vi, beforeEach } from 'vitest';

const freighterMock = vi.hoisted(() => ({
  isConnected: vi.fn(),
  getPublicKey: vi.fn(),
  signMessage: vi.fn(),
}));

vi.mock('@stellar/freighter-api', () => freighterMock);

// The hook is a memoised factory; run it without a React renderer.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useMemo: (factory: () => unknown) => factory(),
}));

import { useFreighterDetection } from '@/hooks/useFreighterDetection';

describe('useFreighterDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports available when Freighter is connected', async () => {
    freighterMock.isConnected.mockResolvedValue({ isConnected: true });
    const api = useFreighterDetection();

    await expect(api.detectFreighter()).resolves.toEqual({ status: 'available' });
  });

  it('reports missing when Freighter is not connected', async () => {
    freighterMock.isConnected.mockResolvedValue({ isConnected: false });
    const api = useFreighterDetection();

    await expect(api.detectFreighter()).resolves.toEqual({ status: 'missing' });
  });

  it('reports missing instead of throwing when the extension call fails', async () => {
    freighterMock.isConnected.mockRejectedValue(new Error('no extension'));
    const api = useFreighterDetection();

    await expect(api.detectFreighter()).resolves.toEqual({ status: 'missing' });
  });

  it('returns the public key from Freighter', async () => {
    freighterMock.getPublicKey.mockResolvedValue({ publicKey: 'GABC' });
    const api = useFreighterDetection();

    await expect(api.getPublicKey()).resolves.toBe('GABC');
  });

  it('rejects when Freighter reports an error for the public key', async () => {
    freighterMock.getPublicKey.mockResolvedValue({ publicKey: '', error: 'locked' });
    const api = useFreighterDetection();

    await expect(api.getPublicKey()).rejects.toThrow('locked');
  });

  it('signs a message with the given address', async () => {
    freighterMock.signMessage.mockResolvedValue({ signedMessage: 'sig' });
    const api = useFreighterDetection();

    await expect(api.signMessage('challenge', 'GABC')).resolves.toBe('sig');
    expect(freighterMock.signMessage).toHaveBeenCalledWith('challenge', { address: 'GABC' });
  });
});

describe('Wallet UI stays presentational - Issue #1279', () => {
  const profileFiles = [
    path.resolve(__dirname, '../../app/profile/WalletSection.tsx'),
    path.resolve(__dirname, '../../app/[locale]/profile/WalletSection.tsx'),
  ];

  it.each(profileFiles)('%s does not import the Freighter SDK directly', (file) => {
    const content = fs.readFileSync(file, 'utf-8');

    expect(content).not.toMatch(/@stellar\/freighter-api/);
    expect(content).toMatch(/useFreighterDetection/);
  });
});
