---
title: Headless WordPress：解耦架构与 API 化
description: Headless（无头）WordPress 把后台内容管理与前端展示彻底分离，用 REST/GraphQL 输出，前端可任选框架。讲清它适合什么、不适合什么。
f: framework
category: site-tech
order: 2
updated: "2026-11-12"
tags: [Headless, WordPress, API, 架构]
---

Headless WordPress 把"内容后台"和"展示前台"拆开：WordPress 只管写内容与存数据，前端用 [Astro / Vite / React](/framework/site-tech/frontend-frameworks/) 等任意框架渲染，通过 REST API 或 GraphQL 取数。

## 它解决什么

- **性能与体验**：前端走静态生成（SSG），首屏快、安全面小，轻松满足 [Core Web Vitals](/framework/performance/core-web-vitals/)。
- **多端复用**：同一份内容，官网、小程序、App 共用 API。
- **技术自由度**：前端不再被 PHP 主题束缚。

## 代价与边界

- **复杂度高**：需要自己管前端构建与[部署](/framework/hosting/)，团队要有工程能力。
- **插件红利减弱**：大量依赖主题渲染的插件（如页面构建器）在 Headless 下失效。
- **SEO 责任转移**：结构化数据、sitemap 要自己在前端实现（可参考 [GEO 优化](/future/geo/)）。

## 何时该上 Headless

当你的站点规模、性能要求或多端分发需求超过传统主题能承受的上限，且团队具备前端工程能力时，Headless 是合理演进。否则先用普通 [WordPress](/framework/site-tech/wordpress/) 更省心——这取决于 [Focus 战略定力](/focus/) 下的资源判断。
