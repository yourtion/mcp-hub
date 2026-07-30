// backend/src/services/upstream-change-fanout.unit.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { UpstreamChangeFanout } from './upstream-change-fanout.js';

describe('UpstreamChangeFanout', () => {
  it('serverId 变更 fan-out 到所有含该 server 的 group', async () => {
    const getGroupsForServer = vi.fn(() => [{ groupId: 'g1' }, { groupId: 'g2' }]);
    const refreshGroupTools = vi.fn().mockResolvedValue(undefined);
    const publishToolListChanged = vi.fn();
    const fanout = new UpstreamChangeFanout({
      getGroupsForServer,
      refreshGroupTools,
      publishToolListChanged,
      debounceMs: 0,
    });
    await fanout.handleServerChange('s1');
    await fanout.flush();
    expect(refreshGroupTools).toHaveBeenCalledWith('g1', 's1');
    expect(refreshGroupTools).toHaveBeenCalledWith('g2', 's1');
    expect(publishToolListChanged).toHaveBeenCalledWith('g1');
    expect(publishToolListChanged).toHaveBeenCalledWith('g2');
  });

  it('无 group 含该 server 时不 publish', async () => {
    const getGroupsForServer = vi.fn(() => []);
    const publishToolListChanged = vi.fn();
    const fanout = new UpstreamChangeFanout({
      getGroupsForServer,
      refreshGroupTools: vi.fn().mockResolvedValue(undefined),
      publishToolListChanged,
      debounceMs: 0,
    });
    await fanout.handleServerChange('s1');
    await fanout.flush();
    expect(publishToolListChanged).not.toHaveBeenCalled();
  });
});

describe('防抖', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounceMs 内多次变更合并为一次 fan-out', async () => {
    const getGroupsForServer = vi.fn(() => [{ groupId: 'g1' }]);
    const refreshGroupTools = vi.fn().mockResolvedValue(undefined);
    const fanout = new UpstreamChangeFanout({
      getGroupsForServer,
      refreshGroupTools,
      publishToolListChanged: vi.fn(),
      debounceMs: 500,
    });
    fanout.handleServerChange('s1');
    fanout.handleServerChange('s1');
    fanout.handleServerChange('s1');
    await vi.advanceTimersByTimeAsync(500);
    expect(refreshGroupTools).toHaveBeenCalledTimes(1);
  });
});
