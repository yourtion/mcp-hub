// backend/src/services/upstream-change-fanout.ts
import type { Logger } from '../utils/logger.js';

export interface UpstreamChangeFanoutOptions {
  getGroupsForServer: (serverId: string) => { groupId: string }[];
  refreshGroupTools: (groupId: string, serverId: string) => Promise<void>;
  publishToolListChanged: (groupId: string) => void;
  debounceMs: number;
  logger?: Logger;
}

/**
 * 上游变更 fan-out：把 serverId 变更分发到所有含该 server 的 group。
 *
 * - 同一 serverId 在 debounceMs 内多次变更合并为一次 fan-out。
 * - fan-out 异常隔离：单个 group 失败不影响其他 group。
 */
export class UpstreamChangeFanout {
  private readonly opts: UpstreamChangeFanoutOptions;
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>(); // serverId → timer

  constructor(opts: UpstreamChangeFanoutOptions) {
    this.opts = opts;
  }

  handleServerChange(serverId: string): void {
    const existing = this.pending.get(serverId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.pending.delete(serverId);
      void this.fanout(serverId);
    }, this.opts.debounceMs);
    this.pending.set(serverId, timer);
  }

  private async fanout(serverId: string): Promise<void> {
    const groups = this.opts.getGroupsForServer(serverId);
    if (groups.length === 0) return;
    await Promise.all(
      groups.map(async (g) => {
        try {
          await this.opts.refreshGroupTools(g.groupId, serverId);
          this.opts.publishToolListChanged(g.groupId);
        } catch (err) {
          this.opts.logger?.warn('fan-out group 失败', { groupId: g.groupId, error: String(err) });
        }
      }),
    );
  }

  async flush(): Promise<void> {
    // test 用：立即触发所有 pending 并等待完成
    for (const [id, timer] of this.pending) {
      clearTimeout(timer);
      this.pending.delete(id);
      await this.fanout(id);
    }
  }
}
