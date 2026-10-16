import tarfile,re,json,html
from collections import Counter
out=[]
def g(p,s):
  m=re.search(p,s,re.S); return html.unescape(m.group(1).strip()) if m else None
tf=tarfile.open('rdf-files.tar.bz2','r:bz2')
for m in tf:
  if not m.name.endswith('.rdf'): continue
  s=tf.extractfile(m).read().decode('utf-8','replace')
  d=re.search(r'pg(\d+)\.rdf',m.name).group(1)
  langs=re.findall(r'<dcterms:language>.*?<rdf:value[^>]*>([^<]+)</rdf:value>',s,re.S)
  if not set(langs)&{'fr','en','ar','kab','ber'}: continue
  if g(r'<dcterms:type>.*?<rdf:value>([^<]+)</rdf:value>',s)!='Text': continue
  auths=[]
  for blk in re.findall(r'<dcterms:creator>(.*?)</dcterms:creator>',s,re.S):
    auths.append(dict(name=g(r'<pgterms:name>([^<]+)',blk),birth=g(r'<pgterms:birthdate[^>]*>([^<]+)',blk),death=g(r'<pgterms:deathdate[^>]*>([^<]+)',blk)))
  out.append(dict(id=int(d),title=g(r'<dcterms:title>([^<]+)</dcterms:title>',s),langs=langs,rights=g(r'<dcterms:rights>([^<]+)</dcterms:rights>',s) or '',
    authors=auths,subjects=[html.unescape(x) for x in re.findall(r'<dcterms:subject>.*?<rdf:value>([^<]+)</rdf:value>.*?</dcterms:subject>',s,re.S)],
    shelves=[html.unescape(x) for x in re.findall(r'<pgterms:bookshelf>.*?<rdf:value>([^<]+)</rdf:value>',s,re.S)],
    downloads=int(g(r'<pgterms:downloads[^>]*>(\d+)',s) or 0),issued=g(r'<dcterms:issued[^>]*>([^<]+)',s),summary=g(r'<pgterms:marc520>([^<]+)',s),
    txt=bool(re.search(r'\.txt',s))))
json.dump(out,open('pg_meta.json','w'),ensure_ascii=False)
print(len(out),Counter(l for o in out for l in o['langs'] if l in('fr','en','ar','kab','ber')),Counter(o['rights'][:30] for o in out))
