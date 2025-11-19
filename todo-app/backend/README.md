# Todo App Backend

FastAPIベースの認証付きTodoアプリケーションバックエンド

## セットアップ

1. 仮想環境の作成と有効化:
```bash
python -m venv venv
source venv/bin/activate  # macOS/Linux
```

2. 依存パッケージのインストール:
```bash
pip install -r requirements.txt
```

3. 環境変数の設定:
`.env.example`を`.env`にコピーして、必要な値を設定してください。

```bash
cp .env.example .env
```

必須設定:
- `SECRET_KEY`: ランダムな文字列に変更
- OAuth使用時: Google/GitHubのClient IDとSecretを設定

## OAuth認証の設定

### Google OAuth
1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成
3. 「APIとサービス」→「認証情報」
4. 「OAuth 2.0 クライアントID」を作成
5. 承認済みのリダイレクトURIに追加: `http://localhost:8000/api/auth/google/callback`
6. Client IDとSecretを`.env`に設定

### GitHub OAuth
1. [GitHub Settings](https://github.com/settings/developers)にアクセス
2. 「OAuth Apps」→「New OAuth App」
3. Authorization callback URLに設定: `http://localhost:8000/api/auth/github/callback`
4. Client IDとSecretを`.env`に設定

## サーバーの起動

```bash
python main.py
```

または

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API: http://localhost:8000
ドキュメント: http://localhost:8000/docs

## エンドポイント

### 認証
- `POST /api/auth/signup` - メール/パスワードでサインアップ
- `POST /api/auth/login` - メール/パスワードでログイン
- `GET /api/auth/me` - 現在のユーザー情報取得
- `GET /api/auth/google/login` - Google OAuthログイン
- `GET /api/auth/github/login` - GitHub OAuthログイン

### タスク
- `GET /api/tasks` - タスク一覧取得
- `POST /api/tasks` - タスク作成
- `PUT /api/tasks/{task_id}` - タスク更新
- `DELETE /api/tasks/{task_id}` - タスク削除

### カテゴリ
- `GET /api/categories` - カテゴリ一覧取得
- `POST /api/categories` - カテゴリ作成
