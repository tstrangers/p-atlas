# 替换收藏数据

网页只读取 `dist/data.js`：

```js
window.ATLAS_DATA = {
  nodes: [{
    id: 0, number: 1, imageId: '0001',
    p: ['your-profile'], sourceP: ['your-profile'],
    prompt: 'A floating garden in blue light',
    parameters: ['--ar 3:4', '--stylize 200'],
    width: 1080, height: 1440, duplicateCount: 0
  }],
  edges: [],
  stats: {
    original: 1, nodes: 1, profiles: 1, duplicates: 0,
    missing: 0, mode: 'combination'
  }
};
```

图片路径为 `dist/assets/images/0001.webp`，缩略图为 `dist/assets/thumbs/0001.webp`。`imageId` 可以保留原收藏编号；`id` 应等于它在 nodes 数组中的位置。`p` 只放 P 值本身，其他参数不要重复写入 `--p`。

`edges` 中的 `[0, 1]` 指 nodes 数组索引，只有两张图片确实共享 P 值才建立连线。P 组合先去重再排序；相同整组只保留一张代表图，不同组合保留，空 P 不合并。`stats.profiles` 是不同 P 值的并集大小。

## 从原始导出制作

`prepare.mjs --source <目录>` 读取：

- `清单.json`：数组，字段为 number、pageUrl、image（相对于目录的原图路径）、width、height。
- `提取.json`：等长数组，字段为 url（对应 pageUrl）、prompt、parameters（完整参数字符串数组）。

例如 parameters 为 `["--p example123", "--ar 3:4"]`。工具核对页面 URL、按 P 组合去重、生成 WebP 及关联边。原图最长边不超过 1600 像素，缩略图为 160×160。它不是爬虫，也不会访问 Midjourney。

```bash
npm install
node prepare.mjs --source ../my-collection
node check-data.mjs
```

生成会更新 data.js 与同名 WebP 文件，请先备份自己的数据。网页不需要原始清单和提取文件；无需将它们推送到仓库。公开版生成的数据不会包含原页面或原图远程地址。
