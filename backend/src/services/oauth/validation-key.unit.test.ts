import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { encryptValidationKey } from '../../api/groups/crypto.js';

import { verifyValidationKey } from './validation-key.js';

describe('validation-key', () => {
  const origSecret = process.env.VALIDATION_KEY_SECRET;
  beforeAll(() => {
    process.env.VALIDATION_KEY_SECRET = 'a'.repeat(32) + 'extra-padding-for-safety';
  });
  afterAll(() => {
    if (origSecret !== undefined) process.env.VALIDATION_KEY_SECRET = origSecret;
    else delete process.env.VALIDATION_KEY_SECRET;
  });

  it('正确 key 通过', () => {
    const plain = 'mySecretKey123';
    const encrypted = encryptValidationKey(plain);
    expect(verifyValidationKey(plain, encrypted)).toBe(true);
  });

  it('错误 key 拒绝', () => {
    const plain = 'mySecretKey123';
    const encrypted = encryptValidationKey(plain);
    expect(verifyValidationKey('wrongKey456', encrypted)).toBe(false);
  });

  it('常量时间比较（不等长直接 false，不抛错）', () => {
    const encrypted = encryptValidationKey('mySecretKey123');
    expect(verifyValidationKey('short', encrypted)).toBe(false);
  });
});
