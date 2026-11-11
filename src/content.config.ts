import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

// 5F 知识库：所有文章为 Markdown，路径即三级 URL
// src/content/guides/{f}/{category}/{slug}.md  →  /{f}/{category}/{slug}/
const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    f: z.enum(['framework', 'flow', 'figures', 'focus', 'future']),
    category: z.string(),
    order: z.number().default(99),
    updated: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
})

export const collections = { guides }
