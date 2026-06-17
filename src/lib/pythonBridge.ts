/**
 * FA7 OS Python Bridge Utility
 * Allows communication with the local Python process (port 3003)
 */

export interface BridgeCommand {
  cmd: string;
  args?: Record<string, any>;
}

export interface BridgeResponse {
  ok: boolean;
  result?: any;
  error?: string;
}

const BRIDGE_URL = "http://127.0.0.1:3003/__bridge__";

/**
 * Sends a command to the local Python Bridge.
 */
export async function sendBridgeCommand(cmd: string, args: Record<string, any> = {}): Promise<BridgeResponse> {
  // Only attempt if not in a standard non-local environment 
  // (optional safety check)
  if (typeof window === "undefined") return { ok: false, error: "Not in browser context" };

  try {
    const response = await fetch(BRIDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cmd, args }),
    });

    if (!response.ok) {
      return { ok: false, error: `Bridge error: ${response.statusText}` };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Checks if the application is running inside the Desktop Shell.
 */
export function isDesktopShell(): boolean {
  return navigator.userAgent.includes("FA7-Desktop-Shell");
}

/**
 * Example commands
 */
export const desktopCommands = {
  openPath: (path: string) => sendBridgeCommand("open_path", { path }),
  maximize: () => sendBridgeCommand("maximize_window"),
  setAppearance: (opacity: number) => sendBridgeCommand("set_window_appearance", { opacity }),
};
