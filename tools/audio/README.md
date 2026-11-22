# Score and sound

Everything under `public/audio` is rendered offline by the scripts here, from sampled instruments. Nothing is synthesised in the browser.

- `score.py` composes and renders the cues: the title and one theme per chapter (`rabbit`, `tea`, `croquet`, `ball`, `match`, `wall`, `wood`, `trial`), each with its own tune, key, metre and band. The first two chapters share the D Dorian lullaby; the others are new tunes. Every cue is three bar-locked stems: `-a` above the glass, `-b` the same tune melodically inverted around its home note for the mirror face (every chord swaps quality), `-p` the danger layer. `score.json` carries tempo, beats per bar, the inversion axis, loop length and the chord of every bar, which the game uses to pitch footsteps.
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
