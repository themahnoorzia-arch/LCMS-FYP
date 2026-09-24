// Logs the user out properly: first ends the session on the server (so the
// session cookie stops working, even if someone has a copy of it), then clears
// the browser's local data and returns to the login page.
//
// The local cleanup and redirect ALWAYS happen — even if the server call fails,
// is rejected (e.g. the session had already expired) or hangs — so the user is
// never stuck on a dashboard. The short timeout keeps a slow or sleeping server
// from making the Logout button look frozen.
export async function performLogout(navigate, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (err) {
    console.error('Logout request did not complete:', err);
  } finally {
    clearTimeout(timer);
  }
  localStorage.clear();
  navigate('/login');
}
