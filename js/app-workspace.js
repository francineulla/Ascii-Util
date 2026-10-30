"use strict";

// Layout observation keeps the monitor below the toolbar at every window size.
function updateWorkspace() {
  const toolbar = document.querySelector(".title-row");
  if (!toolbar) return;
  document.documentElement.style.setProperty("--toolbar-height", `${Math.ceil(toolbar.getBoundingClientRect().height)}px`);
  document.documentElement.style.setProperty("--preview-ratio", `${window.innerWidth} / ${window.innerHeight}`);
  const scene = state.scenes[state.selectedSceneSlot - 1];
  const name = controls.sceneName.value.trim();
  const dirty = document.getElementById("sceneDirty").classList.contains("unsaved");
  document.getElementById("workspaceScene").textContent = scene
    ? `${state.selectedSceneSlot} · ${name || "Untitled scene"}${dirty ? " · Edited" : ""}`
    : name || "Unsaved look";
}

function initWorkspace() {
  const toolbar = document.querySelector(".title-row");
  if (typeof ResizeObserver === "function") new ResizeObserver(updateWorkspace).observe(toolbar);
  const observer = new MutationObserver(updateWorkspace);
  observer.observe(document.getElementById("sceneDirty"), { childList: true, attributes: true });
  controls.menu.addEventListener("input", updateWorkspace);
  controls.menu.addEventListener("change", updateWorkspace);
  window.addEventListener("resize", updateWorkspace);
  updateWorkspace();
}
