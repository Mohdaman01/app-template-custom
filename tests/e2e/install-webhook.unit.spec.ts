import { test, expect } from '@playwright/test';
import { processInstallEvent } from '@/app/api/webhooks/v1/install/route';

// A tiny mock supabase client that records calls to .from(...).upsert(...)
function createMockSupabase() {
  const calls: any[] = [];

  const from = (tableName: string) => {
    return {
      upsert: (payload: any, opts?: any) => {
        calls.push({ tableName, payload, opts });
        // simulate success
        return {
          select: () => ({ data: [{ id: 1, ...payload }], error: null }),
        };
      },
    };
  };

  return { from, __calls: calls };
}

test('processInstallEvent upserts a dashboard rule', async () => {
  const mock = createMockSupabase();

  const input = {
    eventType: 'app_installed',
    instanceId: 'inst_12345',
    payload: { siteId: 'site_1', owner: 'owner@example.com' },
  };

  const result = await processInstallEvent(input, mock as any);

  expect(result.ok).toBe(true);
  expect(result.data).toBeDefined();
  expect(Array.isArray(result.data)).toBe(true);
  // ensure mock recorded the call
  expect(mock.__calls.length).toBe(1);
  const call = mock.__calls[0];
  expect(call.tableName).toBe('Dashboard Rules');
  expect(call.payload.instance_id).toBe('inst_12345');
  expect(call.payload.event_type).toBe('app_installed');
});
