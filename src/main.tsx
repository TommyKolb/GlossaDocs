import { createRoot } from "react-dom/client";
import App from "./app/App";
import { getGoogleFontsStylesheetUrl } from "./app/utils/language-fonts";
import "./styles/index.css";

const googleFontsHref = getGoogleFontsStylesheetUrl();
const existingFontsLink = document.querySelector<HTMLLinkElement>(
  `link[data-glossadocs-fonts="true"][href="${googleFontsHref}"]`
);
if (!existingFontsLink) {
  const fontsLink = document.createElement("link");
  fontsLink.rel = "stylesheet";
  fontsLink.href = googleFontsHref;
  fontsLink.setAttribute("data-glossadocs-fonts", "true");
  document.head.appendChild(fontsLink);
}

createRoot(document.getElementById("root")!).render(<App />);