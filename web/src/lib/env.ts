/**
 * Returns true if the application is running in a development/dev environment.
 */
export function isDevEnvironment(): boolean {
  return (
    import.meta.env.VITE_APP_ENV === "development" ||
    import.meta.env.VITE_APP_ENV === "dev" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.includes("fleurraine-dev")
  );
}
