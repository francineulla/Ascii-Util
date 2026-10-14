"use strict";

// All modules are loaded synchronously by index.html before initialization.
bindUIEvents();
loadSceneSlots();
loadSetup();
loadPresetFromUrl();
updateSliderReadouts();
applyTooltips();
syncToolUI();
schedulePreview();
