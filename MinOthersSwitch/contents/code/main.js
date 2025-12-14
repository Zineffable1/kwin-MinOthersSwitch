// Single Active Window - KWin Script for Plasma 6 Wayland

let lastNormalWindow = null;
let configDialogOpen = false;
let lastMainWindowBeforeDialog = null; //Track last main window before dialog

const skipDock = readConfig("skipDock", true);
const skipDialogs = readConfig("skipDialogs", true);
const restoreOnClose = readConfig("restoreOnClose", true);

workspace.windowActivated.connect(function(activeClient) {
  // Read fresh config values every time


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
      // Skip empty/invisible windows from dialog check
      if (!win.caption || win.caption.trim() === "") {
        continue;
      }
      if (win.modal || win.dialog || win.popupWindow || win.transient) {
        hasDialog = true;
        break;
      }
    }

    // Don't minimize if any dialog exists
    if (hasDialog) return;

    // Don't minimize if active window is transient
    if (activeClient.transient) {
      return;
    }
  }
  //////////////////////////////////
  // Store as last normal window (for restoration when closed)
  if (activeClient.normalWindow &&
    !activeClient.specialWindow &&
    !activeClient.dock &&
    !activeClient.desktopWindow) {

    // Check if this might be a dialog (small window)
    // If it's small and there's a window from same app that was just active, it's likely a dialog
    let isLikelyDialog = false;

  if (skipDialogs) {
    // Original line runs only if skipDialogs is true
    if (lastNormalWindow && activeClient.minSize && lastNormalWindow.minSize) {
      isLikelyDialog = activeClient.minSize.toString().split(",")[0] !== lastNormalWindow.minSize.toString().split(",")[0];
    }
  } else {
    // Config is false, treat as not a dialog
    isLikelyDialog = false;
  }

  if (skipDialogs && isLikelyDialog && lastNormalWindow && lastNormalWindow.resourceClass === activeClient.resourceClass) {
    // This is likely a dialog from the same app as the last main window
    // Store the main window so we don't minimize it
    lastMainWindowBeforeDialog = lastNormalWindow;
  } else {
    // This is a main window or not related to previous window
    lastNormalWindow = activeClient;
    lastMainWindowBeforeDialog = null; // Reset dialog tracking
  }
    }

    // Minimize all other windows
    for (let i = 0; i < allWindows.length; i++) {
      const win = allWindows[i];

      if (win === activeClient) continue;
      if (!win.normalWindow) continue;
      if (win.minimized) continue;

      // Skip dialog windows if configured
      if (skipDialogs) {
        if (win.dialog || win.modal || win.popupWindow || win.transient) {
          continue;
        }
      }

      // If this window is the main window we saved before a dialog opened, don't minimize it
      if (lastMainWindowBeforeDialog && win === lastMainWindowBeforeDialog) {
        continue;
      }

      win.minimized = true;
    }
});

// Reset configDialogOpen when window is removed (in case dialog closes abnormally)
workspace.windowRemoved.connect(function(removedClient) {
  if (!removedClient) return;


  // Read config to check if restoration is enabled
  if (!restoreOnClose) {
    if (lastNormalWindow === removedClient) {
      lastNormalWindow = null;
    }
    return;
  }

  // Check if the removed window was our tracked active window
  if (lastNormalWindow === removedClient) {
    const allWindows = workspace.windowList();
    let newActive = null;

    // Find the most recently used normal window (excluding the removed one)
    const stackingOrder = workspace.stackingOrder || allWindows;

    for (let i = stackingOrder.length - 1; i >= 0; i--) {
      const win = stackingOrder[i];

      // Skip if this is the removed window
      if (win === removedClient) continue;

      // Basic checks
      if (!win.normalWindow) continue;
      if (win.specialWindow || win.dock || win.desktopWindow) continue;
      if (skipDialogs && (win.dialog || win.modal || win.popupWindow || win.transient)) continue;

      // Skip minimized windows in first pass
      if (win.minimized) {
        if (!newActive) {
          newActive = win; // Store as backup
        }
        continue;
      }

      // Found a visible candidate
      newActive = win;
      break;
    }

    // If we only found minimized windows, unminimize one
    if (newActive && newActive.minimized) {
      newActive.minimized = false;
      workspace.activeWindow = newActive;
    } else if (newActive && !newActive.minimized) {
      workspace.activeWindow = newActive;
    }

    // Update tracking
    if (newActive && newActive !== removedClient) {
      lastNormalWindow = newActive;
    } else {
      lastNormalWindow = null;
    }
  }

  // If the removed window was the dialog, reset the tracking
  if (removedClient === lastMainWindowBeforeDialog) {
    lastMainWindowBeforeDialog = null;
  }
});
