const { contextBridge, ipcRenderer, desktopCapturer } = require("electron");

// Capture a screenshot and send it to the main process for AI analysis
async function captureScreen() {
    return ipcRenderer.invoke("capture-screenshot");
}

// Expose functionality to the renderer (frontend) process
contextBridge.exposeInMainWorld("electronAPI", {
    captureScreen: async () => {
        const response = await captureScreen();
        return response;
    },
    onLogMessage: (callback) => {
        ipcRenderer.on("log-message", (event, message) => {
            callback(message);
        });
    }
});