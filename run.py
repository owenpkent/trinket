#!/usr/bin/env python3
"""Trinket launcher.

One command to play with Trinket, so you don't have to remember the npm and
tauri invocations. Run with no arguments to open the shelf in a window, or
pass a subcommand:

    python run.py                  # the shelf, in its own app window
    python run.py menu             # interactive menu of everything below
    python run.py toy              # list the toys
    python run.py toy lava-lamp    # open straight into one toy
    python run.py desktop          # the native Tauri window (needs Rust)
    python run.py build            # static site into dist/
    python run.py installer        # desktop installers (needs Rust, slow)
    python run.py verify           # types, lint, tests
    python run.py icon             # regenerate the icons from assets/icon.svg
    python run.py doctor           # check prerequisites

Stdlib only; works with any Python 3.8+.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import webbrowser
from pathlib import Path

REPO = Path(__file__).resolve().parent
TOYS = REPO / "src" / "toys"
# Vite is pinned to this port (strictPort) in vite.config.ts.
DEV_PORT = 5173
DEV_URL = f"http://localhost:{DEV_PORT}/"
WINDOW_SIZE = "1100,720"


# --- small helpers ---------------------------------------------------------


def tool(name: str) -> "str | None":
    """Resolve an executable, tolerating Windows .cmd/.exe shims."""
    return shutil.which(name)


def need(name: str) -> str:
    path = tool(name)
    if not path:
        sys.exit(f"error: '{name}' not found on PATH. Run `python run.py doctor`.")
    return path


def run(cmd: "list[str]", *, cwd: Path = REPO) -> int:
    """Run a command, streaming its output; return its exit code."""
    print(f"\n$ {' '.join(cmd)}  (in {cwd})\n")
    return subprocess.run(cmd, cwd=str(cwd)).returncode


def ensure_deps() -> None:
    if not (REPO / "node_modules").is_dir():
        print("node_modules missing; installing dependencies first...")
        if run([need("npm"), "install", "--no-audit", "--no-fund"]) != 0:
            sys.exit("npm install failed.")


def toys() -> "list[tuple[str, str]]":
    """Every registered toy as (id, name), read straight from the toy sources.

    Parsing the files keeps this list correct when someone adds a toy without
    thinking about the launcher, which is the whole point of the SDK.
    """
    found = []
    for index in sorted(TOYS.glob("*/index.ts")):
        text = index.read_text(encoding="utf-8")
        toy_id = re.search(r"^\s*id:\s*'([^']+)'", text, re.M)
        name = re.search(r"^\s*name:\s*'([^']+)'", text, re.M)
        if toy_id:
            found.append((toy_id.group(1), name.group(1) if name else toy_id.group(1)))
    return found


def find_browser() -> "str | None":
    """Locate a Chromium-based browser for app-window mode.

    App mode gives the toy a clean window with no tab strip or address bar, and
    lets us stop the dev server when that window closes.
    """
    override = os.environ.get("BROWSER_PATH")
    if override and Path(override).exists():
        return override
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    for name in ("chrome", "google-chrome", "chromium", "msedge", "brave"):
        found = shutil.which(name)
        if found:
            return found
    return None


def kill_tree(proc: subprocess.Popen) -> None:
    """Terminate a process and its children (npm spawns node and vite underneath)."""
    if proc.poll() is not None:
        return
    if sys.platform == "win32":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
    else:
        proc.terminate()


def wait_for_port(host: str, port: int, timeout: float = 90.0) -> bool:
    """Return True once something is listening, else False on timeout.

    Connects by hostname so it matches however the browser resolves it: Vite may
    bind IPv6 (::1) or IPv4 (127.0.0.1), and checking only one would miss the other.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((host, port), timeout=1):
                return True
        except OSError:
            time.sleep(0.4)
    return False


# --- actions ---------------------------------------------------------------


def cmd_doctor(_args) -> int:
    checks = [
        ("node", "Node.js 20+ (required for everything)"),
        ("npm", "npm (install deps, run the toys)"),
        ("cargo", "Rust/Cargo (only for the native desktop build)"),
        ("rustc", "Rust compiler (only for the native desktop build)"),
    ]
    print("Trinket prerequisites:\n")
    for name, description in checks:
        path = tool(name)
        mark = "OK " if path else "-- "
        print(f"  [{mark}] {name:6s} {description}")
        if path:
            print(f"         {path}")

    deps = (REPO / "node_modules").is_dir()
    state = "installed" if deps else "MISSING (run: npm install)"
    print(f"\n  [{'OK ' if deps else '-- '}] node_modules   {state}")

    browser = find_browser()
    state = browser if browser else "none found (falls back to your default browser)"
    print(f"  [{'OK ' if browser else '-- '}] app window     {state}")

    print(f"\n  {len(toys())} toys on the shelf:")
    for toy_id, name in toys():
        print(f"    - {name} (#/{toy_id})")
    return 0


def serve(route: str = "") -> int:
    """Start the dev server and open the app, blocking until it is closed.

    With a Chromium browser present the toy gets its own frameless-ish window and
    the server stops when that window closes, which is the behaviour you want
    from something you open, fiddle with, and shut again.
    """
    ensure_deps()
    url = DEV_URL + (f"#/{route}" if route else "")
    server = subprocess.Popen([need("npm"), "run", "dev"], cwd=str(REPO))
    browser = find_browser()

    if browser:
        print("\nStarting Trinket; the dev server stops when you close the window.\n")

        def app_window() -> None:
            if not wait_for_port("localhost", DEV_PORT):
                print(f"\n(Server did not come up; open {url} manually.)")
                return
            # A throwaway profile keeps this window out of your real browser
            # session, so closing it cannot take your tabs with it.
            profile = tempfile.mkdtemp(prefix="trinket_win_")
            window = subprocess.Popen(
                [
                    browser,
                    f"--app={url}",
                    f"--user-data-dir={profile}",
                    f"--window-size={WINDOW_SIZE}",
                    "--new-window",
                    "--no-first-run",
                    "--no-default-browser-check",
                ]
            )
            window.wait()  # blocks until the user closes the app window
            print("\nWindow closed; stopping the dev server.")
            kill_tree(server)
            shutil.rmtree(profile, ignore_errors=True)

        threading.Thread(target=app_window, daemon=True).start()
        try:
            server.wait()
        except KeyboardInterrupt:
            kill_tree(server)
        return 0

    print(f"Starting the Vite dev server; opening {url} when it is ready.")
    print("Press Ctrl+C to stop.\n")

    def open_when_ready() -> None:
        if wait_for_port("localhost", DEV_PORT):
            webbrowser.open(url)
        else:
            print(f"\n(Server did not come up in time; open {url} manually.)")

    threading.Thread(target=open_when_ready, daemon=True).start()
    try:
        return server.wait()
    except KeyboardInterrupt:
        kill_tree(server)
        return 0


def cmd_dev(_args) -> int:
    return serve()


def cmd_toy(args) -> int:
    available = toys()
    wanted = getattr(args, "toy", None)

    if not wanted:
        print("Toys on the shelf:\n")
        for toy_id, name in available:
            print(f"  {name:14s} python run.py toy {toy_id}")
        return 0

    ids = [toy_id for toy_id, _ in available]
    if wanted not in ids:
        print(f"No toy called '{wanted}'. Available: {', '.join(ids)}")
        return 1
    return serve(wanted)


def cmd_desktop(_args) -> int:
    ensure_deps()
    need("cargo")
    return run([need("npm"), "run", "tauri", "dev"])


def cmd_build(_args) -> int:
    ensure_deps()
    code = run([need("npm"), "run", "build"])
    if code == 0:
        print(f"\nStatic site written to {REPO / 'dist'}")
    return code


def cmd_installer(_args) -> int:
    ensure_deps()
    need("cargo")
    print("Building desktop installers. The first Rust build takes a while.\n")
    code = run([need("npm"), "run", "tauri", "build"])
    if code == 0:
        bundle = REPO / "src-tauri" / "target" / "release" / "bundle"
        print(f"\nInstallers written to {bundle}")
    return code


def cmd_verify(_args) -> int:
    ensure_deps()
    return run([need("npm"), "run", "verify"])


def cmd_icon(_args) -> int:
    ensure_deps()
    return run([need("npm"), "run", "icon"])


# --- interactive menu ------------------------------------------------------

MENU = [
    ("Open the shelf", cmd_dev),
    ("Open one toy", cmd_toy),
    ("Native desktop window (needs Rust)", cmd_desktop),
    ("Build the static site", cmd_build),
    ("Build desktop installers (needs Rust, slow)", cmd_installer),
    ("Verify (types, lint, tests)", cmd_verify),
    ("Check prerequisites", cmd_doctor),
]


def interactive() -> int:
    print("What do you want to do?\n")
    for index, (label, _) in enumerate(MENU, 1):
        print(f"  {index}. {label}")
    print("  0. Quit")
    try:
        choice = input("\nChoose [1]: ").strip() or "1"
    except (EOFError, KeyboardInterrupt):
        print()
        return 0
    if choice == "0":
        return 0
    try:
        _, action = MENU[int(choice) - 1]
    except (ValueError, IndexError):
        print("Invalid choice.")
        return 1

    if action is cmd_toy:
        available = toys()
        print()
        for index, (_, name) in enumerate(available, 1):
            print(f"  {index}. {name}")
        try:
            pick = input("\nWhich toy [1]: ").strip() or "1"
            toy_id = available[int(pick) - 1][0]
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        except (ValueError, IndexError):
            print("Invalid choice.")
            return 1
        return serve(toy_id)

    return action(argparse.Namespace(toy=None))


# --- entrypoint ------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run Trinket (browser window, desktop app, or a build).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("dev", help="the shelf in its own app window; the default")
    sub.add_parser("menu", help="interactive menu of everything below")
    p_toy = sub.add_parser("toy", help="open one toy directly, or list them")
    p_toy.add_argument("toy", nargs="?", help="toy id, for example lava-lamp")
    sub.add_parser("desktop", help="the native Tauri window (needs Rust)")
    sub.add_parser("build", help="static site into dist/")
    sub.add_parser("installer", help="desktop installers (needs Rust, slow)")
    sub.add_parser("verify", help="types, lint and tests")
    sub.add_parser("icon", help="regenerate the icons from assets/icon.svg")
    sub.add_parser("doctor", help="check prerequisites")

    args = parser.parse_args()
    dispatch = {
        "dev": cmd_dev,
        "menu": lambda _a: interactive(),
        "toy": cmd_toy,
        "desktop": cmd_desktop,
        "build": cmd_build,
        "installer": cmd_installer,
        "verify": cmd_verify,
        "icon": cmd_icon,
        "doctor": cmd_doctor,
    }
    if args.command is None:
        return cmd_dev(args)
    return dispatch[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
