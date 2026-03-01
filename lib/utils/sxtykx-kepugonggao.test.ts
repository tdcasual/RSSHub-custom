import { describe, expect, it } from 'vitest';

import { extractArticleMeta } from '@/routes/sxtykx/kepugonggao';
import { parseDate } from '@/utils/parse-date';

describe('extractArticleMeta', () => {
    it('extracts author from article metadata text', () => {
        const meta = extractArticleMeta('2026-02-12  来源：太原科协 ');

        expect(meta.author).toBe('太原科协');
    });

    it('extracts pubDate with time from article metadata text', () => {
        const meta = extractArticleMeta('2026-02-12 16:30:15  来源：太原科协');

        expect(meta.pubDate?.toISOString()).toBe(parseDate('2026-02-12 16:30:15').toISOString());
    });
});
