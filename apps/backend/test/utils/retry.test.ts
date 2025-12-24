import { retry } from '../../src/utils/retry';

describe('retry', () => {
  it('retries and returns the successful result', async () => {
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockResolvedValueOnce('ok');

    await expect(retry(fn, { label: 'unit', retries: 1, delayMs: 0 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exceeding retries', async () => {
    const fn = jest.fn<Promise<void>, []>().mockRejectedValue(new Error('always-fail'));

    await expect(retry(fn, { label: 'unit', retries: 2, delayMs: 0 })).rejects.toThrow('always-fail');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

