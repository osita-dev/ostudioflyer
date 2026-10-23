import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// PWA: register the service worker (production only — vite-plugin-pwa skips
// dev, so HMR and the dev bridge are unaffected). autoUpdate means a new
// version activates on the next visit; failures are silent here because an
// unregistered SW is a non-issue (the app still works, just not cached).
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);
