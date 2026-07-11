/**
 * 认证服务
 */

import { AuthError, ErrorCode, ServiceError } from '@mcp-core/mcp-hub-core';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { getAllConfig } from '../utils/config.js';

import type { JwtPayload, LoginAttempt, RefreshTokenPayload, UserSession } from '../types/auth.js';
import type { DeepReadonly, SystemConfig } from '@mcp-core/mcp-hub-share';

// 从 SystemConfig 中提取用户凭据的只读类型
type ReadonlyUserCredentials = DeepReadonly<SystemConfig>['users'][string];

/**
 * 认证服务类
 */
export class AuthService {
  private config: DeepReadonly<SystemConfig> | null = null;
  private loginAttempts = new Map<string, LoginAttempt[]>();
  private sessions = new Map<string, UserSession>();
  private blacklistedTokens = new Set<string>();
  private passwordHashMap = new Map<string, string>();

  /**
   * 初始化认证服务
   */
  async initialize(): Promise<void> {
    // 如果已经初始化，跳过
    if (this.config) {
      return;
    }
    await this.loadConfig();
  }

  /**
   * 加载系统配置
   */
  private async loadConfig(): Promise<void> {
    try {
      // 使用配置工具函数获取配置
      const config = await getAllConfig();

      // 合并默认配置，确保缺少的字段有默认值
      const systemConfig = {
        ...AuthService.defaultSystemConfig,
        ...config.system,
      } as DeepReadonly<SystemConfig>;

      this.config = systemConfig;

      // 为所有用户生成密码哈希
      await this.generatePasswordHashes();
    } catch (error) {
      throw new Error(`Failed to load system config: ${error}`, { cause: error }); // 启动期配置加载错误，保持裸 Error
    }
  }

  /**
   * 默认系统配置
   */
  private static readonly defaultSystemConfig: SystemConfig = {
    server: {
      port: 8181,
      host: '0.0.0.0',
    },
    auth: {
      jwt: {
        secret: 'mcp-hub-default-jjwt-secret-key-change-in-production',
        expiresIn: '24h',
        refreshExpiresIn: '7d',
        issuer: 'mcp-hub',
      },
      security: {
        maxLoginAttempts: 5,
        lockoutDuration: 900000,
        passwordMinLength: 6,
        requireStrongPassword: false,
      },
    },
    users: {
      admin: {
        id: 'admin',
        username: 'admin',
        password: 'admin',
        role: 'admin',
        groups: ['default'],
        createdAt: new Date().toISOString(),
      },
    },
    monitoring: {
      metricsEnabled: true,
      logLevel: 'info',
      retentionDays: 30,
    },
    ui: {
      title: 'MCP Hub',
      theme: 'light',
      features: {
        apiToMcp: true,
        debugging: false,
        monitoring: true,
      },
    },
  };

  /**
   * 为所有用户生成密码哈希（仅在内存中）
   */
  private async generatePasswordHashes(): Promise<void> {
    if (!this.config) return;

    for (const [key, user] of Object.entries(this.config.users)) {
      const hash = await bcrypt.hash(user.password, 10);
      this.passwordHashMap.set(key, hash);
    }
  }

  /**
   * 用户登录
   */
  async login(
    username: string,
    password: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{
    user: { id: string; username: string; role: string };
    accessToken: string;
    refreshToken: string;
  }> {
    if (!this.config) {
      throw new ServiceError(ErrorCode.SERVICE_UNAVAILABLE, 'Auth service not initialized');
    }

    // 检查登录尝试限制
    if (this.isUserLocked(username)) {
      throw new AuthError(
        ErrorCode.AUTH_ACCOUNT_LOCKED,
        'Account temporarily locked due to too many failed attempts',
      );
    }

    // 查找用户
    const user = Object.values(this.config.users).find((u) => u.username === username);
    if (!user) {
      this.recordLoginAttempt(username, false, ip, userAgent);
      throw new AuthError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid username or password');
    }

    // 验证密码
    const userKey = Object.keys(this.config.users).find(
      (k) => this.config?.users[k].id === user.id,
    );
    const hash = userKey ? this.passwordHashMap.get(userKey) : undefined;
    if (!hash) {
      throw new AuthError(ErrorCode.AUTHENTICATION_FAILED, 'Password hash not found');
    }
    const isValidPassword = await bcrypt.compare(password, hash);
    if (!isValidPassword) {
      this.recordLoginAttempt(username, false, ip, userAgent);
      throw new AuthError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid username or password');
    }

    // 记录成功登录
    this.recordLoginAttempt(username, true, ip, userAgent);
    this.clearLoginAttempts(username);

    // 生成tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // 创建会话
    const sessionId = this.generateSessionId();
    const session: UserSession = {
      sessionId,
      userId: user.id,
      accessToken,
      refreshToken,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      ip,
      userAgent,
    };
    this.sessions.set(sessionId, session);

    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * 刷新访问token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    if (!this.config) {
      throw new ServiceError(ErrorCode.SERVICE_UNAVAILABLE, 'Auth service not initialized');
    }

    // 检查token是否在黑名单中
    if (this.blacklistedTokens.has(refreshToken)) {
      throw new AuthError(ErrorCode.AUTH_TOKEN_INVALID, 'Invalid refresh token');
    }

    try {
      // 验证刷新token
      const payload = jwt.verify(refreshToken, this.config.auth.jwt.secret) as RefreshTokenPayload;

      if (payload.type !== 'refresh') {
        throw new AuthError(ErrorCode.AUTH_TOKEN_INVALID, 'Invalid token type');
      }

      // 查找用户
      const user = Object.values(this.config.users).find((u) => u.id === payload.sub);
      if (!user) {
        throw new AuthError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'User not found');
      }

      // 生成新的tokens
      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      // 将旧的刷新token加入黑名单
      this.blacklistedTokens.add(refreshToken);

      // 更新会话
      const session = Array.from(this.sessions.values()).find(
        (s) => s.refreshToken === refreshToken,
      );
      if (session) {
        session.accessToken = newAccessToken;
        session.refreshToken = newRefreshToken;
        session.lastActivity = Date.now();
      }

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (_error) {
      throw new AuthError(ErrorCode.AUTH_TOKEN_INVALID, 'Invalid refresh token');
    }
  }

  /**
   * 用户登出
   */
  async logout(accessToken: string): Promise<void> {
    // 将token加入黑名单
    this.blacklistedTokens.add(accessToken);

    // 删除会话
    const session = Array.from(this.sessions.values()).find((s) => s.accessToken === accessToken);
    if (session) {
      this.sessions.delete(session.sessionId);
      this.blacklistedTokens.add(session.refreshToken);
    }
  }

  /**
   * 验证访问token
   */
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    if (!this.config) {
      throw new ServiceError(ErrorCode.SERVICE_UNAVAILABLE, 'Auth service not initialized');
    }

    // 检查token是否在黑名单中
    if (this.blacklistedTokens.has(token)) {
      throw new AuthError(ErrorCode.AUTH_TOKEN_INVALID, 'Token has been revoked');
    }

    try {
      const payload = jwt.verify(token, this.config.auth.jwt.secret) as JwtPayload;

      // 更新会话活动时间
      const session = Array.from(this.sessions.values()).find((s) => s.accessToken === token);
      if (session) {
        session.lastActivity = Date.now();
      }

      return payload;
    } catch (_error) {
      throw new AuthError(ErrorCode.AUTH_TOKEN_EXPIRED, 'Invalid or expired token');
    }
  }

  /**
   * 生成访问token
   */
  private generateAccessToken(user: ReadonlyUserCredentials): string {
    if (!this.config) {
      throw new ServiceError(ErrorCode.SERVICE_UNAVAILABLE, 'Auth service not initialized');
    }

    // 生成唯一的 JWT ID
    const jti = this.generateSessionId();

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      username: user.username,
      role: user.role,
      iss: this.config.auth.jwt.issuer,
      jti, // 添加唯一标识符
    };

    return jwt.sign(payload, this.config.auth.jwt.secret, {
      expiresIn: this.config.auth.jwt.expiresIn,
    } as jwt.SignOptions);
  }

  /**
   * 生成刷新token
   */
  private generateRefreshToken(user: ReadonlyUserCredentials): string {
    if (!this.config) {
      throw new ServiceError(ErrorCode.SERVICE_UNAVAILABLE, 'Auth service not initialized');
    }

    // 生成唯一的 JWT ID
    const jti = this.generateSessionId();

    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      sub: user.id,
      type: 'refresh',
      iss: this.config.auth.jwt.issuer,
      jti, // 添加唯一标识符
    };

    return jwt.sign(payload, this.config.auth.jwt.secret, {
      expiresIn: this.config.auth.jwt.refreshExpiresIn,
    } as jwt.SignOptions);
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * 记录登录尝试
   */
  private recordLoginAttempt(
    username: string,
    success: boolean,
    ip?: string,
    userAgent?: string,
  ): void {
    const attempt: LoginAttempt = {
      username,
      timestamp: Date.now(),
      success,
      ip,
      userAgent,
    };

    const attempts = this.loginAttempts.get(username) || [];
    attempts.push(attempt);

    // 只保留最近的尝试记录
    const maxAttempts = this.config?.auth.security.maxLoginAttempts || 5;
    if (attempts.length > maxAttempts * 2) {
      attempts.splice(0, attempts.length - maxAttempts);
    }

    this.loginAttempts.set(username, attempts);
  }

  /**
   * 检查用户是否被锁定
   */
  private isUserLocked(username: string): boolean {
    if (!this.config) return false;

    const attempts = this.loginAttempts.get(username) || [];
    const { maxLoginAttempts, lockoutDuration } = this.config.auth.security;
    const now = Date.now();

    // 获取最近的失败尝试
    const recentFailedAttempts = attempts.filter(
      (attempt) => !attempt.success && now - attempt.timestamp < lockoutDuration,
    );

    return recentFailedAttempts.length >= maxLoginAttempts;
  }

  /**
   * 清除登录尝试记录
   */
  private clearLoginAttempts(username: string): void {
    this.loginAttempts.delete(username);
  }

  /**
   * 清理过期会话和黑名单token
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const sessionTimeout = 24 * 60 * 60 * 1000; // 24小时

    // 清理过期会话
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > sessionTimeout) {
        this.sessions.delete(sessionId);
        this.blacklistedTokens.add(session.accessToken);
        this.blacklistedTokens.add(session.refreshToken);
      }
    }

    // 清理过期的登录尝试记录
    const lockoutDuration = this.config?.auth.security.lockoutDuration || 900000;
    for (const [username, attempts] of this.loginAttempts.entries()) {
      const validAttempts = attempts.filter(
        (attempt) => now - attempt.timestamp < lockoutDuration * 2,
      );
      if (validAttempts.length === 0) {
        this.loginAttempts.delete(username);
      } else {
        this.loginAttempts.set(username, validAttempts);
      }
    }
  }

  /**
   * 获取用户信息
   */
  getUserById(userId: string): ReadonlyUserCredentials | null {
    if (!this.config) return null;
    return Object.values(this.config.users).find((user) => user.id === userId) || null;
  }

  /**
   * 获取活跃会话数量
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * 获取用户的活跃会话
   */
  getUserSessions(userId: string): UserSession[] {
    return Array.from(this.sessions.values()).filter((session) => session.userId === userId);
  }
}
