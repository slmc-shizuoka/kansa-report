# 監査不適合改善報告 入力アプリ

プランナーごとに改善報告内容を入力し、選択したプランナーだけをExcel形式でエクスポートするローカル/Cloudflare Pages対応アプリです。SmartHRから印刷した監査結果PDFと従来のExcel監査結果をインポートできます。

## ローカル起動

```bash
npm install
npm start
```

起動後、`http://127.0.0.1:4173/` を開きます。

## Cloudflare Pages

- Framework preset: None
- Build command: `npm run check`
- Build output directory: `public`
- Functions directory: `functions`
- Deploy commandを入力する画面の場合: `npm run deploy`

PagesのGit連携画面にDeploy command欄がない場合は、Cloudflareが自動でデプロイするため設定不要です。`npx wrangler deploy`はWorker用なので、このPagesプロジェクトでは使用しません。

`/api/meta` と `/api/export` は Cloudflare Pages Functions で動きます。

## データ保存

入力ログと定型文はブラウザの `localStorage` に保存されます。GitHubやCloudflare側には保存されません。
