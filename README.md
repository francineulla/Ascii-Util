# ASCII BPM Cycler

A self-contained browser visualizer for generating full-screen, BPM-synced ASCII lyric art.

Paste in words or lyrics, pick a seed and tempo, shape the render style, then hit **Go**. The screen becomes a monospaced ASCII field with beat-reactive backgrounds, oversized lyric typography, glitch texture, colour modes, masks, scene slots, MIDI clock sync, and exportable presets.

## Features

- Full-screen ASCII lyric and word cycling in Google Chrome
- Static or animated live preview behind the control panel
- BPM input, tap tempo, and optional Web MIDI clock sync
- Seeded visuals for repeatable looks
- Four colour modes: classic glow, randomized field, word spotlight, and thermal depth
- Ten background engines: ray field, starfield warp, rotating galaxy, plasma, rain fall, maze circuit, vortex lens, wire terrain, scope trace, and data blocks
- Multiple character sets, including binary, punctuation, slashes, waves, and custom characters
- ASCII mask/stencil support from pasted ASCII art
- Word halo, background-only mode, scanlines, invert, beat flash, and downbeat flash
- Eight browser-saved scene slots with keyboard recall
- Scene JSON import/export for one scene or the full eight-scene bank
- Share URL and OBS-friendly URL generation
- Fixed capture sizes for frame export and recording workflows

## Quick Start

1. Clone or download this repository.
2. Open `index.html` in Google Chrome.
3. Paste lyrics or words into the text box.
4. Adjust BPM, seed, render engine, colour mode, and intensity settings.
5. Press **Go**.
6. Press `Escape` to return to the menu.

No build step, package install, or server is required.

## Controls

The menu is organized into collapsible sections:

- **Text**: lyrics, phrases, markup parsing, and word splitting
- **ASCII Mask / Stencil**: pasted ASCII art masks, reveal modes, and mask scale
- **Core**: seed, BPM, colour mode, and seed locking
- **Visual Texture**: background engine, character set, custom glyphs, invert, and scanlines
- **Timing**: beat timing, word motion, palette, bar length, transitions, beat flash, MIDI sync, and auto sections
- **Performance**: quality, FPS limit, lyric mode, capture size, recording mode, stage HUD, and fullscreen behavior
- **Intensity**: glyph size, word density, glitch, word halo, legibility, and background-only mode
- **Utilities**: tap tempo, fullscreen, share URL, OBS URL, frame save, panic look, and MIDI connection
- **Scenes & Presets**: scene slots, built-in defaults, randomizers, and scene JSON

## Keyboard Shortcuts

- `Escape`: return to menu
- `Space`: enable menu preview motion, or pause playback
- `Ctrl+Enter` / `Cmd+Enter`: start from the menu
- `ArrowUp` / `ArrowDown`: nudge BPM
- `Shift+ArrowUp` / `Shift+ArrowDown`: nudge BPM by 5
- `B`: toggle background-only mode
- `H`: toggle word halo
- `I`: toggle invert
- `S`: toggle scanlines
- `M`: cycle word motion
- `T`: tap tempo from the menu
- `0`: apply panic look
- `1`-`8`: recall scene slots during playback

## Lyric Markup

In **Markup words** mode:

- `*WORD*` renders as emphasized/huge text
- `[word]` uses secondary styling
- `// comments` are ignored

Blank lines can define sections when **Auto sections** is enabled.

## Scenes And JSON

Scene slots are saved locally in your browser.

- Click a slot to select or recall it.
- Shift-click a slot to store over it.
- Use **Store scene** to save the current controls into the selected slot.
- **Export scene** copies the selected scene as JSON.
- **Import scene** loads JSON into the selected scene slot.
- **Export all scenes** copies all eight slots as a scene bank.
- **Import all scenes** restores an exported scene bank.

The importer also accepts copied share URLs containing `#preset=`.

## OBS / Recording

Use **Copy OBS URL** to generate a capture-friendly URL that opens directly into playback. Recording mode can pin capture dimensions such as `1920 x 1080`, `1080 x 1920`, `1280 x 720`, or `720 x 720`.

## MIDI Sync

Chrome supports Web MIDI on compatible systems. Use **Connect MIDI**, choose an input, then enable **MIDI tempo sync**. MIDI clock messages can drive tempo, and MIDI start/stop messages can start or stop playback.

## Privacy And Security

ASCII BPM Cycler runs entirely in the browser. It does not require a backend and does not send lyrics, presets, MIDI data, or scene JSON anywhere by itself.

Stored scenes live in browser `localStorage`. Imported scene JSON is size-limited and normalized before it is applied to controls.

## Browser Support

This project is designed for current Google Chrome. Other browsers may render the visuals, but Web MIDI and some fullscreen/clipboard behavior may vary.

## Development

The project is intentionally small:

- `index.html`: app structure and controls
- `styles.css`: UI, stage, and preview styling
- `app.js`: render engines, timing, presets, scene storage, MIDI, and export logic

Open `index.html` directly after editing to test changes.
