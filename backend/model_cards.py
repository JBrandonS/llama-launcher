# backend/model_cards.py
from huggingface_hub import hf_hub_download, HfApi, hf_hub_url
import re
from typing import Dict, Any, Optional


_FLAG_MAP = {
    'n_ctx': '--ctx',
    'n_gpu_layers': '--gpu-layers',
    'temperature': '--temp',
    'top_k': '--top-k',
    'top_p': '--top-p',
    'n_predict': '--predict',
    'threads': '--threads',
}


def parse_model_card(repo_id: str, filename: str = 'README.md') -> Dict[str, Any]:
    api = HfApi()
    if not api.repo_exists(repo_id):
        return {}

    path = hf_hub_download(
        repo_id=repo_id,
        filename=filename,
        repo_type='model',
    )

    card_data = _read_markdown(path)
    return card_data


def _read_markdown(path: str) -> Dict[str, Any]:
    with open(path, errors='replace') as f:
        content = f.read()

    result = {}
    in_frontmatter = False
    frontmatter_lines = []

    for line in content.split('\n'):
        if line.strip() == '---':
            if not in_frontmatter:
                in_frontmatter = True
                continue
            else:
                break
        if in_frontmatter:
            frontmatter_lines.append(line)

    result['frontmatter'] = _parse_yaml_block(frontmatter_lines)
    rest = content[content.find('---') + 3:] if '---' in content else content
    result['body'] = rest[:2000]

    return result


def _parse_yaml_block(lines: list) -> Dict[str, Any]:
    data = {}
    current_key = None
    for line in lines:
        stripped = line.strip()
        if ':' in stripped and not stripped.startswith('-') and not stripped.startswith('*'):
            key, _, value = stripped.partition(':')
            key = key.strip().lower()
            value = value.strip().strip('"').strip("'")
            if value:
                data[key] = value
                current_key = None
            else:
                current_key = key
        elif stripped.startswith('- ') and current_key:
            item = stripped[2:].strip().strip('"').strip("'")
            if current_key not in data:
                data[current_key] = []
            data[current_key].append(item)
    return data


def _parse_body_recommendations(body_text: str) -> Dict[str, Any]:
    params: Dict[str, Any] = {}

    kv_pattern = re.compile(
        r'(?:^|[^\w])'
        r'(temperature|top_k|top_p|n_ctx|n_predict|threads|n_gpu_layers)'
        r'\s*=\s*'
        r'([0-9]+(?:\.[0-9]+)?)'
        r'[^\w]',
        re.IGNORECASE,
    )
    for m in kv_pattern.finditer(body_text):
        key = m.group(1).lower()
        val = m.group(2)
        if key not in params:
            params[key] = val

    prose_pattern = re.compile(
        r'(?:'
        r'(?:temperature|top[_ ]?k|top[_ ]?p|n_ctx|n_predict|threads|n_gpu_layers)'
        r'|temp'
        r')'
        r'\b.*?'
        r'(?:is|set\s+to|use(?:d)?\s*(?:at|with)?\s*|\bof\b)\s*'
        r'([0-9]+(?:\.[0-9]+)?)',
        re.IGNORECASE,
    )
    for m in prose_pattern.finditer(body_text):
        matched_word = m.group(0).lower()
        val = m.group(1)
        if 'temp' in matched_word and 'context' not in matched_word:
            key = 'temperature'
        elif 'top_k' in matched_word or re.search(r'top[_ ]?k', matched_word):
            key = 'top_k'
        elif 'top_p' in matched_word or re.search(r'top[_ ]?p', matched_word):
            key = 'top_p'
        elif 'n_ctx' in matched_word or 'context' in matched_word:
            key = 'n_ctx'
        elif 'n_predict' in matched_word or 'predict' in matched_word:
            key = 'n_predict'
        elif 'thread' in matched_word:
            key = 'threads'
        elif 'gpu' in matched_word and 'layer' in matched_word:
            key = 'n_gpu_layers'
        else:
            continue
        if key not in params:
            params[key] = val

    table_pattern = re.compile(
        r'\|?\s*(temperature|top[_ ]?k|top[_ ]?p)\s*\|.*?\|([0-9]+(?:\.[0-9]+)?)\s*\|',
        re.IGNORECASE,
    )
    for m in table_pattern.finditer(body_text):
        key_raw = m.group(1).lower()
        val = m.group(2)
        if 'top_k' in key_raw or re.search(r'top[_ ]?k', key_raw):
            key = 'top_k'
        elif 'top_p' in key_raw or re.search(r'top[_ ]?p', key_raw):
            key = 'top_p'
        else:
            key = 'temperature'
        if key not in params:
            params[key] = val

    return params


def _extract_external_docs_urls(body_text: str, frontmatter: Dict[str, Any]) -> list[str]:
    urls: set[str] = set()

    doc_url_patterns = [
        re.compile(r'https?://[^\s<>"]+\.ai/docs/[^\s<>"]*', re.IGNORECASE),
        re.compile(r'https?://[^\s<>"]+/docs/[^\s<>"]*', re.IGNORECASE),
    ]

    fm_text = str(frontmatter)
    for pattern in doc_url_patterns:
        for m in pattern.finditer(fm_text):
            urls.add(m.group(0))

    for pattern in doc_url_patterns:
        for m in pattern.finditer(body_text):
            urls.add(m.group(0))

    return sorted(urls)


def get_recommended_params(repo_id: str) -> Dict[str, Any]:
    card = parse_model_card(repo_id)
    if not card:
        return {}

    fm = card.get('frontmatter', {})
    body_text = card.get('body', '')
    sources = {'frontmatter': [], 'body': [], 'external_docs': []}

    for param, flag in _FLAG_MAP.items():
        val = fm.get(param) or fm.get(flag.lstrip('-'))
        if val:
            sources['frontmatter'].append(f'{flag} {val}')

    body_params = {}
    if not sources['frontmatter']:
        body_params = _parse_body_recommendations(body_text)
        for param, val in body_params.items():
            flag = _FLAG_MAP.get(param)
            if flag:
                sources['body'].append(f'{flag} {val}')

    external_urls = _extract_external_docs_urls(body_text, fm)
    sources['external_docs'] = external_urls

    cli_flags = sources['frontmatter'] or sources['body'] or None

    return {
        'name': fm.get('model_name') or repo_id,
        'description': fm.get('summary') or fm.get('description', ''),
        'author': fm.get('library_name'),
        'tags': fm.get('tags', []),
        'cli_flags': cli_flags,
        '_sources': sources,
    }
