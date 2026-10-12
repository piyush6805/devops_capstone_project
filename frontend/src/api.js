export async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const { detail } = await response.json();
      message = typeof detail === 'string' ? detail : detail?.map(e => `${e.loc.at(-1)}: ${e.msg}`).join('; ') || message;
    } catch { /* Non-JSON proxy errors use the status message. */ }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}
