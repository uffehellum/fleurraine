const RETURN_TO_KEY = "fleurraine_auth_return_to";

export function storeAuthReturnTo(path: string) {
  sessionStorage.setItem(RETURN_TO_KEY, path);
}

export function consumeAuthReturnTo(): string {
  const path = sessionStorage.getItem(RETURN_TO_KEY) ?? "/";
  sessionStorage.removeItem(RETURN_TO_KEY);
  return path;
}
