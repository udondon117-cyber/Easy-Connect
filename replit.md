# CaptionBridge (キャプションブリッジ)

## アプリ概要

誰でも直感的に使える究極にシンプルなリアルタイム字幕アプリ。そのシンプルさが、結果として高齢者や難聴者の大きな助けになります。音声をリアルタイムで認識して日本語字幕を表示します。

## スタック

- **フレームワーク**: Expo (React Native) with Expo Router
- **言語**: TypeScript
- **音声認識**: Web Speech API (WebViewを経由)
- **アニメーション**: react-native-reanimated
- **テーマ**: ダーク（深いネイビー #0A0A12 + ティール #4ECDC4 アクセント）
- **パッケージ管理**: pnpm workspace (monorepo)

## プロジェクト構成

```
artifacts/caption-bridge/
├── app/
│   ├── _layout.tsx        # ルートレイアウト（Stack navigation、ダークテーマ）
│   ├── index.tsx          # メイン字幕画面（音楽認識ボタン・長押しコピー）
│   ├── history.tsx        # 字幕履歴画面
│   └── settings.tsx       # 設定画面
├── components/
│   ├── SpeechRecognizer.tsx  # WebViewベースの音声認識コンポーネント
│   ├── SongPopup.tsx         # 音楽認識結果ポップアップ（ACRCloud）
│   ├── ErrorBoundary.tsx
│   └── ErrorFallback.tsx
├── constants/
│   └── colors.ts          # カラーテーマ定義
└── assets/images/         # アイコン・スプラッシュ画像（icon-v4.png）

artifacts/api-server/
├── src/routes/
│   ├── health.ts          # ヘルスチェックエンドポイント
│   ├── recognize.ts       # 音楽認識プロキシ（ACRCloud HMAC-SHA1署名）
│   └── index.ts           # ルーター登録
```

## 主な機能

1. **音声認識** - Web Speech APIによるリアルタイム音声→テキスト変換
2. **字幕表示** - 確定テキストとリアルタイム認識中テキストの表示
3. **コピー機能** - 字幕バブル長押しで1行コピー、ボタンで全文コピー
4. **音楽認識** - ♪ボタンで6秒録音→ACRCloud APIで曲名特定→Spotify/Apple Music/YouTubeで開く
5. **設定画面** - 認識言語・文字サイズ・動作設定
6. **履歴** - セッション履歴の保存と閲覧
7. **ダークテーマ** - 目に優しい高コントラストデザイン

## 音楽認識設定（ACRCloud）

以下の環境変数が必要（api-serverに設定）：
- `ACRCLOUD_HOST` - 例: identify-ap-southeast-1.acrcloud.com
- `ACRCLOUD_ACCESS_KEY` - ACRCloudのアクセスキー
- `ACRCLOUD_ACCESS_SECRET` - ACRCloudのシークレット

ACRCloudの無料アカウント: https://www.acrcloud.com/

## 対応プラットフォーム

- iOS（Expo Go）
- Android（Expo Go）
- Web（ブラウザ）

## 開発コマンド

```bash
pnpm --filter @workspace/caption-bridge run dev
```

## 音声認識の仕組み

WebView内でWeb Speech APIを実行し、認識結果をpostMessageで
React Nativeコードに渡す方式。AndroidはChrome WebView、
iOSはWKWebViewを利用。

## ベースモノレポ

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **API framework**: Express 5（共有バックエンド）
- **Database**: PostgreSQL + Drizzle ORM
