"""Sleep inhibitor for preventing OS sleep during long operations.

Provides a context-manager-friendly SleepInhibitor class that uses
systemd-inhibit on Linux (with fallbacks) to prevent the system from
sleeping/suspending while benchmarks or other long-running tasks are
in progress.

Usage::

    with SleepInhibitor("Benchmarking in progress"):
        run_long_operation()

Or manually::

    inhibitor = SleepInhibitor("Benchmarking")
    inhibitor.acquire()
    try:
        run_long_operation()
    finally:
        inhibitor.release()
"""

from __future__ import annotations

import logging
import subprocess
import sys
from contextlib import contextmanager
from typing import Optional

logger = logging.getLogger(__name__)


class SleepInhibitor:
    """Prevent OS sleep/suspend during long operations.

    On Linux with systemd, uses ``systemd-inhibit`` to acquire an idle,
    sleep, and suspend inhibition handle.  Falls back to other methods or
    logs a warning if no suitable mechanism is available.

    Can be used as a context manager::

        with SleepInhibitor("Running benchmarks"):
            ...

    Or manually::

        inhibitor = SleepInhibitor("Work in progress")
        inhibitor.acquire()
        try:
            ...
        finally:
            inhibitor.release()
    """

    def __init__(self, reason: str = "Operation in progress", who: str = "llama-launcher") -> None:
        self._reason = reason
        self._who = who
        self._proc: Optional[subprocess.Popen] = None
        self._inhibited = False

    # ── acquire / release ────────────────────────────────────────────

    def acquire(self) -> bool:
        """Acquire a sleep inhibition handle.  Returns True if successful."""
        if self._inhibited:
            return True

        # Try systemd-inhibit first (Linux with systemd)
        if self._try_systemd_inhibit():
            self._inhibited = True
            return True

        # Try DBus-based inhibition (fallback for systemd without CLI)
        if self._try_dbus_inhibit():
            self._inhibited = True
            return True

        logger.warning(
            "Could not acquire sleep inhibition — the system may sleep during long operations. "
            "Ensure systemd-inhibit is available or consider using a tool like 'caffeine'."
        )
        return False

    def release(self) -> None:
        """Release any held inhibition handle."""
        if not self._inhibited:
            return
        if self._proc is not None and self._proc.poll() is None:
            try:
                self._proc.terminate()
                self._proc.wait(timeout=2)
            except Exception:
                try:
                    self._proc.kill()
                except Exception:
                    pass
        self._proc = None
        self._inhibited = False

    @contextmanager
    def context(self):
        """Context manager for use with ``with`` statement."""
        acquired = self.acquire()
        try:
            yield self
        finally:
            if acquired:
                self.release()

    # ── internal helpers ─────────────────────────────────────────────

    def _try_systemd_inhibit(self) -> bool:
        """Try using systemd-inhibit to prevent sleep.

        Runs ``systemd-inhibit`` as a background process that stays alive
        for the duration of the inhibited period.  Uses --no-block so it
        does not block the calling thread.
        """
        if sys.platform != "linux":
            return False

        try:
            result = subprocess.run(
                ["which", "systemd-inhibit"],
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                return False
        except Exception:
            return False

        try:
            self._proc = subprocess.Popen(
                [
                    "systemd-inhibit",
                    "--what=idle:sleep:suspend",
                    f"--who={self._who}",
                    f"--why={self._reason}",
                    "--mode=block",
                    "cat",  # keep the process alive by reading stdin
                ],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            # Give it a moment to start; if PID is alive, we're good.
            import time
            time.sleep(0.1)
            if self._proc.poll() is None:
                logger.debug("Sleep inhibition acquired via systemd-inhibit (PID %s)", self._proc.pid)
                return True
            else:
                # Process exited immediately — inhibit failed
                self._proc = None
                return False
        except Exception as e:
            logger.debug("systemd-inhibit failed: %s", e)
            if self._proc and self._proc.poll() is None:
                try:
                    self._proc.terminate()
                except Exception:
                    pass
                self._proc = None
            return False

    def _try_dbus_inhibit(self) -> bool:
        """Try using DBus to acquire an idle inhibition handle.

        This is a fallback for systems where systemd-inhibit CLI is not
        available but the DBus API is.
        """
        if sys.platform != "linux":
            return False

        try:
            import dbus  # type: ignore[import-not-found]
        except ImportError:
            return False

        try:
            bus = dbus.SystemBus()
            manager = bus.get_object(
                "org.freedesktop.login1",
                "/org/freedesktop/login1",
            )
            inhibit = dbus.Interface(
                manager,
                "org.freedesktop.login1.Manager",
            )

            # Idle inhibition: what="idle", mode="block"
            inhibit.Inhibit("idle", self._who, self._reason, "block")
            logger.debug("Sleep inhibition acquired via DBus idle inhibit")
            return True
        except Exception as e:
            logger.debug("DBus inhibit failed: %s", e)
            return False


def get_sleep_inhibitor(reason: str = "Operation in progress") -> SleepInhibitor:
    """Convenience function to create a new SleepInhibitor instance."""
    return SleepInhibitor(reason=reason)
