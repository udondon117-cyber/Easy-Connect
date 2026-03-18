# CaptionBridge (キャプションブリッジ)

## アプリ概要

高齢者・障害者向けのアクセシビリティツール。音声をリアルタイムで認識して日本語字幕を表示します。

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
│   ├── index.tsx          # メイン字幕画面
│   └── settings.tsx       # 設定画面
├── components/
│   ├── SpeechRecognizer.tsx  # WebViewベースの音声認識コンポーネント
│   ├── ErrorBoundary.tsx
│   └── ErrorFallback.tsx
├── constants/
│   └── colors.ts          # カラーテーマ定義
└── assets/images/         # アイコン・スプラッシュ画像
```

## 主な機能

1. **音声認識** - Web Speech APIによるリアルタイム音声→テキスト変換
2. **字幕表示** - 確定テキストとリアルタイム認識中テキストの表示
3. **コピー機能** - 字幕テキストをクリップボードにコピー
4. **設定画面** - 認識言語・文字サイズ・動作設定
5. **ダークテーマ** - 目に優しい高コントラストデザイン

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
