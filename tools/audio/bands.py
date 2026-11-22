import sys, numpy as np, soundfile as sf, subprocess, io
from scipy.signal import welch
def rd(p):
    raw = subprocess.run(['ffmpeg','-v','error','-i',p,'-f','f32le','-ac','2','-ar','48000','-'],capture_output=True).stdout
    return np.frombuffer(raw,'float32').reshape(-1,2)
edges=[30,60,120,250,500,1000,2000,4000,8000,16000]
print('file'.ljust(28),' '.join(f'{e:>6}' for e in edges[:-1]),'  peak  crest  corr')
for p in sys.argv[1:]:
    x=rd(p); f,P=welch(x.mean(1),48000,nperseg=16384); tot=P.sum()
    b=[10*np.log10(P[(f>=lo)&(f<hi)].sum()/tot+1e-12) for lo,hi in zip(edges,edges[1:])]
    pk=np.abs(x).max(); rms=np.sqrt((x**2).mean()); c=np.corrcoef(x[:,0],x[:,1])[0,1]
    print(p.split('/')[-1].ljust(28),' '.join(f'{v:6.1f}' for v in b),f' {20*np.log10(pk):5.1f} {20*np.log10(pk/rms):5.1f}  {c:.2f}')
