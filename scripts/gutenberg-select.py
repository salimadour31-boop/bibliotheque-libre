import json,re
from collections import Counter
M=json.load(open('pg_meta.json'))
def ok(o):
  if o['rights']!='Public domain in the USA.' or not o['txt'] or len(o['langs'])!=1: return False
  if not o['authors']: return False
  for a in o['authors']:
    if not a['death'] or not a['death'].lstrip('-').isdigit() or int(a['death'])>1955: return False
  return True
def theme(o):
  t=' '.join(o['subjects']+o['shelves']).lower()
  for k,ws in [('jeunesse',['juvenile','children','enfant']),('théâtre',['drama','théâtre','theater','plays','comédie','tragédie']),('poésie',['poetry','poésie','poems','poèmes']),('contes',['fairy','folklore','tales','contes','legends','fables']),('philosophie',['philosophy','philosophie','ethics','morale']),('religion',['religion','bible','christian','theology','islam']),('histoire',['history','histoire','biography','biographie','travel','voyages','mémoires','memoirs']),('sciences',['science','mathemat','natural history','medicine','astronomy','botany','économie','economics','sciences'])]:
    if any(w in t for w in ws): return k
  return 'roman'
sel={}
for L,N in [('fr',2500),('en',2500)]:
  c=sorted([o for o in M if o['langs']==[L] and ok(o)],key=lambda o:-o['downloads'])
  print(L,'éligibles',len(c))
  sel[L]=c[:N]
  for o in sel[L]: o['theme']=theme(o)
  print(Counter(o['theme'] for o in sel[L]))
json.dump(sel,open('selection.json','w'),ensure_ascii=False)
