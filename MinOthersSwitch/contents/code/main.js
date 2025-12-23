// Single Active Window - KWin Script for Plasma 6 Wayland

let lastNormalWindow = null;
let configDialogOpen = false;
let lastMainWindowBeforeDialog = null;
const minimizedByScript = new Set(); // Track windows we minimized

const skipDock = readConfig("skipDock", true);
const skipDialogs = readConfig("skipDialogs", true);
const restoreOnClose = readConfig("restoreOnClose", true);

workspace.windowActivated.connect(function(activeClient) {
  if (!activeClient) return;

  // Skip dock/task manager if configured
  if (skipDock) {
    if (activeClient.specialWindow ||
      activeClient.dock ||
      activeClient.desktopWindow ||
      activeClient.caption === "plasmashell" ||
      activeClient.resourceClass === "plasmashell") {
      return;
    }
  }

  const allWindows = workspace.windowList();

  // Check for dialogs if configured (skip empty/invisible ones)
  if (skipDialogs) {
    let hasDialog = false;
    for (let i = 0; i < allWindows.length; i++) {
      const win = allWindows[i];
      if (!win.caption || win.caption.trim() === "") {
        continue;
      }
      if (win.modal || win.dialog || win.popupWindow || win.transient) {
        hasDialog = true;
        break;
      }
    }

    if (hasDialog) return;

    if (activeClient.transient) {
      return;
    }
  }

  // Store as last normal window (for restoration when closed)
  if (activeClient.normalWindow &&
    !activeClient.specialWindow &&
    !activeClient.dock &&
    !activeClient.desktopWindow) {

    let isLikelyDialog = false;

    if (skipDialogs) {
      if (lastNormalWindow && activeClient.minSize && lastNormalWindow.minSize) {
        isLikelyDialog = activeClient.minSize.toString().split(",")[0] !== lastNormalWindow.minSize.toString().split(",")[0];
      }
    } else {
      isLikelyDialog = false;
    }

    if (skipDialogs && isLikelyDialog && lastNormalWindow && lastNormalWindow.resourceClass === activeClient.resourceClass) {
      lastMainWindowBeforeDialog = lastNormalWindow;
    } else {
      lastNormalWindow = activeClient;
      lastMainWindowBeforeDialog = null;
    }
  }

  // Remove this window from minimized tracking if it was restored
  if (minimizedByScript.has(activeClient)) {
    minimizedByScript.delete(activeClient);
  }

  // Minimize all other windows
  for (let i = 0; i < allWindows.length; i++) {
    const win = allWindows[i];

    if (win === activeClient) continue;
    if (!win.normalWindow) continue;
    if (win.minimized) continue;

    if (skipDialogs) {
      if (win.dialog || win.modal || win.popupWindow || win.transient) {
        continue;
      }
    }

    if (lastMainWindowBeforeDialog && win === lastMainWindowBeforeDialog) {
      continue;
    }

    win.minimized = true;
    minimizedByScript.add(win); // Track that we minimized this
  }
});

workspace.windowRemoved.connect(function(removedClient) {
  if (!removedClient) return;

  // Clean up tracking
  minimizedByScript.delete(removedClient);

  if (!restoreOnClose) {
    if (lastNormalWindow === removedClient) {
      lastNormalWindow = null;
    }
    return;
  }

  // Check if the removed window was our tracked active window
  if (lastNormalWindow === removedClient) {
    // Find the most recent window from our minimized list
    const stackingOrder = workspace.stackingOrder || workspace.windowList();
    let newActive = null;

    for (let i = stackingOrder.length - 1; i >= 0; i--) {
      const win = stackingOrder[i];

      // Only restore windows that WE minimized
      if (minimizedByScript.has(win)) {
        newActive = win;
        break;
      }
    }

    // Restore the window
    if (newActive) {
      newActive.minimized = false;
      workspace.activeWindow = newActive;
      lastNormalWindow = newActive;
      minimizedByScript.delete(newActive);
    } else {
      lastNormalWindow = null;
    }
  }

  // If the removed window was the dialog, reset the tracking
  if (removedClient === lastMainWindowBeforeDialog) {
    lastMainWindowBeforeDialog = null;
  }
});
