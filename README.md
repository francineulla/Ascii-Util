# ASCII BPM Cycler

A self-contained browser visualizer for generating full-screen, BPM-synced ASCII lyric art, Atari Video Music and Pixelmusic-style patterns, and NetHack-inspired dungeons.

Paste in words or lyrics, pick a seed and tempo, shape the render style, then hit **Go**. The screen becomes a monospaced ASCII field with beat-reactive backgrounds, oversized lyric typography, glitch texture, colour modes, masks, scene slots, MIDI clock sync, and exportable presets.

## Features

- Full-screen ASCII lyric and word cycling in Google Chrome
- One-page selector for Text mode or Video synthesizer mode, showing controls relevant to the selected mode
- Atari Video Music mode with stereo-reactive diamonds, original shape and array controls, and a silent BPM demo
- Separate Video Music 2 studio with flexible aspect ratios, eleven geometries, palette controls, glow, trails, symmetry, and motion
- Pixelmusic 3000 with eight source-informed pixel patterns, five colour families, original or beat/bar automation, independent Hold/Next controls, and favourite patterns
- ASCII NetHack dungeon in Video synthesizer mode, with seeded maps, an adventurer and companion, monsters, treasure, fog, audio dynamics, and discrete BPM-driven turns
- Static or animated live preview behind the control panel, with a preview status/control bar that stays at the top while scrolling
- BPM input, tap tempo, and optional Web MIDI clock sync
- Seeded visuals for repeatable looks
- Four colour modes: classic glow, randomized field, word spotlight, and thermal depth
- Ten text background engines: ray field, starfield warp, rotating galaxy, plasma, rain fall, maze circuit, vortex lens, wire terrain, scope trace, and data blocks
- Multiple character sets, including binary, punctuation, slashes, waves, and custom characters
- ASCII mask/stencil support from pasted ASCII art
- Word halo, background-only mode, scanlines, invert, beat flash, and downbeat flash
- Background word fragments use your lyrics, without extra built-in filler words
- Eight browser-saved scene slots with keyboard recall
- Optional scene names, unsaved-change feedback, and Revert to saved
- Global locks for tempo, lyrics, palette, and performance settings
- Crossfade, wipe, slide, and zoom-dissolve scene effects
- Audio-reactive intensity with attack/release, noise gate, stereo meters, clipping indicators, and full-range/bass/mid/treble/transient responses
- Interval Mode cycles saved scenes every configurable number of minutes
- Fifteen colour palettes, including sunset, ocean, synthwave, aurora, rose, ice, ember, and monochrome
- Scene JSON import/export for one scene or the full eight-scene bank
- Share URL and OBS-friendly URL generation
- Fixed capture sizes for frame export and recording workflows

## Quick Start

1. Clone or download this repository.
2. Open `index.html` in Google Chrome.
3. Choose **Text mode** for ASCII lyrics, or **Video synthesizer mode** for Atari Video Music, Video Music 2, Pixelmusic 3000, or the NetHack ASCII dungeon.
4. Adjust the selected mode's controls. In Text mode, paste lyrics to layer words over the background; in Video synthesizer mode, choose a synthesizer from its menu.
5. Press **Go**.
6. Press `Escape` to return to the menu.

No build step, package install, or server is required.

Both modes share one page. The top selector separates text controls from video synthesizer controls. **Video synthesizer** chooses **Atari Video Music**, **Video Music 2**, **NetHack dungeon**, or **Pixelmusic 3000**. Switching modes preserves the hidden settings. Tempo, scenes, audio connection, and output controls remain available where they apply.

## NetHack Dungeon

Choose **Video synthesizer mode → NetHack dungeon** for classic ASCII dungeon symbols. Enable **Live preview** to watch the adventurer and companion explore in discrete BPM-driven turns, then press **Go**. NetHack is available only as a video synthesizer and retains ASCII characters throughout. This is an original, source-informed visualizer, not a playable NetHack game or a port; there are no gameplay commands.

**Seed**, **Dungeon layout**, and **Dungeon depth** determine the 80×21 dungeon. **New dungeon** changes the seed and respects **Lock seed**. The display uses `@` for the adventurer, `d` for the companion, letters for monsters, `$` for gold, and `<`/`>` for stairs, alongside room walls, doors, and corridors. **Whole dungeon** reduces glyph size to fit the complete map in the viewport and setup monitor. The **NetHack · ASCII terminal** built-in preset starts with **Follow adventurer**. This standalone ASCII canvas is independent of lyric, mask, and text texture settings.

| Control | Choices or effect |
| --- | --- |
| Dungeon layout | Rooms & corridors, Labyrinth, or Caverns |
| Dungeon depth | 1–30; changes the seeded dungeon |
| Population | 0–100% |
| Turns per beat | ¼, ½, 1, 2, or 4 |
| Explore through fog | Reveal explored terrain and currently visible creatures; off by default |
| Dungeon palette | Dungeon stone, Green phosphor, Amber torchlight, or Frozen depths |
| Symbol glow | 0–100% glow around ASCII characters |
| Audio dynamics | 0–100% strength of signal-driven brightness and accents; default 70% |
| Camera | Whole dungeon or Follow adventurer |
| Signal | Silent Demo · follows BPM, or Connected audio |

BPM/MIDI advances the simulation at the selected **Turns per beat** rate. Closed doors block movement and sight, and opening a door takes an adventurer turn before entry. Species have different movement rates; the faster companion follows a path toward the adventurer and loiters nearby. With fog enabled, lit rooms are visible along clear sight lines, dark areas reveal adjacent cells, and previously explored terrain remains dim. Creature and object symbols use source-informed colours in the Dungeon stone palette.

**Audio dynamics** gives bass more influence over terrain, mids over creatures, treble over treasure, and level/transient accents over the adventurer. Stereo balance shifts the light across the map. Demo changes on discrete turns; connected audio changes lighting continuously while movement stays on BPM-driven turns. Audio does not detect tempo or spawn creatures. Choose **Open audio controls** and explicitly **Connect audio** to use an input. Dungeon controls save with scenes, JSON, share URLs, and OBS URLs; pause, frame export, capture sizes, and `Escape` are supported. Older Text-mode NetHack scenes, imports, and URLs automatically open the video synthesizer with their seed and dungeon settings preserved.

The supplied [NetHack 5.0.0 source](Temp/NetHack-NetHack-5.0.0_Released/) informed the visual vocabulary: the [Guidebook](Temp/NetHack-NetHack-5.0.0_Released/doc/Guidebook.txt) describes display and exploration; [global.h](Temp/NetHack-NetHack-5.0.0_Released/include/global.h), [defsym.h](Temp/NetHack-NetHack-5.0.0_Released/include/defsym.h), and [color.h](Temp/NetHack-NetHack-5.0.0_Released/include/color.h) define map dimensions, symbols, and colours. [mklev.c](Temp/NetHack-NetHack-5.0.0_Released/src/mklev.c) informed room connectivity, while [monsters.h](Temp/NetHack-NetHack-5.0.0_Released/include/monsters.h) and [dogmove.c](Temp/NetHack-NetHack-5.0.0_Released/src/dogmove.c) informed movement rates and companion following. The JavaScript generator and renderer are original; no NetHack code or assets were copied. Procedural layouts, deterministic movement budgets, and visibility are bounded visual approximations, without NetHack's full generation, combat, or random-event rules. Audio lighting is an original extension.

## Atari Video Music

Choose **Video synthesizer mode → Atari Video Music**, then press **Go**. Enable **Live preview** to animate the setup monitor, or load the **Atari Video Music** built-in preset. **Signal → Demo · follows BPM** supplies a silent, seeded stereo signal so you can explore the controls immediately. For music input, choose **Connected audio**, use **Open audio controls**, and explicitly **Connect audio** to a microphone/audio input or shared tab/system audio.

| Control | Effect |
| --- | --- |
| Gain · L / R | Independent channel sensitivity and pattern size |
| Contour · L / R | Lower values reveal changing audio contours; higher values produce steadier geometric edges |
| Colour | Adjusts the range of signal-driven colours |
| Shape | Solid fills the channel shapes; Hole subtracts their overlap; Ring draws outlines with independent channel colours; Auto changes the pattern |
| Horizontal / Vertical display | 1, 2, 3, or 5 columns; 1, 2, 4, or 8 rows |
| Scan rate / Auto scan | In Auto, choose 1, 2, 4, or 8 seconds and lock a shape or select Auto all |
| Stretch to fill screen | Optional stretching of the original 4:3 picture to the available display area; off by default |

Connected stereo audio drives the two channels independently; mono input supplies both channels. Equal channel shapes can cancel in **Hole** and **Ring**, so try different L/R gains if the display disappears. The native picture has no lyrics and fits at 4:3 by default. Enable **Stretch to fill screen** to fill the available area, including PNG output, by changing its proportions. This setting is independent of browser fullscreen: **Fullscreen** controls browser chrome, while stretching controls picture fit. ASCII settings remain available when you switch back; common **Scanlines** and **Invert** controls also apply to Atari output. Scene storage, preset JSON, share/OBS URLs, frame export, capture sizes, pause, and `Escape` work with this mode.

The reference audit checked the supplied [manual](Temp/Atari_C240_Video_Music_Manual.pdf), [schematic](Temp/Atari_C240_Video_Music_Schematic.png), and [patent](Temp/US4081829.pdf). The array counts, summed-ramp geometry, Solid OR/Hole XOR logic, fixed-width ring pulses, contour direction, colour-control endpoints, and Auto shape locks are based on those references. Inner and outer rings retain their respective channel colours. Hole and Ring preserve fractional horizontal edges when drawing, avoiding browser sampling dropouts between closely spaced shapes; equal-channel XOR cancellation remains. See the [original Atari manual](https://atarivideomusic.net/assets/docs/Atari_C240_Video_Music_Manual.pdf) and [Robert J. Brown's Atari patent, US4081829A](https://patents.google.com/patent/US4081829A/en), especially figures 7–10.

This remains a behavioral approximation. Browser RMS and smoothed envelopes substitute for the analog detector; waveform frequency estimates and an RGB palette substitute for alternating-frame zero-crossing registers and NTSC phase delays. Solid uses quantized four-bit ramps; Hole/Ring retain the stepped vertical ramp but use fractional horizontal edge coverage as a browser display adaptation. Auto uses fixed, seeded 1/2/4/8-second intervals, whereas the hardware derives randomness from audio-counter bits and those times describe approximate averages. Ring width, glow, and colours are not calibrated to an original unit's analog video timing or a particular television. The implementation does not claim cycle or electrical accuracy; stretching is an optional modern display feature.

## Video Music 2

Choose **Video synthesizer mode → Video Music 2** for the extended studio. The original **Atari Video Music** mode keeps its controls and default 4:3 picture; Video Music 2 has separate settings. Select **Demo · follows BPM** for a silent demonstration or **Connected audio** for the same explicitly connected stereo input. Enable **Live preview**, adjust the monitor, then press **Go**. Built-in looks include **Neon wide**, **Phosphor trails**, and **Portrait rings**; **Reset Video Music 2** restores its controls.

| Control group | Choices |
| --- | --- |
| Display | Fill window, 16:9, 21:9, 4:3, square, portrait, or a custom width/height ratio |
| Geometry | Diamonds, circles, squares, triangles, pentagons, hexagons, octagons, five-point stars, eight-point stars, crosses, or four-leaf clovers; chunky, fine, or smooth edges |
| Shape and array | Solid, Hole, Ring, or Auto; 1–8 columns and rows; automatic scan rate and shape locks |
| Stereo response | Independent L/R gain and contour |
| Colour and light | Spectral, Neon, Sunset, Ice, Phosphor, or Monochrome palette; colour response, hue, saturation, glow, and trails |
| Symmetry and motion | Horizontal, vertical, or four-way mirroring; zoom, rotation, and spin |

Fixed aspect ratios fit inside the available screen or exported image. Trails retain a short fading history during live preview and playback. Video Music 2 settings travel with scenes, JSON, share URLs, and OBS URLs; PNG export captures the current picture. Pause freezes the display and `Escape` returns to setup. This mode is a creative extension of the Atari-inspired signal model, with additional geometry and effects.

**Shuffle look** explores new geometry, colour, and motion while preserving the input source, display ratio, tempo, and original Atari settings. The existing visual, motion, colour, and timing randomizers also target Video Music 2 when it is selected. Custom ratios accept decimals, such as `2.35` by `1`. Resizing a paused native display preserves its picture proportions and frozen trails.

## Pixelmusic 3000

Choose **Video synthesizer mode → Pixelmusic 3000**, or load its built-in preset. Enable **Live preview**, then press **Go**. **Signal → Demo · follows BPM** supplies a silent stereo demonstration. **Connected audio** uses the existing audio connection; choose **Open audio controls** and explicitly **Connect audio** to enable an input. Loading a preset or opening a shared URL never opens audio automatically.

The native picture uses a 256×192 raster fitted at 4:3. Its layered pixel diamonds, alternating stripes, quarter-turns, and satellite shapes follow the eight routines in the supplied source. Stereo levels control pixel size independently. With the default **Original · audio-gated** automation, the timer waits for sufficient input before selecting a routine and advancing the colour sequence. The default settings preserve the original random sequence, including occasional repeated patterns.

| Control | Choices or effect |
| --- | --- |
| Pattern | Auto, Stereo wings, Crossed stripes, Fine cross, Turning stripes, Diamond cross, Diamond grid, Polar echoes, or Sidechain diamonds |
| Palette | Auto across five families, or Browns & yellows, Blues & purples, Pink, purple & white, Light blues & greens, or Oranges & greens |
| Change timing | Original · audio-gated, Beats, or Bars |
| Change every | 1, 2, 4, or 8 beats/bars; bars use the shared Bar length setting |
| Hold pattern / Hold palette | Freeze either automatic selection independently while the picture continues responding to sound |
| Next pattern / Next palette | Advance immediately, including while held or with Live preview off |
| Favourite patterns | Limit automatic and Next pattern selections to the checked patterns; none checked means all eight |
| Gain · L / R | 0–200%; independent stereo sensitivity, default 100% |
| Animation speed | ¼, ½, 1×, 2×, or 4× the nominal browser speed |
| Pixel scale | 1–6; the default 2 preserves the source-derived audio scaling |
| Stretch to fill screen | Fill the available display or export area instead of fitting 4:3; off by default |

Beat/bar automation follows BPM/MIDI, advances through silence, and is independent of **Animation speed**. It uses a seeded pattern cycle that avoids immediate repeats when multiple favourites are available. Returning from a background tab catches up to the current musical interval. Releasing a Hold resumes at the next interval without replaying held changes. A manually selected Pattern disables its Hold, Next, and favourites controls; palette Hold/Next remains available and a fixed palette family keeps changes within that family. Some source palette entries repeat the same colours.

Gain, pixel scale, and other look edits preserve the current automatic selection. The monitor readout shows the active pattern, palette family, timing, and holds. Automation settings, favourites, and Hold choices save with scenes, JSON, and share/OBS URLs; the current automatic selection and Next-button history are temporary session state. Older scenes default to Original timing, all patterns enabled, and both holds off.

Pixel scale is a browser extension: the source's `thickness = 2` constant is unused, and is not an original hardware control. Musical automation, holds, Next, and favourites are also browser extensions. Stretching is independent of browser fullscreen. Common scanlines and inversion apply, while ASCII and lyric settings remain separate. Capture sizes, PNG export, pause, and `Escape` support this mode.

The supplied [pixelmusic950.spin](Temp/pixelmusic950.spin) credits **Tarikh Korula for Uncommon Projects, January 2008**. The [Parallax Graphics.spin driver](https://github.com/parallaxinc/propeller/blob/master/libraries/community/p1/All/Ciphers/Graphics.spin) confirms the sprite rotation, transparent pixels, overwrite order, and square/rounded pixel-width behavior. This is a browser approximation: RMS-based stereo levels replace 35-sample ADC averages, RGB palettes approximate the original composite-video colours, and a nominal browser frame clock replaces the hardware's drawing-loop timing. Seeded delays approximate its random one-eighth-second timing steps; the source starts with a one-second wait and subsequently chooses 0.125–4 seconds, with changes gated by the audio level. It does not emulate Propeller instruction timing, ADC circuitry, or a television's colour response.

## Controls

The menu shows the collapsible sections and individual controls relevant to the active mode. Text and ASCII texture controls appear in **Text mode**; native picture controls appear in **Video synthesizer mode**. The available sections include:

- **Text**: lyrics, phrases, markup parsing, and word splitting
- **ASCII Mask / Stencil**: pasted ASCII art masks, reveal modes, and mask scale
- **Core**: seed, BPM, colour mode, and seed locking
- **Visual Texture**: background engine, character set, and custom glyphs
- **Display**: shared invert, scanlines, and scanline strength, spacing, and thickness controls
- **Timing**: beat timing, word motion, palette, bar length, transitions, beat flash, MIDI sync, and auto sections
- **Performance**: quality, FPS limit, lyric mode, capture size, recording mode, stage HUD, and fullscreen behavior
- **Intensity**: glyph size, word density, glitch, word halo, legibility, and background-only mode
- **Utilities**: tap tempo, fullscreen, share URL, OBS URL, frame save, panic look, and MIDI connection
- **Scenes & Presets**: scene slots, built-in defaults, randomizers, and scene JSON
- **Audio Reactive**: audio source, connection, sensitivity, attack/release, noise gate, response selection, and stereo level/clipping meters
- **Atari Video Music · C-240**: signal source, stereo gain and contour, colour, shape, arrays, automatic scanning, and optional screen stretching (shown in Atari mode)
- **Video Music 2 · Extended studio**: display ratio, geometry, stereo response, colour, trails, symmetry, and motion (shown in Video Music 2 mode)
- **NetHack · Dungeon machine**: signal source, layout, depth, population, movement, fog, palette, symbol glow, audio dynamics, and camera (shown in NetHack synthesizer mode)
- **Pixelmusic 3000**: signal source, pattern, palette, change timing, Hold/Next, favourites, stereo gain, animation speed, pixel scale, and optional screen stretching

Under **Display**, enable **Scanlines** and adjust strength (0–40%), spacing (2–12 pixels), and thickness (10–75% of the spacing). The thickness range leaves a clear gap between lines. The defaults—8% strength, 4-pixel spacing, and 25% thickness (1 pixel)—preserve the previous look. These settings apply to preview, playback, and PNG export in every mode, travel with scenes and presets, and fall back to those defaults when loading older scenes. Turning scanlines off preserves the slider values.

Unavailable options are disabled while keeping their settings. The BPM/mode/FPS readout, **Live preview** toggle, and **Refresh preview** button stay at the top while scrolling through setup. Utilities and scene slots adapt to narrow screens. **Fullscreen** toggles browser fullscreen. During playback, pointer movement, a tap, or keyboard focus reveals **Menu** and **Pause / Resume** controls; touch devices keep them visible.

## Keyboard Shortcuts

- `Escape`: return to menu
- `Space`: enable menu preview motion, or pause playback; focused buttons and section headings keep their normal activation
- `Ctrl+Enter` / `Cmd+Enter`: start from the menu
- `ArrowUp` / `ArrowDown`: nudge BPM
- `Shift+ArrowUp` / `Shift+ArrowDown`: nudge BPM by 5
- `B`: toggle background-only mode (Text mode)
- `H`: toggle word halo (Text mode)
- `I`: toggle invert
- `S`: toggle scanlines
- `M`: cycle word motion (Text mode)
- `T`: tap tempo from the menu
- `0`: apply panic look (Text mode)
- `1`-`8`: recall scene slots during playback

Scene shortcuts also work from setup buttons; typing in text fields keeps its normal behavior. Both the number row and number pad are supported. Empty slots leave the current scene unchanged. Scene status messages appear only in setup, without playback popups. While paused, selecting a saved scene displays it immediately and keeps playback paused.

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
- **Import JSON file** loads a single scene or scene bank from a file.

Both import actions automatically save scenes in this browser and report whether saving succeeded. The selected saved scene and interval settings are restored when you reopen the app. Invalid imports leave the existing bank and pasted JSON intact. Browser storage belongs to the page's location; export a scene bank to move it between browsers or copies of the app.

The importer also accepts copied share URLs containing `#preset=`. Scenes created before the visualizer selector import and recall as ASCII, even when a newer mode is currently selected; older NetHack text backgrounds migrate to the NetHack video synthesizer. Unicode lyrics and masks survive JSON and share URL round-trips.

Name a scene in **Scene name**, then use **Store scene** to save the name and settings. Names are optional `sceneName` fields inside the existing flat preset objects; scene and bank exports keep their existing version 2 wrappers. Older unnamed scenes, version 1/2 banks, raw presets, and share URLs still import. Missing names display as **Scene 1**, **Scene 2**, etc. Older app versions can ignore the new field and read the remaining settings.

The status beside the name shows whether the current scene has unsaved changes. **Revert to saved** recalls the selected stored scene. Global locked fields are excluded from this comparison because they are held separately from the recalled scene. The indicator does not autosave edits; use **Store scene** to commit them.

**Global locks** keep current tempo (including beat rate, bar/section length, and MIDI sync), lyrics (including parsing/sections), palette (including colour mode and inversion), or performance (quality, FPS, glyph size, capture size, recording mode) while recalling scenes or applying looks. Imports save the complete imported scene while keeping locked controls in place. Lock choices and their current values are remembered in this browser. Explicitly storing a scene saves the current controls, including locked values.

**Slide effect** offers Crossfade, Wipe left, Slide left, and Zoom dissolve, with a duration from 0.1 to 5 seconds. Effects use a snapshot of the outgoing scene while the incoming scene animates. **Transition** still chooses when the change starts: immediately, next beat, or next bar. The existing **Beat fade** setting now uses a crossfade when no other effect is selected. Pausing freezes an effect; selecting a scene while paused applies it immediately. Reduced-motion preferences disable these effects.

## Audio Reactive

Choose **Microphone / audio input** or **Shared tab / system audio**, then click **Connect audio** and use the browser's permission picker. For tab/system audio, choose a source that supports audio and enable **Share audio**. Availability depends on the browser and selected source; a share without an audio track produces a message and can be retried. Browser capture requires a supported secure page context, such as localhost or HTTPS (Chrome also supports local files).

**Sensitivity** adjusts the strength of the visual response. The combined meter and separate **Left**/**Right** meters show the smoothed response; per-channel clipping indicators briefly light when the captured signal approaches full scale. Mono inputs feed both channels, while stereo remains independent.

| Control | Effect |
| --- | --- |
| Attack | 1–250 ms, default 20 ms; how quickly the response rises |
| Release | 20–2000 ms, default 120 ms; how quickly it falls |
| Noise gate | −70 to −10 dBFS, default −42 dBFS; suppresses quieter input before sensitivity is applied |
| Response | Full signal, Bass, Mids, Treble, or Transients; selects what drives text intensity and the Atari, Video Music 2, and Pixelmusic stereo envelopes |

Bass covers roughly 30–250 Hz, mids 250–2500 Hz, and treble 2500–16000 Hz. Transients emphasize sudden increases in level. NetHack always uses its separate bass/mid/treble lighting mappings, so its Response selector is disabled. Response selection affects connected audio; silent demo signals keep their own behavior. Attack/release use elapsed time so changes in analysis timer frequency do not change their time constants.

**Response** travels with scenes, JSON, and share/OBS URLs; older scenes use Full signal. Sensitivity, attack, release, gate, and input-source preference are remembered as local setup settings. No saved setting opens an audio connection. Word and dungeon timing continue to follow BPM/MIDI; this feature does not estimate tempo. Use live preview or playback to see it respond. Audio is analysed locally, never played back or recorded by the app, and requires an explicit connection each time the page opens. **Disconnect** releases the input and clears the meters. Returning to setup keeps an existing connection available; closing the page releases it.

Enable **Interval Mode** in **Scenes & Presets** and set the interval in minutes (0.1 to 1440). **Go** starts at the selected saved slot (or the first saved slot if the selection is empty), advances in slot order, skips empty slots, and wraps around. The selected transition controls whether changes happen immediately or at the next beat/bar. Pause freezes the timer; manual scene recall restarts it. With no saved scenes, the current look keeps playing. Interval settings are remembered separately from saved scene presets.

Live preview caches parsed lyrics, masks, and settings until controls change. Canvas rendering avoids redundant colour assignments and skips shadow-colour updates when glow is off. Paused playback stops requesting animation frames.

## OBS / Recording

Use **Copy OBS URL** to generate a capture-friendly URL that opens directly into playback. Recording mode can pin capture dimensions such as `1920 x 1080`, `1080 x 1920`, `1280 x 720`, or `720 x 720`.

PNG exports use those exact pixel dimensions on high-DPI displays and include the current inversion and scanlines. Atari and Pixelmusic output fit their 4:3 pictures unless their **Stretch to fill screen** setting is enabled; Video Music 2 uses its selected aspect ratio within the export dimensions. Native NetHack output uses the selected whole-map or follow camera within the capture area.

## MIDI Sync

Chrome supports Web MIDI on compatible systems. Use **Connect MIDI**, choose an input, then enable **MIDI tempo sync**. MIDI clock messages can drive tempo, and MIDI start/stop messages can start or stop playback.

Incoming tempo also updates the menu preview. Selecting **No MIDI input** detaches clock messages. While playback is paused, clock messages and BPM nudges preserve its frozen beat position. MIDI **Start** restarts and resumes a paused display; **Continue** resumes from its paused position. Keyboard tempo and inversion changes are remembered when their global locks are enabled.

## Privacy And Security

ASCII BPM Cycler runs entirely in the browser. It does not require a backend and does not send lyrics, presets, MIDI data, or scene JSON anywhere by itself.

Stored scenes live in browser `localStorage`. Imported scene JSON is size-limited and normalized before it is applied to controls.

## Browser Support

This project is designed for current Google Chrome. Other browsers may render the visuals, but Web MIDI and some fullscreen/clipboard behavior may vary.

## Development

The app uses ordered classic scripts so opening `index.html` directly still works without a build step or module server. `app.js` only starts the app; implementation lives in `js/`:

- `index.html`: app structure and controls
- `styles.css`: UI, stage, and preview styling
- `app.js`: event binding and startup sequence
- `js/app-data.js`: fonts, character sets, palettes, help text, and built-in looks
- `js/app-state.js`: control references, defaults, shared state, and persistence field lists
- `js/app-core.js`: option collection, parsing, deterministic helpers, and quality settings
- `js/app-text.js`: text backgrounds, masks, word layout, and ASCII colour rendering
- `js/app-render.js`: renderer dispatch, canvas presentation, scanlines, and preview lifecycle
- `js/app-scenes.js`: scene storage, normalization, JSON import/export, setup persistence, locks, and transitions
- `js/app-transport.js`: playback, pause, BPM, MIDI, fullscreen, and interval timing
- `js/app-export.js`: share/OBS URLs and PNG capture
- `js/app-audio.js`: capture lifecycle, stereo analysis, envelopes, gate, meters, and signal routing
- `js/app-ui.js`: contextual controls, readouts, keyboard shortcuts, and event handlers
- `js/atari-video-music.js`: Atari Video Music signal model and canvas renderer
- `js/video-music-2.js`: extended geometry, aspect ratios, palettes, motion, and trails
- `js/nethack-visualizer.js`: original seeded dungeon generation, discrete beat-driven exploration, and ASCII grid/canvas rendering
- `js/pixelmusic-3000.js`: Pixelmusic stereo scalars, indexed pixel patterns, palettes, automation, and native rendering

Keep the script order in `index.html`: synth engines first, then data/state, application functions, and finally startup. Application scripts share the bindings declared in `app-state.js`; the four synth engines each expose their own renderer object. Distribute the entire `js/` directory alongside `index.html`, `styles.css`, and `app.js`.

Open `index.html` directly after editing to test changes.

On Windows with Chrome installed, run `powershell -NoProfile -ExecutionPolicy Bypass -File tests/scene-regression.ps1` to check scene shortcuts, imports, storage failure handling, and persistence across reloads using a temporary browser profile.

Run the same command with `-TestScript performance-features.js` for legacy/named imports, dirty state, locks, slide effects, and simulated audio signal/lifecycle checks. Actual microphone and shared-audio permissions require an interactive browser check.

Use `-TestScript atari-video-music.js` for Atari stereo shape logic, narrow Hole/Ring edge coverage, automatic scanning, native rendering, PNG export, preset compatibility, and simulated stereo capture.

Use `-TestScript render-modes.js` for the Text / Video synthesizer selector, mode-specific controls and shortcuts, independent video signals, Atari stretching, and stereo ring colours.

Use `-TestScript nethack-visualizer.js` for the dungeon generator, ASCII synthesizer integration, source-informed symbols and movement, audio response, migration of older text scenes, saved presets, and exports.

Use `-TestScript ui-regression.js` for responsive menus and playback, audio and automation controls at narrow widths, visible control labels, keyboard activation, touch controls, pause/resume, and focus restoration.

Use `-TestScript pixelmusic-3000.js` for Pixelmusic patterns, original random-sequence compatibility, beat/bar timing, Hold/Next, favourites, stereo response, preview/playback continuity, presets, rendering, and exports.

Use `-TestScript audio-controls.js` for attack/release timing, gating, stereo and antiphase input, band routing, clipping, capture cancellation, scene response settings, and setup persistence.

Use `-TestScript display-controls.js` for scanline controls, legacy defaults, persistence, and PNG output.

Use `-TestScript video-music-2.js` for the extended mode's controls, rendering, aspect ratios, saved scenes, and exports. Use `-TestScript project-regression.js` for legacy imports, paused tempo, MIDI transport and preview, input selection, locked keyboard shortcuts, Unicode shares, exact PNG capture, and automatic preview refresh after audio disconnect. Automated audio and MIDI checks use simulated browser APIs; actual device permission pickers and hardware connections need an interactive check.

## License

The app, including its original NetHack-inspired JavaScript, uses the MIT License. See `LICENSE` for details. The supplied NetHack reference source retains its own copyright notices and [NetHack General Public License](Temp/NetHack-NetHack-5.0.0_Released/dat/license); the app's MIT license does not replace those terms.
