"use strict";

// All modules are loaded synchronously by index.html before initialization.
bindUIEvents();
loadSceneSlots();
loadSetup();
initHistory();
loadPresetFromUrl();
resetHistoryBaseline();
updateSliderReadouts();
applyTooltips();
syncToolUI();
initWorkspace();
initAudioSetup();
initMidiTransport();
initGallery();
initLiveProtection();
schedulePreview();
