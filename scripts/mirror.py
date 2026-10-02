"""Capture the public Avenue pages and their original static dependencies."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from hashlib import sha256
from pathlib import Path
from urllib.parse import urlsplit, unquote
from urllib.request import Request, urlopen
import html
import gzip
import json
import re

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://saf.sensata.kz'
HOSTS = {'static.tildacdn.pro', 'thb.tildacdn.pro', 'neo.tildacdn.com',
         'fonts.googleapis.com', 'fonts.gstatic.com', 'repos.masnaget.digital'}
URL_RE = re.compile(r'https?://(?:(?!&(?:quot|apos|lt|gt);)[^\s\"\'<>\)\\])+')

def is_resource_url(url):
    parsed = urlsplit(url)
    return parsed.hostname in HOSTS and parsed.path not in ('', '/')

manifest = json.loads((ROOT / 'asset-manifest.json').read_text(encoding='utf-8')) if (ROOT / 'asset-manifest.json').exists() else {}
manifest = {url: path for url, path in manifest.items() if is_resource_url(url)}
errors = {}

def asset_file(path):
    target = (ROOT / path.lstrip('/')).resolve()
    if not path.startswith('/assets/') or not target.is_relative_to((ROOT / 'assets').resolve()):
        raise ValueError('Asset path must remain inside assets/')
    return target

def local_path(url):
    if url in manifest:
        return manifest[url]
    p = urlsplit(url)
    name = unquote(p.path).lstrip('/') or 'index'
    # Query-string resources (Google fonts and versioned styles) need stable filenames.
    if p.query:
        base = Path(name)
        name = str(base.with_name(base.stem + '-' + sha256(p.query.encode()).hexdigest()[:10] + base.suffix)).replace('\\', '/')
    if p.hostname == 'fonts.googleapis.com':
        name += '.css'
    return '/assets/' + p.hostname + '/' + name

def urls(text):
    text = html.unescape(text).replace(r'\/', '/')
    return {m.rstrip(';,') for m in URL_RE.findall(text)
            if is_resource_url(m)}

def fetch(url):
    target = asset_file(local_path(url))
    if target.exists():
        data = target.read_bytes()
        content_type = 'text/css' if target.suffix == '.css' else ''
    else:
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req, timeout=55) as response:
            data = response.read()
            content_type = response.headers.get('Content-Type', '')
    if data.startswith(b'\x1f\x8b'):
        data = gzip.decompress(data)
    if not data:
        raise ValueError('Empty asset response')
    dependencies = set()
    if target.suffix in ('.css', '.js', '.svg') or 'text/css' in content_type:
        text = data.decode('utf-8')
        dependencies = urls(text)
        if target.suffix == '.css':
            from urllib.parse import urljoin
            for ref in re.findall(r'url\(\s*[\"\']?([^\"\'\s\)]+)', text):
                if not ref.startswith(('data:', '#', '/assets/')):
                    dependencies.add(urljoin(url, ref))
    # Publish a file only after decoding and dependency parsing have succeeded.
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(target.name + '.download')
    temporary.write_bytes(data)
    temporary.replace(target)
    return url, local_path(url), dependencies

def rewrite(text):
    def replace_url(match):
        raw = match.group(0)
        token = raw.rstrip(';,')
        url = html.unescape(token)
        path = manifest.get(url)
        if not is_resource_url(url) or not path:
            return raw
        target = asset_file(path)
        if not target.is_file() or target.stat().st_size == 0:
            raise ValueError('Missing downloaded resource: ' + url)
        return path + raw[len(token):]
    return URL_RE.sub(replace_url, text)

def clean_page(text):
    def script_filter(match):
        block = match.group(0)
        if any(key in block for key in ('googletagmanager.com', 'google-analytics.com',
                                       'tilda-stat-1.0', 'tilda-fallback-1.0', 'tilda-events-1.0', 'cdn.profitbase.ru')):
            return ''
        return block
    text = re.sub(r'<script\b[^>]*>.*?</script>', script_filter, text, flags=re.S)
    text = re.sub(r'<noscript>\s*<iframe[^>]*googletagmanager.*?</noscript>', '', text, flags=re.S)
    text = text.replace('data-tilda-lazy="yes"', 'data-tilda-lazy="yes" data-tilda-imgoptimoff="yes"')
    text = re.sub(r'href=([\"\'])/([\"\'])', r'href=\1/avenue\2', text)
    text = re.sub(r'href=([\"\'])/kz/?([\"\'])', r'href=\1/avenuekz\2', text)
    text = text.replace('href="https://saf.sensata.kz/avenue"', 'href="/avenue"')
    text = text.replace('href="https://saf.sensata.kz/avenuekz"', 'href="/avenuekz"')
    text = re.sub(r'/custom\.css\?t=\d+', '/custom.css', text)
    # Form rendering and validation stay original; submission is handled locally.
    text = re.sub(r'data-field-receivers-value="[^"]*"', 'data-field-receivers-value=""', text)
    text = re.sub(r'<input[^>]*class="[^"]*js-formaction-services[^"]*"[^>]*>', '', text)
    text = text.replace('</head>', '<script src="/local-runtime.js"></script></head>')
    return rewrite(text)

def main():
    errors.clear()
    pages = {'avenue': (ROOT / 'source.html').read_text(encoding='utf-8')}
    for name in ('avenuekz', 'privacy', 'privacykz'):
        with urlopen(ORIGIN + '/' + name, timeout=45) as response:
            pages[name] = response.read().decode('utf-8')
    with urlopen(ORIGIN + '/custom.css', timeout=45) as response:
        custom = response.read().decode('utf-8')
    pending = set().union(*(urls(s) for s in pages.values()), urls(custom))
    seen = set()
    while pending:
        batch = pending - seen
        pending = set()
        if not batch:
            break
        seen |= batch
        with ThreadPoolExecutor(max_workers=12) as pool:
            jobs = {pool.submit(fetch, url): url for url in sorted(batch)}
            for job in as_completed(jobs):
                url = jobs[job]
                try:
                    url, path, dependencies = job.result()
                    manifest[url] = path
                    pending |= {d for d in dependencies if is_resource_url(d)}
                except Exception as exc:
                    manifest.pop(url, None)
                    errors[url] = str(exc)
        print(f'Downloaded {len(manifest)} resources; {len(errors)} failures; {len(pending - seen)} dependencies remaining', flush=True)
    (ROOT / 'mirror-errors.json').write_text(json.dumps(errors, ensure_ascii=False, indent=2), encoding='utf-8')
    if errors:
        raise RuntimeError(f'Mirror incomplete: {len(errors)} resources failed. Existing pages were preserved; see mirror-errors.json.')
    for path in set(manifest.values()):
        f = asset_file(path)
        if f.suffix in ('.css', '.js', '.svg'):
            raw = f.read_text(encoding='utf-8')
            if f.name == 'tilda-zero-forms-1.0.min.js':
                raw = raw.replace('d="https://static.tildacdn."+t_zeroForms__getRootZone()', 'd="/assets/static.tildacdn.pro"')
            # Relative CSS references are resolved from their original CDN location.
            if f.suffix == '.css':
                original = next(u for u, p in manifest.items() if p == path)
                from urllib.parse import urljoin
                def css_ref(m):
                    ref = m.group(1)
                    if ref.startswith('/assets/'):
                        return 'url("' + ref + '")'
                    return 'url("' + manifest.get(urljoin(original, ref), ref) + '")'
                raw = re.sub(r'url\(\s*[\"\']?([^\"\'\s\)]+)[\"\']?\s*\)', css_ref, raw)
            f.write_text(rewrite(raw), encoding='utf-8')
    for name, raw in pages.items():
        (ROOT / (name + '.html')).write_text(clean_page(raw), encoding='utf-8')
    (ROOT / 'index.html').write_text(clean_page(pages['avenue']), encoding='utf-8')
    custom_path = ROOT / 'custom.css'
    marker = '/* LOCAL APPEARANCE OVERRIDES */'
    previous_custom = custom_path.read_text(encoding='utf-8') if custom_path.exists() else ''
    local_overrides = marker + previous_custom.split(marker, 1)[1] if marker in previous_custom else ''
    custom_path.write_text(rewrite(custom) + '\n' + local_overrides, encoding='utf-8')
    (ROOT / 'asset-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Finished: {len(pages)} pages, {len(manifest)} assets.', flush=True)

if __name__ == '__main__':
    main()
