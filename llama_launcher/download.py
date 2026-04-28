# llama_launcher/download.py
import os
import sys
from pathlib import Path
from huggingface_hub import snapshot_download, hf_hub_download
from typing import Optional, List


def download_model(
    model_id: str,
    local_dir: Optional[str] = None,
    filenames: Optional[List[str]] = None,
    token: Optional[str] = None,
    resume: bool = True,
) -> str:
    if not model_id:
        raise ValueError("model_id is required")

    dest = local_dir or str(Path.home() / '.cache' / 'huggingface' / 'hub')

    try:
        path = snapshot_download(
            repo_id=model_id,
            local_dir=dest,
            allow_patterns=filenames or ['*.gguf'],
            token=token,
            resume_download=resume,
        )
        print(f'Downloaded {model_id} to {path}')
        return path
    except Exception as e:
        raise RuntimeError(f'Failed to download {model_id}: {e}')


def download_gguf(
    repo_id: str,
    filename: str,
    local_dir: Optional[str] = None,
    token: Optional[str] = None,
) -> str:
    if not repo_id or not filename:
        raise ValueError("repo_id and filename are required")

    dest = local_dir or '.'
    Path(dest).mkdir(parents=True, exist_ok=True)

    return hf_hub_download(
        repo_id=repo_id,
        filename=filename,
        local_dir=dest,
        token=token,
    )
