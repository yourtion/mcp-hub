/**
 * 认证相关的类型定义
 */

/**
 * JWT配置
 */
export interface JwtConfig {
  /** JWT密钥 */
  secret: string;
  /** 访问token过期时间 */
  expiresIn: string;
  /** 刷新token过期时间 */
  refreshExpiresIn: string;
  /** 签发者 */
  issuer: string;
}

/**
 * 用户凭据
 */
export interface UserCredentials {
  /** 用户ID */
  id: string;
  /** 用户名 */
  username: string;
  /** 明文密码（仅用于配置） */
  password: string;
  /** 密码哈希 */
  passwordHash: string;
  /** 用户角色 */
  role: string;
  /** 用户所属组 */
  groups: string[];
  /** 创建时间 */
  createdAt: string;
  /** 最后登录时间 */
  lastLogin?: string;
}

/**
 * 安全配置
 */
export interface SecurityConfig {
  /** 最大登录尝试次数 */
  maxLoginAttempts: number;
  /** 锁定持续时间（毫秒） */
  lockoutDuration: number;
  /** 密码最小长度 */
  passwordMinLength: number;
  /** 是否要求强密码 */
  requireStrongPassword: boolean;
}

/**
 * 系统配置
 */
export interface SystemConfig {
  /** 服务器配置 */
  server: {
    port: number;
    host: string;
  };
  /** 认证配置 */
  auth: {
    jwt: JwtConfig;
    security: SecurityConfig;
  };
  /** 用户配置 */
  users: Record<string, UserCredentials>;
  /** UI配置 */
  ui: {
    title: string;
    theme: string;
    features: {
      apiToMcp: boolean;
      debugging: boolean;
      monitoring: boolean;
    };
  };
  /** 监控配置 */
  monitoring: {
    metricsEnabled: boolean;
    logLevel: string;
    retentionDays: number;
  };
}

/**
 * JWT载荷
 */
export interface JwtPayload {
  /** 用户ID */
  sub: string;
  /** 用户名 */
  username: string;
  /** 用户角色 */
  role: string;
  /** 签发时间 */
  iat: number;
  /** 过期时间 */
  exp: number;
  /** 签发者 */
  iss: string;
}

/**
 * 刷新token载荷
 */
export interface RefreshTokenPayload {
  /** 用户ID */
  sub: string;
  /** token类型 */
  type: 'refresh';
  /** 签发时间 */
  iat: number;
  /** 过期时间 */
  exp: number;
  /** 签发者 */
  iss: string;
}

/**
 * 登录尝试记录
 */
export interface LoginAttempt {
  /** 用户名 */
  username: string;
  /** 尝试时间 */
  timestamp: number;
  /** 是否成功 */
  success: boolean;
  /** IP地址 */
  ip?: string;
  /** 用户代理 */
  userAgent?: string;
}

/**
 * 用户会话
 */
export interface UserSession {
  /** 会话ID */
  sessionId: string;
  /** 用户ID */
  userId: string;
  /** 访问token */
  accessToken: string;
  /** 刷新token */
  refreshToken: string;
  /** 创建时间 */
  createdAt: number;
  /** 最后活动时间 */
  lastActivity: number;
  /** IP地址 */
  ip?: string;
  /** 用户代理 */
  userAgent?: string;
}

/**
 * 认证中间件上下文
 */
export interface AuthContext {
  /** 当前用户 */
  user: {
    id: string;
    username: string;
    role: string;
  };
  /** JWT载荷 */
  payload: JwtPayload;
}
