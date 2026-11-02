"""Auditoria somente leitura dos DOCX originais. Nenhuma geração ou chamada de API."""
import argparse
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def inspect_docx(path, model):
    paragraphs = []
    unsupported_content = set()
    with zipfile.ZipFile(path) as archive:
        for name in sorted(archive.namelist()):
            if name.startswith('word/') and name.endswith('.xml'):
                root = ET.fromstring(archive.read(name))
                for tag in ('tbl', 'drawing', 'pict'):
                    if next(root.iter(W + tag), None) is not None:
                        unsupported_content.add(tag)
                # Marcadores podem estar fragmentados em vários runs de um parágrafo.
                paragraphs.extend(''.join(t.text or '' for t in p.iter(W + 't'))
                                  for p in root.iter(W + 'p'))
    text = '\n'.join(paragraphs)
    variables = set(re.findall(r'\{\{([^{}]+)\}\}', text))
    anchors = set(re.findall(r'<<[^<>]+>>', text))
    expected = {s[k] for s in model['assinantes'] for k in ('ancora', 'rubrica')}
    money = sorted(set(re.findall(r'R\$\s*\{\{([^{}]+)\}\}', text)))
    return {
        'sha256': sha(path.read_bytes()),
        'missing_variables': sorted(set(model['variaveis']) - variables),
        'extra_variables': sorted(variables - set(model['variaveis'])),
        'missing_anchors': sorted(expected - anchors),
        'extra_anchors': sorted(anchors - expected),
        'literal_currency_prefix': money,
        'unsupported_content': sorted(unsupported_content),
    }


def audit(catalog_path, directories):
    catalog_bytes = catalog_path.read_bytes()
    models = json.loads(catalog_bytes)
    files = {}
    for directory in directories:
        for path in sorted(directory.rglob('*.docx')):
            canonical = re.sub(r'\(\d+\)(?=\.docx$)', '', path.name)
            files.setdefault(canonical, []).append(path)
    rows = []
    for model in models:
        candidates = files.get(model['arquivo'], [])
        row = {'arquivo': model['arquivo'], 'status': 'missing_source', 'sandbox': 'pending'}
        if candidates:
            if len({sha(p.read_bytes()) for p in candidates}) > 1:
                row['status'] = 'ambiguous_source_versions'
            else:
                try:
                    row.update(inspect_docx(candidates[0], model))
                    row['status'] = 'audited'
                except (zipfile.BadZipFile, ET.ParseError, OSError):
                    row['status'] = 'invalid_docx'
        rows.append(row)
    # Divergências são evidências bloqueantes, nunca corrigidas nos arquivos.
    ready = all(r['status'] == 'audited' and not any(r[k] for k in (
        'missing_variables', 'extra_variables', 'missing_anchors', 'extra_anchors',
        'literal_currency_prefix', 'unsupported_content')) for r in rows)
    return {'catalog_sha256': sha(catalog_bytes), 'source_audit_ok': ready,
            'production_enabled': False, 'models': rows}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directories', nargs='+', type=Path)
    parser.add_argument('--catalog', type=Path, default=Path(__file__).resolve().parent.parent / 'zapsign-formularios.json')
    args = parser.parse_args()
    report = audit(args.catalog, args.directories)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(0 if report['source_audit_ok'] else 1)
