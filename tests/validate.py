from pathlib import Path
import re,json
r=Path(__file__).parents[1]; h=(r/'index.html').read_text();
for p in re.findall(r'(?:src|href)="(\./[^"?]+)',h): assert (r/p[2:]).exists(),p
assert 'integrity=' not in h
js=(r/'data/airports.js').read_text(); data=json.loads(js[len('window.AIRPORTS='):-1]); assert len(data)>=80
ids=set(re.findall(r'id="([^"]+)"',h)); app=(r/'js/app.js').read_text(); refs=set(re.findall(r"\$\('([^']+)'\)",app)); assert refs<=ids,(refs-ids)
print('asset/html/data tests: PASS')
