from pathlib import Path
import json, zipfile, hashlib

root=Path(__file__).resolve().parents[1]
source=root/'extension'
manifest=json.loads((source/'manifest.json').read_text(encoding='utf-8'))
output=root/'dist'/('CiteLocus-'+manifest['version']+'-Chrome-Web-Store.zip')
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for file in sorted(source.rglob('*')):
        if not file.is_file() or file.is_symlink():continue
        relative=file.relative_to(source).as_posix()
        if any(part.startswith('.') for part in file.relative_to(source).parts):continue
        info=zipfile.ZipInfo(relative,date_time=(2026,11,11,0,0,0))
        info.compress_type=zipfile.ZIP_DEFLATED
        archive.writestr(info,file.read_bytes(),compresslevel=9)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert 'manifest.json' in archive.namelist()
sha=hashlib.sha256(output.read_bytes()).hexdigest()
report={'file':output.name,'version':manifest['version'],'sha256':sha,'bytes':output.stat().st_size}
output.with_suffix('.zip.report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
