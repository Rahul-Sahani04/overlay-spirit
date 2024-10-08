const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  screen,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { createWriteStream } = require("fs");
const OpenAI = require("openai");

require("dotenv").config();

const token = process.env.GITHUB_TOKEN;

const endpoint = "https://models.inference.ai.azure.com";
const modelName = "gpt-4o";

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: 250,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      enableRemoteModule: false,
    },
    x: width - 250,
    y: height - 325,
  });

  win.loadFile("index.html");

  // Send log messages to the renderer process
  ipcMain.on("log-message", (event, message) => {
    win.webContents.send("log-message", message);
  });
}

/**
 * Get the data URL of an image file.
 * @param {string} imageFile - The path to the image file.
 * @param {string} imageFormat - The format of the image file. For example: "jpeg", "png".
 * @returns {string} The data URL of the image.
 */
function getImageDataUrl(imageFile, imageFormat) {
  try {
    const imageBuffer = fs.readFileSync(imageFile);
    const imageBase64 = imageBuffer.toString("base64");
    return `data:image/${imageFormat};base64,${imageBase64}`;
  } catch (error) {
    console.error(`Could not read '${imageFile}'.`);
    console.error(
      "Set the correct path to the image file before running this sample."
    );
    process.exit(1);
  }
}

// Handle the capture-screenshot event from the renderer process
ipcMain.handle("capture-screenshot", async () => {
  try {
    // ipcMain.emit("log-message", null, "Capturing screenshot...");

    const sources = await desktopCapturer.getSources({ types: ["screen"] });
    const screenSource = sources[0]; // You can select the source you want here

    const imagePath = path.join(app.getPath("temp"), "screenshot.png");
    const writeStream = createWriteStream(imagePath);

    const image = screenSource.thumbnail.toPNG(); // Get the PNG image from the screen source
    writeStream.write(image);
    writeStream.end();

    return new Promise((resolve, reject) => {
      writeStream.on("finish", async () => {
        console.log("Screenshot saved: ", imagePath);
        // ipcMain.emit("log-message", null, `Screenshot saved: ${imagePath}`);
        const response = await sendImageToAI(imagePath);
        resolve(response);
      });
      writeStream.on("error", (error) => {
        console.error("Error saving screenshot: ", error);
        ipcMain.emit("log-message", null, `Error saving screenshot: ${error}`);
        reject(error);
      });
    });
  } catch (error) {
    console.error("Error capturing screenshot: ", error);
    ipcMain.emit("log-message", null, `Error capturing screenshot: ${error}`);
    throw error; // Propagate the error
  }
});

// Function to send image to AI
async function sendImageToAI(imagePath) {
  const client = new OpenAI({ baseURL: endpoint, apiKey: token });

  try {
    const imageDataUrl = getImageDataUrl(imagePath, "png");

    //   ipcMain.emit("log-message", null, `Sending image to AI: ${imageDataUrl}`);

    const response = await client.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that motivates and guides the user. You are supposed to provide a response based on the image. Give short and concise answers. Do not provide long answers. Keep it simple. Do not provide unnecessary information. Do not provide information that is not in the image. Do not provide information that is not asked for. Jokes are allowed, and humor is encouraged. Be creative and have fun! Keep your responses between 1-3 sentences. \n
            \n Example responses: 'Awesome! You look great!', 'You are doing great!', 'You are amazing!', 'Your coding skills are on point!', 'You are a coding genius!', 'You are a coding wizard!', 'You are a coding rockstar!', 'You are a coding ninja!', 'You are a coding superhero!', 'You are a coding legend!', 'You are a coding master!', 'You are a coding expert!', 'You are a coding pro!', 'You are a coding guru!', 'You are a coding champion!', 'You are a coding whiz!', 'You are a coding ace!', 'You are a coding boss!', 'You are a coding king!', 'You are a coding queen!', 'You are a coding god!', 'You are a coding goddess!', 'You are a coding diva!', 'You are a coding star!', 'You are a coding icon!', 'You are a coding hero' \n
            \n Or more like: 'You seem to be in trouble with your code. Let me help you with that.', 'Mind using AI for that?', 'I can help you with that'`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Provide a response based on the image." },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
                details: "low",
              },
            },
          ],
        },
      ],
      model: modelName,
      // images: [{ image_url: { url: imageDataUrl } }],
    });

    ipcMain.emit(
      "log-message",
      null,
      `AI response: ${response.choices[0].message.content}`
    );

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error sending image to AI: ", error);
    ipcMain.emit("log-message", null, `Error sending image to AI: ${error}`);
    return null;
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
