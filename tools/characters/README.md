# Character pipeline

Each figure in `public/models/` is sculpted from its illustration in `public/art/`:

1. `sculpt.py` — Hunyuan3D-2 (turbo, runs on CPU) turns the illustration into a raw mesh.
2. `bake.py` — decimates to ~35k triangles, projects the illustration onto the front, paints the unseen side from the silhouette colours, and writes the `_SWAY` attribute the shader uses to move hair and cloth.
3. `gltf-transform webp` then `gltf-transform meshopt` — about 0.5 MB per figure.
