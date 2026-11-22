# Character pipeline

Each figure is its illustration in `public/art/` pressed into a relief by a map in `public/models/`:

1. `sculpt.py` — Hunyuan3D-2 (turbo, runs on CPU) turns the illustration into a raw mesh.
2. `bake.py` — cleans and decimates the mesh, lines it up with the illustration, and marks which parts swing (`_SWAY`: hair, ribbons, hems).
3. `relief.py` — flattens that mesh into a small map: red is depth toward the viewer, green is how freely the part swings.

The full meshes are not shipped: at board size their silhouettes were rougher than the drawings.
