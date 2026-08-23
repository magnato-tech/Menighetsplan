const localStore = new Map<string, string>();
const sessionStore = new Map<string, string>();

function memoryStorage(store: Map<string, string>) {
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: memoryStorage(localStore),
    configurable: true,
  });
}

if (typeof globalThis.sessionStorage === "undefined") {
  Object.defineProperty(globalThis, "sessionStorage", {
    value: memoryStorage(sessionStore),
    configurable: true,
  });
}

const meta = import.meta as ImportMeta & { env?: Record<string, unknown> };
if (!meta.env) {
  (meta as { env: Record<string, unknown> }).env = {
    PROD: false,
    DEV: true,
    MODE: "test",
    SSR: false,
    BASE_URL: "/",
    VITE_USE_REMOTE_DATA: "false",
  };
}
