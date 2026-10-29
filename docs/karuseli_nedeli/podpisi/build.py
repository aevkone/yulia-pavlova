import re
L=open(r'C:/Users/buhsk/UlyaPavlova/docs/oformlenie/ssylki_bloki.txt',encoding='utf-8').read()
parts=re.split(r'^=== (.+?) ===\s*$',L,flags=re.M)
blk={parts[i].split(' ')[0]:parts[i+1].strip() for i in range(1,len(parts),2)}
D='D:/yulia_zavod_syrye/karuseli_nedeli/podpisi/'
for k in ['k0_razbor','k1_gasite','k2_ujti','k3_pravdy']:
    rd=lambda s: open(D+f'{k}_{s}.txt',encoding='utf-8').read().strip()
    out={'instagram':rd('ig')+'\n\n'+blk['INSTAGRAM'],'vk':rd('vk')+'\n\n'+blk['ВКОНТАКТЕ'],'telegram':rd('tg')+'\n\n'+blk['TELEGRAM-КАНАЛ']}
    for n,v in out.items(): open(D+f'{k}_{n}_final.txt','w',encoding='utf-8').write(v+'\n')
    print(k,{n:len(v) for n,v in out.items()})
