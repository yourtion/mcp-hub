/**
 * 认证系统实现
 * 支持Bearer Token、API Key、Basic Auth等认证方式
 */

import { createLogger } from '../../utils/logger.js';
import { OAuthStrategy } from './oauth-strategy.js';

import type { AuthConfig } from '../types/api-config.js';
import type { HttpRequestConfig } from '../types/http-client.js';
import type { CacheManager } from './cache-manager.js';
import type { HttpClient } from './http-client.js';

const logger = createLogger({ component: 'Authentication' });

/**
 * 认证策略接口
 */
export interface AuthenticationStrategy {
  /** 策略名称 */
  readonly name: string;

  /** 应用认证到HTTP请求 */
  applyAuth(request: HttpRequestConfig, config: AuthConfig): Promise<HttpRequestConfig>;

  /** 验证认证配置 */
  validateConfig(config: AuthConfig): Promise<{ valid: boolean; error?: string }>;
}

/**
 * Bearer Token认证策略
 */
export class BearerTokenStrategy implements AuthenticationStrategy {
  readonly name = 'bearer';

  async applyAuth(request: HttpRequestConfig, config: AuthConfig): Promise<HttpRequestConfig> {
    if (config.type !== 'bearer') {
      throw new Error('Bearer 策略收到非 bearer 配置');
    }
    if (!config.token) {
      throw new Error('Bearer token认证需要提供token');
    }

    const headers = { ...request.headers };
    headers.Authorization = `Bearer ${config.token}`;

    logger.debug('应用Bearer Token认证');

    return {
      ...request,
      headers,
    };
  }

  async validateConfig(config: AuthConfig): Promise<{ valid: boolean; error?: string }> {
    if (config.type !== 'bearer') {
      return { valid: false, error: '认证类型不匹配' };
    }

    if (!config.token) {
      return { valid: false, error: 'Bearer认证需要提供token' };
    }

    if (typeof config.token !== 'string') {
      return { valid: false, error: 'Token必须是字符串' };
    }

    if (config.token.trim() === '') {
      return { valid: false, error: 'Token必须是非空字符串' };
    }

    return { valid: true };
  }
}

/**
 * API Key认证策略
 */
export class ApiKeyStrategy implements AuthenticationStrategy {
  readonly name = 'apikey';

  async applyAuth(request: HttpRequestConfig, config: AuthConfig): Promise<HttpRequestConfig> {
    if (config.type !== 'apikey') {
      throw new Error('API Key 策略收到非 apikey 配置');
    }
    if (!config.token) {
      throw new Error('API Key认证需要提供token');
    }

    const headerName = config.header || 'X-API-Key';
    const headers = { ...request.headers };
    headers[headerName] = config.token;

    logger.debug(`应用API Key认证: ${headerName}`);

    return {
      ...request,
      headers,
    };
  }

  async validateConfig(config: AuthConfig): Promise<{ valid: boolean; error?: string }> {
    if (config.type !== 'apikey') {
      return { valid: false, error: '认证类型不匹配' };
    }

    if (!config.token) {
      return { valid: false, error: 'API Key认证需要提供token' };
    }

    if (typeof config.token !== 'string' || config.token.trim() === '') {
      return { valid: false, error: 'API Key必须是非空字符串' };
    }

    if (
      config.header !== undefined &&
      (typeof config.header !== 'string' || config.header.trim() === '')
    ) {
      return { valid: false, error: 'Header名称必须是非空字符串' };
    }

    return { valid: true };
  }
}

/**
 * Basic Auth认证策略
 */
export class BasicAuthStrategy implements AuthenticationStrategy {
  readonly name = 'basic';

  async applyAuth(request: HttpRequestConfig, config: AuthConfig): Promise<HttpRequestConfig> {
    if (config.type !== 'basic') {
      throw new Error('Basic 策略收到非 basic 配置');
    }
    if (!config.username || !config.password) {
      throw new Error('Basic认证需要提供用户名和密码');
    }

    const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    const headers = { ...request.headers };
    headers.Authorization = `Basic ${credentials}`;

    logger.debug(`应用Basic认证: ${config.username}`);

    return {
      ...request,
      headers,
    };
  }

  async validateConfig(config: AuthConfig): Promise<{ valid: boolean; error?: string }> {
    if (config.type !== 'basic') {
      return { valid: false, error: '认证类型不匹配' };
    }

    if (!config.username) {
      return { valid: false, error: 'Basic认证需要提供用户名' };
    }

    if (!config.password) {
      return { valid: false, error: 'Basic认证需要提供密码' };
    }

    if (typeof config.username !== 'string') {
      return { valid: false, error: '用户名必须是字符串' };
    }

    if (config.username.trim() === '') {
      return { valid: false, error: '用户名必须是非空字符串' };
    }

    if (typeof config.password !== 'string') {
      return { valid: false, error: '密码必须是字符串' };
    }

    if (config.password.trim() === '') {
      return { valid: false, error: '密码必须是非空字符串' };
    }

    return { valid: true };
  }
}

/**
 * AuthenticationManager 可选依赖
 * 注入 httpClient + cache 后会注册 OAuthStrategy
 */
export interface AuthenticationManagerDeps {
  httpClient?: HttpClient;
  cache?: CacheManager;
}

/**
 * 认证管理器
 * 管理不同的认证策略并应用到HTTP请求
 */
export class AuthenticationManager {
  private readonly strategies = new Map<string, AuthenticationStrategy>();

  constructor(deps?: AuthenticationManagerDeps) {
    // 注册默认认证策略
    this.registerStrategy(new BearerTokenStrategy());
    this.registerStrategy(new ApiKeyStrategy());
    this.registerStrategy(new BasicAuthStrategy());

    // 注入 deps 后注册 OAuth 策略
    if (deps?.httpClient && deps?.cache) {
      this.registerStrategy(new OAuthStrategy(deps.httpClient, deps.cache));
    }

    logger.info('认证管理器初始化完成', {
      context: { strategies: this.getSupportedTypes() },
    });
  }

  /**
   * 注册认证策略
   */
  registerStrategy(strategy: AuthenticationStrategy): void {
    this.strategies.set(strategy.name, strategy);
    logger.debug(`注册认证策略: ${strategy.name}`);
  }

  /**
   * 获取认证策略
   */
  getStrategy(type: string): AuthenticationStrategy | undefined {
    return this.strategies.get(type);
  }

  /**
   * 获取所有支持的认证类型
   */
  getSupportedTypes(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * 应用认证到HTTP请求
   */
  async applyAuthentication(
    request: HttpRequestConfig,
    authConfig: AuthConfig,
  ): Promise<HttpRequestConfig> {
    const strategy = this.strategies.get(authConfig.type);
    if (!strategy) {
      throw new Error(`不支持的认证类型: ${authConfig.type}`);
    }

    // 验证认证配置
    const validation = await strategy.validateConfig(authConfig);
    if (!validation.valid) {
      throw new Error(`认证配置无效: ${validation.error}`);
    }

    // 应用认证
    return strategy.applyAuth(request, authConfig);
  }

  /**
   * 验证认证配置
   */
  async validateAuthConfig(authConfig: AuthConfig): Promise<{
    valid: boolean;
    error?: string;
  }> {
    const strategy = this.strategies.get(authConfig.type);
    if (!strategy) {
      return { valid: false, error: `不支持的认证类型: ${authConfig.type}` };
    }

    return strategy.validateConfig(authConfig);
  }

  /**
   * 处理环境变量引用
   * 支持 {{env.VARIABLE_NAME}} 语法
   * 按认证类型解析相应字段（discriminated union 后需按 type 分支）
   */
  resolveEnvironmentVariables(authConfig: AuthConfig): AuthConfig {
    if (authConfig.type === 'bearer' || authConfig.type === 'apikey') {
      return {
        ...authConfig,
        token: authConfig.token ? this.resolveEnvVariable(authConfig.token) : authConfig.token,
        header: authConfig.header ? this.resolveEnvVariable(authConfig.header) : authConfig.header,
      };
    }
    if (authConfig.type === 'basic') {
      return {
        ...authConfig,
        username: this.resolveEnvVariable(authConfig.username),
        password: this.resolveEnvVariable(authConfig.password),
      };
    }
    // oauth
    return {
      ...authConfig,
      clientId: this.resolveEnvVariable(authConfig.clientId),
      clientSecret: this.resolveEnvVariable(authConfig.clientSecret),
      refreshToken: authConfig.refreshToken
        ? this.resolveEnvVariable(authConfig.refreshToken)
        : authConfig.refreshToken,
    };
  }

  /**
   * 解析单个环境变量引用
   */
  private resolveEnvVariable(value: string): string {
    // 匹配 {{env.VARIABLE_NAME}} 模式
    const envPattern = /\{\{env\.([A-Z_][A-Z0-9_]*)\}\}/g;

    return value.replace(envPattern, (match, varName) => {
      const envValue = process.env[varName];
      if (envValue === undefined) {
        logger.warn('环境变量未定义', {
          context: { varName, originalValue: match },
        });
        return match; // 保持原样
      }

      logger.debug('解析环境变量', {
        context: { varName, hasValue: !!envValue },
      });
      return envValue;
    });
  }

  /**
   * 检查认证配置中的环境变量是否都已定义
   * 按认证类型检查相应字段（discriminated union 后需按 type 分支）
   */
  validateEnvironmentVariables(authConfig: AuthConfig): {
    valid: boolean;
    missingVars: string[];
  } {
    const missingVars: string[] = [];
    const envPattern = /\{\{env\.([A-Z_][A-Z0-9_]*)\}\}/g;

    let fieldsToCheck: string[] = [];
    if (authConfig.type === 'bearer' || authConfig.type === 'apikey') {
      fieldsToCheck = [authConfig.token, authConfig.header].filter(Boolean) as string[];
    } else if (authConfig.type === 'basic') {
      fieldsToCheck = [authConfig.username, authConfig.password].filter(Boolean) as string[];
    } else if (authConfig.type === 'oauth') {
      fieldsToCheck = [
        authConfig.clientId,
        authConfig.clientSecret,
        authConfig.refreshToken,
      ].filter(Boolean) as string[];
    }

    for (const field of fieldsToCheck) {
      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: 需要在循环中执行正则匹配
      while ((match = envPattern.exec(field)) !== null) {
        const varName = match[1];
        if (process.env[varName] === undefined) {
          missingVars.push(varName);
        }
      }
    }

    return {
      valid: missingVars.length === 0,
      missingVars: [...new Set(missingVars)], // 去重
    };
  }
}

/**
 * 创建认证管理器实例
 */
export function createAuthenticationManager(): AuthenticationManager {
  return new AuthenticationManager();
}

/**
 * 默认认证管理器实例
 */
export const defaultAuthManager = createAuthenticationManager();

export { OAuthStrategy } from './oauth-strategy.js';
export type { CachedToken } from './oauth-strategy.js';
