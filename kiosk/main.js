const { app, BrowserWindow, globalShortcut, dialog } = require("electron");

const TARGET_URL = process.env.MIOW_URL || "http://localhost:3000/dashboard/student/quizzes";

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    kiosk: true, // OS-level kiosk mode: hides title bar, blocks closing/min
    alwaysOnTop: true, // Prevents window switching
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false,
    },
  });

  mainWindow.loadURL(TARGET_URL);

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });

  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
    }
  });

  // Teacher Emergency Exit: Ctrl+Shift+Q or Command+Shift+Q
  globalShortcut.register("CommandOrControl+Shift+Q", () => {
    const result = dialog.showMessageBoxSync(mainWindow, {
      type: "question",
      buttons: ["Cancel", "Exit Exam"],
      defaultId: 0,
      title: "Proctor / Teacher Exit",
      message: "Exit Assessment Kiosk Mode?",
      detail: "Are you sure you want to terminate the secure exam session?",
    });

    if (result === 1) {
      app.isQuitting = true;
      app.quit();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
