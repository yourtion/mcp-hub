/**
 * 认证服务
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type {
  JwtPayload,
  LoginAttempt,
  RefreshTokenPayload,
  SystemConfig,
  UserCredentials,
  UserSession,
} from '../types/auth.js';

/**
 * 认证服务类
 */
export class AuthService {
  private config: SystemConfig | null = null;
  private loginAttempts = new Map<string, LoginAttempt[]>();
  private sessions = new Map<string, UserSession>();
  private blacklistedTokens = new Set<string>();

  /**
   * 初始化认证服务
   */
  async initialize(): Promise<void> {
    await this.loadConfig();
  }

  /**
   * 加载系统配置
   */
  private async loadConfig(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), 'config', 'system.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      this.config = JSON.parse(configData) as SystemConfig;

      // 确保所有用户都有密码哈希
      await this.ensurePasswordHashes();
    } catch (error) {
      throw new Error(`Failed to load system config: ${error}`);
    }
  }

  /**
   * 确保所有用户都有密码哈希
   */
  private async ensurePasswordHashes(): Promise<void> {
    if (!this.config) return;

    let configChanged = false;
    for (const [username, user] of Object.entries(this.config.users)) {
      if (!user.passwordHash && user.password) {
        user.passwordHash = await bcrypt.hash(user.password, 10);
        configChanged = true;
      }
    }

    // 如果配置有变化，保存回文件
    if (configChanged) {
      await this.saveConfig();
    }
  }

  /**
   * 保存配置到文件
   */
  private async saveConfig(): Promise<void> {
    if (!this.config) return;

    try {
      const configPath = path.join(process.cwd(), 'config', 'system.json');
      const configData = JSON.stringify(this.config, null, 2);
      await fs.writeFile(configPath, configData, 'utf-8');
    } catch (error) {
      console.error('Failed to save system config:', error);
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
      throw new Error('Auth service not initialized');
    }

    // 检查登录尝试限制
    if (this.isUserLocked(username)) {
      throw new Error(
        'Account temporarily locked due to too many failed attempts',
      );
    }

    // 查找用户
    const user = Object.values(this.config.users).find(
      (u) => u.username === username,
    );
    if (!user) {
      this.recordLoginAttempt(username, false, ip, userAgent);
      throw new Error('Invalid username or password');
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      this.recordLoginAttempt(username, false, ip, userAgent);
      throw new Error('Invalid username or password');
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

    // 更新用户最后登录时间
    user.lastLogin = new Date().toISOString();
    await this.saveConfig();

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
      throw new Error('Auth service not initialized');
    }

    // 检查token是否在黑名单中
    if (this.blacklistedTokens.has(refreshToken)) {
      throw new Error('Invalid refresh token');
    }

    try {
      // 验证刷新token
      const payload = jwt.verify(
        refreshToken,
        this.config.auth.jwt.secret,
      ) as RefreshTokenPayload;

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // 查找用户
      const user = Object.values(this.config.users).find(
        (u) => u.id === payload.sub,
      );
      if (!user) {
        throw new Error('User not found');
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
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * 用户登出
   */
  async logout(accessToken: string): Promise<void> {
    // 将token加入黑名单
    this.blacklistedTokens.add(accessToken);

    // 删除会话
    const session = Array.from(this.sessions.values()).find(
      (s) => s.accessToken === accessToken,
    );
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
      throw new Error('Auth service not initialized');
    }

    // 检查token是否在黑名单中
    if (this.blacklistedTokens.has(token)) {
      throw new Error('Token has been revoked');
    }

    try {
      const payload = jwt.verify(
        token,
        this.config.auth.jwt.secret,
      ) as JwtPayload;

      // 更新会话活动时间
      const session = Array.from(this.sessions.values()).find(
        (s) => s.accessToken === token,
      );
      if (session) {
        session.lastActivity = Date.now();
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * 生成访问token
   */
  private generateAccessToken(user: UserCredentials): string {
    if (!this.config) {
      throw new Error('Auth service not initialized');
    }

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      username: user.username,
      role: user.role,
      iss: this.config.auth.jwt.issuer,
    };

    return jwt.sign(payload, this.config.auth.jwt.secret, {
      expiresIn: this.config.auth.jwt.expiresIn,
    } as jwt.SignOptions);
  }

  /**
   * 生成刷新token
   */
  private generateRefreshToken(user: UserCredentials): string {
    if (!this.config) {
      throw new Error('Auth service not initialized');
    }

    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      sub: user.id,
      type: 'refresh',
      iss: this.config.auth.jwt.issuer,
    };

    return jwt.sign(payload, this.config.auth.jwt.secret, {
      expiresIn: this.config.auth.jwt.refreshExpiresIn,
    } as jwt.SignOptions);
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      (attempt) =>
        !attempt.success && now - attempt.timestamp < lockoutDuration,
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
    const lockoutDuration =
      this.config?.auth.security.lockoutDuration || 900000;
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
  getUserById(userId: string): UserCredentials | null {
    if (!this.config) return null;
    return (
      Object.values(this.config.users).find((user) => user.id === userId) ||
      null
    );
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
    return Array.from(this.sessions.values()).filter(
      (session) => session.userId === userId,
    );
  }
}
