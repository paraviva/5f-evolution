// 5F 三级类目中央定义 —— 导航、面包屑、柱页/类目页/文章页全部从此驱动
export type FPillarSlug = 'framework' | 'flow' | 'figures' | 'focus' | 'future'

export interface FCategory {
  slug: string
  name: string
  blurb: string
}
export interface FPillar {
  slug: FPillarSlug
  name: string
  cn: string
  tagline: string
  blurb: string
  categories: FCategory[]
}

export const PILLARS: FPillar[] = [
  {
    slug: 'framework',
    name: 'Framework',
    cn: '全球营销“渔网”架构',
    tagline: '技术基座 · 触点网络',
    blurb: '不只是建站，而是织网。从建站技术、服务器到性能体验，把孤立触点连成覆盖全球的精准获客渔网。',
    categories: [
      { slug: 'site-tech', name: '建站技术', blurb: 'CMS、前端框架(Astro·Vite·React·Next·Vue)与可视化建站选型' },
      { slug: 'hosting', name: '服务器与部署', blurb: '服务器、CDN、域名与 Vercel / Cloudflare 部署' },
      { slug: 'performance', name: '性能与体验', blurb: 'Core Web Vitals、图片与渲染模式' },
    ],
  },
  {
    slug: 'flow',
    name: 'Flow',
    cn: '可持续的线上获客逻辑',
    tagline: '流量获取',
    blurb: '尊重客观规律，拒绝盲目投入。用 SEO、内容与社媒把流量变成可复制的长期获客闭环。',
    categories: [
      { slug: 'seo', name: '搜索引擎优化', blurb: 'On-page / Off-page / 技术 SEO / 关键词' },
      { slug: 'content', name: '内容营销', blurb: '博客知识库、产品页与内链建设' },
      { slug: 'social', name: '社媒获客', blurb: 'LinkedIn、Facebook/X、YouTube 引流' },
      { slug: 'paid', name: '付费流量', blurb: 'Google Ads 与再营销' },
    ],
  },
  {
    slug: 'figures',
    name: 'Figures',
    cn: '数据资产的规范化归档',
    tagline: '数据 · 衡量',
    blurb: '统一口径，沉淀数字化资产。从分析工具到指标报表，让每一条数据成为可传承的企业资产。',
    categories: [
      { slug: 'analytics', name: '分析工具', blurb: 'GSC、GA4 与行为分析（GSC 在前，GA4 在后）' },
      { slug: 'metrics', name: '指标与报表', blurb: '核心 KPI、归因与归档规范' },
      { slug: 'experiment', name: '实验与优化', blurb: 'A/B 测试与转化率优化' },
    ],
  },
  {
    slug: 'focus',
    name: 'Focus',
    cn: '战略定力与专注执行',
    tagline: '战略',
    blurb: '数字营销最忌三心二意。保持定力、专注细分赛道，不被市场杂音干扰，直到结果发生。',
    categories: [
      { slug: 'positioning', name: '定位与细分', blurb: '目标市场、细分赛道与竞品分析' },
      { slug: 'brand', name: '品牌与信任', blurb: '案例证言与品牌叙事' },
      { slug: 'discipline', name: '长期主义', blurb: '内容日历与执行节奏' },
    ],
  },
  {
    slug: 'future',
    name: 'Future',
    cn: 'AI 驱动的决策大脑',
    tagline: 'AI · GEO',
    blurb: '背靠谷歌，SEO 的规则制定者，GEO 的基础是 SEO。对齐底层算法，用 AI 在生成式搜索时代降维打击。',
    categories: [
      { slug: 'geo', name: 'GEO 生成式引擎优化', blurb: 'AI 搜索原理、结构化数据与 LLM 友好内容' },
      { slug: 'ai-content', name: 'AI 内容生产', blurb: 'AI 写作工作流与多语言生成' },
      { slug: 'ai-intel', name: 'AI 决策情报', blurb: '竞品情报与趋势预测' },
    ],
  },
]

export function getPillar(slug: string): FPillar | undefined {
  return PILLARS.find((p) => p.slug === slug)
}
export function getCategory(pillarSlug: string, categorySlug: string): FCategory | undefined {
  return getPillar(pillarSlug)?.categories.find((c) => c.slug === categorySlug)
}
