import { useEffect, useState } from "react";
import "./App.css";
import Sidebar, { type Section } from "./components/Sidebar";
import Daily from "./views/Daily";
import Notes from "./views/Notes";
import Summary from "./views/Summary";

export default function App() {
  const [section, setSection] = useState<Section>("daily");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement;
      if (typing) {
        (el as HTMLElement).blur();
        return;
      }
      setSection("daily");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => setSection("daily");

  return (
    <div className="app">
      <Sidebar active={section} onSelect={setSection} />
      <main className="content">
        <Daily />
        {section !== "daily" && (
          <>
            <div className="backdrop" onClick={close} />
            <section className="overlay" key={section}>
              {section === "notes" && <Notes onClose={close} />}
              {section === "summary" && <Summary onClose={close} />}
            </section>
          </>
        )}
      </main>
    </div>
  );
}