const ADMIN_STORAGE_KEY = "adminUser";

export const DEFAULT_ADMIN_USERNAME = "Mahesh.CH";
export const DEFAULT_ADMIN_PASSWORD = "Brompton1234";

export function getStoredAdminUser() {
  return window.sessionStorage.getItem(ADMIN_STORAGE_KEY) ?? "";
}

export function storeAdminUser(username: string) {
  window.sessionStorage.setItem(ADMIN_STORAGE_KEY, username);
}

export function clearAdminUser() {
  window.sessionStorage.removeItem(ADMIN_STORAGE_KEY);
}

export function validateAdminLogin(username: string, password: string, configured?: { username: string; password: string }) {
  const expectedUsername = configured?.username ?? DEFAULT_ADMIN_USERNAME;
  const expectedPassword = configured?.password ?? DEFAULT_ADMIN_PASSWORD;
  return username.trim().toLowerCase() === expectedUsername.toLowerCase() && password === expectedPassword;
}
