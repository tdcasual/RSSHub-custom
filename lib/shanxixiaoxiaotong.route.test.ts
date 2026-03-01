import { describe, expect, it } from 'vitest';

import app from '@/app';

describe('route /shanxixiaoxiaotong/notice', () => {
    it(
        'returns RSS feed with items',
        {
            timeout: 60000,
        },
        async () => {
            const response = await app.request('/shanxixiaoxiaotong/notice');
            expect(response.status).toBe(200);

            const xml = await response.text();
            expect(xml).toContain('<item>');
        }
    );
});
