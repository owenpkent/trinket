/**
 * Desktop-only extras.
 *
 * Trinket runs in a plain browser and in a Tauri window from the same bundle,
 * so anything native has to be optional. Detection is by feature, and the Tauri
 * API is imported lazily so the web build never pays for it.
 */

interface TauriGlobal {
  __TAURI_INTERNALS__?: unknown;
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in (window as TauriGlobal);
}

let alwaysOnTop = false;

/** Toggle the window's always-on-top flag. Returns the state actually applied. */
export async function toggleAlwaysOnTop(): Promise<boolean> {
  if (!isDesktop()) return false;
  const next = !alwaysOnTop;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_always_on_top', { value: next });
    alwaysOnTop = next;
  } catch (error) {
    // Losing the pin is not worth interrupting play over; leave the flag alone.
    console.warn('Trinket: could not change the always-on-top state.', error);
  }
  return alwaysOnTop;
}

export function isAlwaysOnTop(): boolean {
  return alwaysOnTop;
}
