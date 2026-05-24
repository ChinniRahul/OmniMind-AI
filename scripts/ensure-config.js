import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetPath = path.resolve(__dirname, "../src/firebase-applet-config.json");

if (!fs.existsSync(targetPath)) {
  const fallback = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: "",
    firestoreDatabaseId: ""
  };
  fs.writeFileSync(targetPath, JSON.stringify(fallback, null, 2));
  console.log("OmniMind: Created fallback 'src/firebase-applet-config.json' successfully.");
} else {
  console.log("OmniMind: 'src/firebase-applet-config.json' exists. Skipping fallback generation.");
}
