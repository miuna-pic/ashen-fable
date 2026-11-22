# Score and sound

Everything under `public/audio` is rendered offline by the scripts here, from sampled instruments. Nothing is synthesised in the browser.

- `score.py` composes and renders the cues. One 16-bar lullaby in D Dorian is the whole score; each chapter re-orchestrates it. Every cue is three bar-locked stems: `-a` above the glass, `-b` the same tune melodically inverted around D5 for the mirror face (Dorian is its own mirror, so the inversion stays in key and every chord swaps quality), `-p` the danger layer. `score.json` carries tempo, loop length and the chord of every bar, which the game uses to pitch footsteps.
- `sfx.py` renders the one-shots and stingers into `public/audio/sfx`.
- `synth.py` is the sampler, reverb, limiter and loop wrapper. `diag.py` checks instrument tuning, `bands.py` prints the spectral balance of rendered files.

## Rebuilding

    python -m venv venv && venv/bin/pip install numpy scipy soundfile
    # sample libraries, side by side in $AUDIO_LIBS (default ~/audiolab/libs):
    #   sso                   https://github.com/peastman/sso
    #   SalamanderGrandPiano  https://github.com/sfzinstruments/SalamanderGrandPiano
    #   VCSL                  https://github.com/sgossner/VCSL
    venv/bin/python score.py            # or: score.py rabbit tea
    venv/bin/python sfx.py

ffmpeg is needed for the AAC encode. The libraries' file names are only nominal pitches, so the sampler measures every sample and retunes it (cached in `$AUDIO_LIBS/tuning.json`).

## Credits

- Sonatina Symphonic Orchestra by Mattias Westlund, Creative Commons Sampling Plus 1.0.
- Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0.
- Versilian Community Sample Library, CC0.
