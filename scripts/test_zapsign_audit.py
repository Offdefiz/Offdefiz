"""Fixtures estruturais sintéticas: não são substitutos dos modelos jurídicos."""
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from audit_zapsign import audit


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.catalog = self.root / 'catalog.json'
        self.model = {'arquivo': 'teste.docx', 'variaveis': ['NOME'],
                      'assinantes': [{'ancora': '<<signer1>>', 'rubrica': '<<signer1Rubrica>>'}]}
        self.catalog.write_text(json.dumps([self.model]))

    def write_docx(self, name='teste.docx', content=None):
        if content is None:
            content = '<w:p><w:r><w:t>{{NO</w:t></w:r><w:r><w:t>ME}}</w:t></w:r></w:p><w:p><w:r><w:t>&lt;&lt;signer1&gt;&gt; &lt;&lt;signer1Rubrica&gt;&gt;</w:t></w:r></w:p>'
        with zipfile.ZipFile(self.root / name, 'w') as z:
            z.writestr('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + content + '</w:body></w:document>')

    def report(self):
        return audit(self.catalog, [self.root])

    def test_split_runs_duplicate_identical_versions_and_no_mutation(self):
        self.write_docx()
        original = (self.root / 'teste.docx').read_bytes()
        (self.root / 'teste(1).docx').write_bytes(original)
        r = self.report()
        self.assertTrue(r['source_audit_ok'])
        self.assertFalse(r['production_enabled'])
        self.assertEqual((self.root / 'teste.docx').read_bytes(), original)

    def test_missing_source_does_not_pass(self):
        r = self.report()
        self.assertFalse(r['source_audit_ok'])
        self.assertEqual(r['models'][0]['status'], 'missing_source')

    def test_ambiguous_versions_do_not_select_silently(self):
        self.write_docx()
        self.write_docx('teste(2).docx', '<w:p><w:r><w:t>Diferente</w:t></w:r></w:p>')
        self.assertEqual(self.report()['models'][0]['status'], 'ambiguous_source_versions')

    def test_reports_missing_and_extra_fields_anchors_currency_and_table(self):
        self.write_docx(content='<w:tbl/><w:p><w:r><w:t>R$ {{OUTRO}} &lt;&lt;signer9&gt;&gt;</w:t></w:r></w:p>')
        r = self.report()
        self.assertFalse(r['source_audit_ok'])
        row = r['models'][0]
        self.assertEqual(row['missing_variables'], ['NOME'])
        self.assertEqual(row['extra_variables'], ['OUTRO'])
        self.assertEqual(row['literal_currency_prefix'], ['OUTRO'])
        self.assertEqual(len(row['missing_anchors']), 2)
        self.assertEqual(row['extra_anchors'], ['<<signer9>>'])
        self.assertEqual(row['unsupported_content'], ['tbl'])

    def test_invalid_docx_is_blocked(self):
        (self.root / 'teste.docx').write_bytes(b'invalid')
        self.assertEqual(self.report()['models'][0]['status'], 'invalid_docx')


if __name__ == '__main__':
    unittest.main()
