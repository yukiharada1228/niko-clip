# niko-clip

## 概要
- 動画から笑顔シーンを抽出し、SNS 向けのサムネイル素材を生成するアプリケーション
- フロントエンドは Next.js、バックエンドは FastAPI と OpenVINO で構成
- Redis を用いて解析タスクの進捗と結果を管理

## 機能ハイライト
- `POST /tasks` に動画をアップロードすると笑顔スコア付きの静止画候補を生成
- 同時に複数タスクを処理しつつ、`GET /tasks/{task_id}` で進捗・結果を取得
- 抽出結果は Base64 画像データとしてフロントエンドに配信し、そのままダウンロード可能
- ユーザー向けに処理中・完了・エラーなどの状態をリアルタイム表示

## リポジトリ構成
```
backend/   FastAPI + OpenVINO による推論 API
frontend/  Next.js アプリケーション
```

## 必要環境
- Python 3.12 以上
- Node.js 18 以上 (推奨: LTS)
- Redis 6 以上
- OpenVINO 2024.6 対応 CPU (GPU・VPU は任意)

## セットアップ手順

### 1. 共通準備
1. リポジトリをクローン
2. 必要に応じて `.env` を `backend/` 配下に配置 (サンプルは任意で追加)
   - `UPLOADS_DIR` … 一時保存ディレクトリ (既定 `/tmp/uploads`)
   - `REDIS_URL` … Redis 接続 URL (既定 `redis://localhost:6379/0`)
   - `MAX_BASE64_IMAGE_SIZE_MB` … Base64 変換時の最大サイズ

### 2. Docker Compose でまとめて起動 (推奨)
```
cd backend
docker compose up --build
```

- `backend` サービスが FastAPI を、`redis` サービスが Redis を起動します
- `http://localhost:8000/health` がヘルスチェック、`http://localhost:8000/docs` が API ドキュメント
- 停止する場合は `docker compose down` を実行

### 3. ローカル実行 (Docker を使わない場合)
#### バックエンド
```
cd backend

# 依存関係のインストール (uv 利用例)
uv sync

# Redis をローカルで起動 (例: brew services、もしくは docker compose で redis のみ起動)

# API を起動
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- OpenVINO のモデルは `backend/models/intel/` に同梱済み
- API ドキュメントは `http://localhost:8000/docs` で確認可能

#### フロントエンド
```
cd frontend

# 依存関係のインストール
npm install

# 開発サーバー
npm run dev
```

- フロントエンドが利用する API のベース URL は `NEXT_PUBLIC_API_BASE_URL` で指定 (既定 `http://localhost:8000`)
- ブラウザで `http://localhost:3000` を開くとアプリが表示される

## 利用フロー
1. フロントエンドから動画ファイルを選択しアップロード
2. バックエンドが OpenVINO で顔検出・表情推定を行い、笑顔スコアが高いシーンを抽出
3. 抽出結果は Base64 画像データ、タイムスタンプ、スコアとして Redis に保存
4. クライアントはポーリングによってステータス・結果を取得し、ダウンロードリンクを提供

## 主な API エンドポイント
- `GET /health` … ヘルスチェック
- `POST /tasks` … 動画を受け付け、解析タスクを登録
- `GET /tasks/{task_id}` … タスクの進捗・結果を取得 (Base64 画像データを含む)

## 開発コマンド例
- バックエンドテスト: `uv run pytest`
- フロントエンド Lint: `npm run lint`