// 認証はすべてブラウザのlocalStorageで完結する（バックエンド/DB不要）

type LocalUser = {
  id: number;
  email: string;
  username: string;
  password: string;
};

const USERS_KEY = 'local_users';
const TOKEN_KEY = 'auth_token';

// UTF-8対応のbase64エンコード/デコード
function encodePayload(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}
function decodePayload(b64: string): any {
  return JSON.parse(decodeURIComponent(escape(atob(b64))));
}

function loadUsers(): LocalUser[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(USERS_KEY) || '[]') as LocalUser[];
  } catch {
    return [];
  }
}

function saveUsers(users: LocalUser[]) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function makeToken(user: LocalUser): string {
  const payload = encodePayload({
    userId: user.id,
    email: user.email,
    username: user.username,
  });
  return `local.${payload}.token`;
}

export const authService = {
  async signup(email: string, password: string, username?: string) {
    const users = loadUsers();
    if (users.some((u) => u.email === email)) {
      throw new Error('このメールアドレスは既に使用されています');
    }
    const id = users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1;
    const user: LocalUser = {
      id,
      email,
      username: username || email.split('@')[0],
      password,
    };
    users.push(user);
    saveUsers(users);
    return { id: user.id, email: user.email, username: user.username };
  },

  async login(email: string, password: string) {
    const users = loadUsers();
    const user = users.find((u) => u.email === email);
    if (!user || user.password !== password) {
      throw new Error('メールアドレスまたはパスワードが間違っています');
    }
    return {
      token: makeToken(user),
      user: { id: user.id, email: user.email, username: user.username },
    };
  },

  async getMe(token: string) {
    const payload = decodePayload(token.split('.')[1]);
    return {
      id: payload.userId as number,
      email: payload.email as string | undefined,
      username: payload.username as string | undefined,
    };
  },

  saveToken(token: string) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOKEN_KEY, token);
    }
  },

  getToken() {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(TOKEN_KEY);
    }
    return null;
  },

  removeToken() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  },
};
