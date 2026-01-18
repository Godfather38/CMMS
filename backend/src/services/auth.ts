// Simple wrapper around chrome.storage for auth tokens

const TOKEN_KEY = 'cmms_auth_token';

export const getAuthToken = async (): Promise<string | null> => {
  const result = await chrome.storage.local.get(TOKEN_KEY);
  return result[TOKEN_KEY] || null;
};

export const setAuthToken = async (token: string): Promise<void> => {
  await chrome.storage.local.set({ [TOKEN_KEY]: token });
  // Notify other parts of the extension
  chrome.runtime.sendMessage({ 
    type: 'AUTH_STATE_CHANGED', 
    payload: { isAuthenticated: true, token } 
  }).catch(() => {}); // Ignore error if no receivers
};

export const clearAuthToken = async (): Promise<void> => {
  await chrome.storage.local.remove(TOKEN_KEY);
  chrome.runtime.sendMessage({ 
    type: 'AUTH_STATE_CHANGED', 
    payload: { isAuthenticated: false } 
  }).catch(() => {});
};

export const isAuthenticated = async (): Promise<boolean> => {
  const token = await getAuthToken();
  return !!token;
};