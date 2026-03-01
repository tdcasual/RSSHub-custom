import type { Cheerio, CheerioAPI } from 'cheerio';
import { load } from 'cheerio';
import type { Element } from 'domhandler';
import pMap from 'p-map';

import { config } from '@/config';
import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

const rootUrl = 'https://shanxi.xiaoxiaotong.org';
const listPath = '/news/noticeIndex.aspx';

function resolveUrl(url: string | undefined, base: string): string | undefined {
    if (!url) {
        return;
    }

    try {
        return new URL(url, base).href;
    } catch {
        return url;
    }
}

function makeLinksAbsolute($: CheerioAPI, element: Cheerio<Element>, base: string) {
    element.find('a[href]').each((_, a) => {
        const href = $(a).attr('href');
        const resolvedHref = resolveUrl(href, base);
        if (resolvedHref) {
            $(a).attr('href', resolvedHref);
        }
    });

    element.find('img[src]').each((_, img) => {
        const src = $(img).attr('src');
        const resolvedSrc = resolveUrl(src, base);
        if (resolvedSrc) {
            $(img).attr('src', resolvedSrc);
        }
    });
}

function parseListDate(dateText: string): Date | undefined {
    if (!dateText) {
        return;
    }

    return timezone(parseDate(dateText, 'YYYY-MM-DD'), +8);
}

function parseDetailMeta($: CheerioAPI): { pubDate?: Date; author?: string } {
    const pubDateText = $('.title-addon .lef span')
        .filter((_, span) => $(span).text().includes('本文发布于：'))
        .first()
        .find('i')
        .first()
        .text()
        .trim();

    const author = $('.title-addon .lef span')
        .filter((_, span) => $(span).text().includes('来源：'))
        .first()
        .find('i')
        .first()
        .text()
        .trim();

    return {
        pubDate: pubDateText ? timezone(parseDate(pubDateText, 'YYYY-MM-DD'), +8) : undefined,
        author: author || undefined,
    };
}

async function fetchItem(item: DataItem, referer: string): Promise<DataItem> {
    if (!item.link) {
        return item;
    }

    return await cache.tryGet(item.link, async () => {
        try {
            const { data: response } = await got(item.link as string, {
                headers: {
                    Referer: referer,
                    'User-Agent': config.trueUA,
                },
                timeout: config.requestTimeout,
            });

            const $ = load(response);
            const title = $('.article-detail .title-box h3').first().text().trim();
            const content = $('.article-detail-in').first();
            const { pubDate, author } = parseDetailMeta($);

            if (title) {
                item.title = title;
            }
            item.pubDate = pubDate || item.pubDate;
            item.author = author || item.author;

            const category = $('.article-detail-addon .val')
                .toArray()
                .map((element) => $(element).text().trim())
                .filter(Boolean);
            if (category.length) {
                item.category = category;
            }

            if (content.length) {
                content.find('script').remove();
                content.find('style').remove();
                makeLinksAbsolute($, content, item.link as string);
                item.description = content.html() ?? item.description;
            }

            return item;
        } catch {
            return item;
        }
    });
}

export const route: Route = {
    path: '/notice',
    categories: ['government'],
    example: '/shanxixiaoxiaotong/notice',
    radar: [
        {
            source: ['shanxi.xiaoxiaotong.org/news/noticeIndex.aspx'],
            target: '/notice',
        },
    ],
    name: '文件通知',
    maintainers: ['tdcasual'],
    handler,
    url: 'shanxi.xiaoxiaotong.org/news/noticeIndex.aspx',
    description: '山西青少年科技教育和科普活动服务平台「文件通知」列表（仅抓取首页）。',
};

async function handler(ctx) {
    const limitFromQuery = Number.parseInt(ctx.req.query('limit') ?? '', 10);
    const limit = Number.isFinite(limitFromQuery) && limitFromQuery > 0 ? limitFromQuery : 30;

    const listUrl = new URL(listPath, rootUrl).href;
    const { data: response } = await got(listUrl, {
        headers: {
            'User-Agent': config.trueUA,
        },
        timeout: config.requestTimeout,
    });

    const $ = load(response);
    const items = $('.col-list ul.ellipsis > li')
        .slice(0, limit)
        .toArray()
        .map((element) => {
            const li = $(element);
            const a = li.find('a[href]').first();
            const link = resolveUrl(a.attr('href'), rootUrl);
            if (!link) {
                return null;
            }

            const dateText = li.find('span.dataTime').first().text().trim();

            return {
                title: a.text().trim(),
                link,
                pubDate: parseListDate(dateText),
            };
        })
        .filter((item): item is DataItem => item !== null);

    const fullItems = await pMap(items, (item) => fetchItem(item, listUrl), { concurrency: 2 });

    return {
        title: '山西青少年科技教育和科普活动服务平台 - 文件通知',
        link: listUrl,
        item: fullItems,
    };
}
