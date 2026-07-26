/**
 * 内置 AS 的 RSA 签名密钥管理
 *
 * 从 `OAUTH_INTERNAL_PRIVATE_KEY`（PKCS8 PEM 字符串，或指向此类文件的路径）加载；
 * 未配置时生成临时 RSA 密钥对并 warn（仅开发用途，重启后所有已签发 token 失效）。
 * 生产部署必须配置此环境变量。
 *
 * 模块级缓存：进程生命周期内只加载/生成一次。
 *
 * 实现说明（偏离 brief 原方案）：
 * brief Step 4 的 `exportSPKIFromPKCS8` 用 `createPublicKey({ key: pem, format: 'pem', type: 'pkcs8' })`
 * 直接从 PKCS8 私钥 PEM 推导公钥——但 Node.js 的 `createPublicKey` 在 `type: 'pkcs8'` 时期望公钥输入，
 * 对私钥 PEM 会抛错。改为：
 * 1. `createPrivateKey(pem)` 得到 Node KeyObject（私钥）
 * 2. `createPublicKey(privateKeyObj)` 从私钥对象派生公钥（Node 支持）
 * 3. `exportJWK(publicKeyObj)` 导出公钥 JWK
 * 4. 私钥直接以 KeyObject 传给 jose SignJWT.sign()（jose 接受 CryptoKey | KeyObject | Uint8Array）
 */
import { createPrivateKey, createPublicKey, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { exportJWK, generateKeyPair } from 'jose';

import type { JWK } from 'jose';
import type { KeyObject } from 'node:crypto';

import { logger } from '../../utils/logger.js';

/** jose SignJWT.sign() 接受的密钥输入类型 */
export type SigningKeyMaterial = KeyObject | CryptoKey | Uint8Array;

interface SigningKey {
  /** 用于 jose SignJWT.sign() 的私钥（KeyObject / CryptoKey） */
  privateKey: SigningKeyMaterial;
  /** 暴露给 JWKS endpoint 的公钥 JWK（含 kid/alg） */
  publicKeyJwk: JWK;
  /** key id */
  kid: string;
}

let cachedKey: SigningKey | null = null;

/**
 * 从 `OAUTH_INTERNAL_PRIVATE_KEY` 解析 PEM 字符串。
 * - 未配置：返回 null
 * - 值以 `/` 或 `./` 开头且对应文件存在：读取文件内容
 * - 否则：当作内联 PEM 字符串原样返回
 */
function resolvePemFromEnv(): string | null {
  const raw = process.env.OAUTH_INTERNAL_PRIVATE_KEY;
  if (!raw) return null;
  if (/^\.?\//.test(raw)) {
    if (existsSync(raw)) {
      return readFileSync(raw, 'utf8');
    }
    // 看似路径但文件不存在，当作内联 PEM（容错）
    return raw;
  }
  return raw;
}

export async function loadOrCreateSigningKey(): Promise<SigningKey> {
  if (cachedKey) return cachedKey;

  const kid = randomBytes(8).toString('hex');
  let privateKey: SigningKeyMaterial;
  let publicKeyJwk: JWK;

  const pem = resolvePemFromEnv();
  if (pem) {
    // PEM 路径：从 PKCS8 私钥 PEM 加载，派生公钥
    const privateKeyObj = createPrivateKey(pem);
    const publicKeyObj = createPublicKey(privateKeyObj);
    privateKey = privateKeyObj;
    publicKeyJwk = await exportJWK(publicKeyObj);
    publicKeyJwk.kid = kid;
    publicKeyJwk.alg = 'RS256';
  } else {
    // 未配置：生成临时密钥对并 warn
    logger.warn(
      'OAUTH_INTERNAL_PRIVATE_KEY 未配置，生成临时 RSA 密钥对。仅开发用途，重启后所有已签发 token 失效。生产部署必须配置此环境变量。',
    );
    const { publicKey, privateKey: priv } = await generateKeyPair('RS256');
    privateKey = priv;
    publicKeyJwk = await exportJWK(publicKey);
    publicKeyJwk.kid = kid;
    publicKeyJwk.alg = 'RS256';
  }

  cachedKey = { privateKey, publicKeyJwk, kid };
  return cachedKey;
}

export function getInternalPublicKeySet(): JWK[] {
  if (!cachedKey) return [];
  return [{ ...cachedKey.publicKeyJwk, kid: cachedKey.kid, alg: 'RS256' }];
}

/** 测试用：重置模块缓存 */
export function _resetForTesting(): void {
  cachedKey = null;
}
