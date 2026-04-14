# 植物战队网页模拟器

这是一个纯静态网页版本（HTML/CSS/JS），可直接部署到 GitHub Pages。

## 本地运行

直接双击 `index.html` 即可打开，或在 VS Code 里用 Live Server。

## 发布到 GitHub Pages

1. 新建 GitHub 仓库（例如 `plant-battle-web`）。
2. 上传本目录全部文件：
   - `index.html`
   - `style.css`
   - `app.js`
3. 进入仓库 `Settings -> Pages`。
4. `Build and deployment` 选择：
   - Source: `Deploy from a branch`
   - Branch: `main` / `root`
5. 保存后等待 1-2 分钟，访问生成的页面链接。

## 规则实现

- 双方各 3 个站位，面对面对战。
- 只有 `defender` 且在 `1号位` 时，才能拦截全队伤害。
- 伤害流程：闪避 -> 暴击 -> 防御减伤（最低 1 点）。
- 技能由 `skillCoef` 和 `skillCd` 控制。
