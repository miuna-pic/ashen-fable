import sys, time, torch
sys.path.insert(0, 'hy3d')
from PIL import Image
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
torch.set_num_threads(8)
pipe = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained('tencent/Hunyuan3D-2', subfolder='hunyuan3d-dit-v2-0-turbo', use_safetensors=True, device='cpu', dtype=torch.float32)
pipe.enable_flashvdm(mc_algo='mc'); pipe.to('cpu', torch.float32); pipe.vae.float()
steps = int(sys.argv[1]); res = int(sys.argv[2])
for n in sys.argv[3:]:
    t = time.time()
    img = Image.open(f'in/{n}.png').convert('RGBA')
    # pad to square with margin
    s = int(max(img.size) * 1.1); c = Image.new('RGBA', (s, s), (0, 0, 0, 0)); c.paste(img, ((s - img.width) // 2, (s - img.height) // 2)); 
    m = pipe(image=c, num_inference_steps=steps, octree_resolution=res, num_chunks=20000, generator=torch.manual_seed(12345), output_type='trimesh')[0]
    m.export(f'out/{n}_raw.glb'); print('DONE', n, round(time.time() - t), len(m.faces), flush=True)
