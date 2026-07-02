interface Env {
  API_URL: string;
  VENMO_HANDLE: string;
  DEFAULT_PRICE: number;
}

const env: Env = {
  API_URL: import.meta.env.VITE_API_URL || '',
  VENMO_HANDLE: import.meta.env.VITE_VENMO_HANDLE || '',
  DEFAULT_PRICE: Number(import.meta.env.VITE_DEFAULT_PRICE) || 10,
};

export { env };
