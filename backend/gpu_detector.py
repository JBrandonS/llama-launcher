"""GPU detection and metrics collection.

Provides a unified GPU detection interface with a graceful fallback chain:
  NVIDIA (pynvml) → AMD (pyamdgpuinfo) → Intel (oneapi) → None

All GPU operations are wrapped in try/except so that missing libraries
or unavailable hardware never raise exceptions to callers.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# ── Active backend info (populated at detection time) ──────────────
_active_backend: str = ""


def get_active_backend() -> str:
    """Return the name of the currently active GPU backend, or ''."""
    return _active_backend


def detect_gpu() -> List[Dict[str, Any]]:
    """Detect GPUs and collect metrics.

    Returns a list of dicts (one per GPU) with keys:
        name, index, utilization, memoryUsed, memoryTotal,
        temperature, powerUsage, powerLimit, fanSpeed

    Falls back through: NVIDIA → AMD → Intel → empty list.
    """
    global _active_backend

    # NVIDIA
    try:
        import pynvml  # noqa: F401
    except ImportError:
        pass
    else:
        try:
            return _detect_nvidia()
        except Exception:
            logger.debug("NVIDIA GPU detection failed", exc_info=True)

    # AMD
    try:
        import amdgpuinfo  # noqa: F401
    except ImportError:
        pass
    else:
        try:
            return _detect_amd()
        except Exception:
            logger.debug("AMD GPU detection failed", exc_info=True)

    # Intel (oneAPI level_zero)
    try:
        import pylevelzero  # noqa: F401
    except ImportError:
        pass
    else:
        try:
            return _detect_intel()
        except Exception:
            logger.debug("Intel GPU detection failed", exc_info=True)

    _active_backend = ""
    return []


def _detect_nvidia() -> List[Dict[str, Any]]:
    """Collect metrics from NVIDIA GPUs via pynvml."""
    import pynvml

    pynvml.nvmlInit()
    results: List[Dict[str, Any]] = []
    try:
        device_count = pynvml.nvmlDeviceGetCount()
        _active_backend = "nvidia_smi"

        for i in range(device_count):
            handle = pynvml.nvmlDeviceGetHandleByIndex(i)
            try:
                name = pynvml.nvmlDeviceGetName(handle)
                if isinstance(name, bytes):
                    name = name.decode()

                util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
                info = {
                    "name": name,
                    "index": i,
                    "utilization": util.gpu if util.gpu else 0,
                    "memoryUsed": mem.used,
                    "memoryTotal": mem.total,
                    "temperature": 0,
                }
                # Temperature (best-effort)
                try:
                    info["temperature"] = pynvml.nvmlDeviceGetTemperature(
                        handle, pynvml.NVML_TEMPERATURE_GPU
                    )
                except Exception:
                    pass

                # Power (best-effort)
                try:
                    info["powerUsage"] = pynvml.nvmlDeviceGetPowerUsage(handle) / 1000.0
                    power_limit = pynvml.nvmlDeviceGetEnforcedPowerLimit(handle)
                    info["powerLimit"] = power_limit / 1000.0
                except Exception:
                    pass

                results.append(info)
            except Exception:
                continue
    finally:
        pynvml.nvmlShutdown()

    return results


def _detect_amd() -> List[Dict[str, Any]]:
    """Collect metrics from AMD GPUs via pyamdgpuinfo."""
    import amdgpuinfo
    import amdgpuinfo.powerplay as pp

    gpus = amdgpuinfo.find_gpus()
    _active_backend = "amdgpuinfo"
    results: List[Dict[str, Any]] = []

    for i, gpu in enumerate(gpus):
        try:
            info: Dict[str, Any] = {
                "name": gpu.name,
                "index": i,
                "utilization": gpu.core_clock / gpu.max_core_clock * 100 if gpu.max_core_clock else 0,
                "memoryUsed": 0,
                "memoryTotal": gpu.vram_size,
                "temperature": gpu.template_data.get("edge", {}).get("current", 0) if hasattr(gpu, 'template_data') else 0,
            }
            # Power draw
            try:
                info["powerUsage"] = pp.get_power_input()
            except Exception:
                pass
            results.append(info)
        except Exception:
            continue

    return results


def _detect_intel() -> List[Dict[str, Any]]:
    """Collect metrics from Intel GPUs via pylevelzero."""
    from pylevelzero import LevelZero

    lz = LevelZero()
    _active_backend = "intel_level_zero"
    results: List[Dict[str, Any]] = []

    try:
        num_devices = lz.get_device_count()
        for i in range(num_devices):
            device = lz.get_device(i)
            results.append({
                "name": device.name,
                "index": i,
                "utilization": 0,
                "memoryUsed": 0,
                "memoryTotal": device.memory_size,
                "temperature": 0,
            })
    except Exception:
        logger.debug("Intel GPU enumeration failed", exc_info=True)
    finally:
        lz.shutdown()

    return results
