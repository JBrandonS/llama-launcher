# backend/ini_writer.py
"""Write llama.cpp server configuration in INI format."""


def write_server_ini(
    model_path: str,
    host: str = "127.0.0.1",
    port: int = 12345,
    n_ctx: int = 2048,
    n_gpu_layers: int = -1,
    threads: int = 8,
    temp: float = 0.7,
    top_k: int = 40,
    top_p: float = 0.95,
    n_predict: int = 512,
    embedding: bool = False,
    rope_scaling: str = "none",
    **extra: dict[str, str],
) -> str:
    """Generate a llama.cpp server .ini configuration string."""
    lines = [
        "[server]",
        f"host = {host}",
        f"port = {port}",
        "",
        "[model]",
        f"path = {model_path}",
        f"ctx-size = {n_ctx}",
        f"gpu-layers = {n_gpu_layers}",
        f"threads = {threads}",
        f"embedding = {str(embedding).lower()}",
        "",
        "[sampling]",
        f"temp = {temp}",
        f"top-k = {top_k}",
        f"top-p = {top_p}",
        f"repeat-penalty = 1.1",
        "",
        "[advanced]",
        f"rope-scaling = {rope_scaling}",
    ]

    for key, value in extra.items():
        lines.append(f"{key} = {value}")

    return "\n".join(lines) + "\n"
