# ASCII BPM Cycler

A self-contained Chrome app for full-screen ASCII lyric/word cycling at a chosen BPM.

## Run

Open `index.html` in Google Chrome.

## Controls

- Paste lyrics or words into the text area.
- Use the seed field for repeatable visuals, or the randomize button for a new look.
- Set BPM, background engine, character set, beat timing, word motion, colour mode, palette, quality, FPS limit, lyric mode, glyph size, word density, glitch amount, word halo, and display options.
- Colour modes include classic glow, randomized background field, word spotlight, and thermal depth.
- Background engines include ray field, starfield warp, rotating galaxy, plasma, rain fall, maze circuit, vortex lens, wire terrain, scope trace, and data blocks.
- Character sets include full ramp, minimal, dots, numbers, binary, punctuation, slashes, waves, and custom.
- Paste ASCII art into the mask panel to use it as a stencil, beat reveal, or foreground/background texture.
- The menu uses the live colour preview as the full-page background, with translucent collapsible control sections over it.
- The preview starts as a static background frame. Turn Live preview on, or press `Space` from the menu, for animated feedback while tweaking controls.
- Scene slots are saved in the browser. Select a slot and press Store scene, click a filled scene to recall it, or press `1`-`8` during playback.
- Scene JSON exports the selected scene. Scene bank JSON exports all eight scene slots.
- Transition mode controls whether live scene and preset changes cut immediately, wait for the next beat, wait for the next bar, or beat-cut with a fade.
- Auto sections splits lyrics by blank lines and advances sections after the chosen number of bars.
- Legibility mode is a master macro for readable, balanced, or chaotic rendering without manually adjusting every intensity control.
- Recording mode pins steadier output settings and can render/export at fixed capture sizes like 1920 x 1080 or 1080 x 1920.
- Panic look applies a stable readable scene immediately with the button or `0`.
- Tap tempo sets BPM from repeated taps; press `T` from the menu or use the button.
- MIDI tempo sync can follow MIDI clock messages in browsers that expose Web MIDI, including Chrome with a connected MIDI source.
- Lyric mode supports words, phrases, and markup words. In markup mode, `*WORD*` renders larger, `[word]` uses secondary styling, and `// comments` are ignored.
- Use the fullscreen controls for browser fullscreen, and the OBS URL button for a capture-friendly file URL.
- Press `Go` to start.
- Press `Escape` to return to the menu, `Space` to enable menu preview motion or pause playback, arrow keys to nudge BPM, `B` for background only, `H` for halo, `I` for invert, `S` for scanlines, `M` to cycle motion, `0` for panic look, and `1`-`8` to recall scene slots.
- Press `Ctrl+Enter` or `Cmd+Enter` from the menu to start quickly.
- Enable background only to hide all word and microtext layers while keeping the BPM-reactive background.
