import { useCallback, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Play, X } from "lucide-react";

// Only site files (/films/…) or web addresses can be played.
const safe = (url) => (/^(\/(?!\/)|https?:\/\/)/i.test(String(url || "").trim()) ? String(url).trim() : "");

// "Watch An Excerpt": a play button under a text section that opens the film in a pop-up
// (Admin → Pages → the section → Film fields). While editing, a click selects the label to edit.
export function FilmLink({ url, poster, label, eyebrow, title, id, ed = {} }) {
  const [open, setOpen] = useState(false);
  // start the film once, as the pop-up opens (the click allows sound); if a browser still refuses, its play
  // button is there. Stable, so a re-render never restarts a film the viewer paused.
  const start = useCallback((video) => { if (video) { const p = video.play(); if (p && p.catch) p.catch(() => {}); } }, []);
  const src = safe(url);
  if (!src) return null;
  const show = () => { if (!document.body.classList.contains("live-editing")) setOpen(true); };
  return (
    <div className="film-link-row">
      <button type="button" className="film-link" onClick={show} aria-haspopup="dialog" data-testid={`${id}-film`} data-edit-group="action" {...ed}>
        <span className="film-link-icon" aria-hidden="true"><Play size={18} fill="currentColor" strokeWidth={0} /></span>
        <span className="film-link-label" data-edit-text>{label || "Watch An Excerpt"}</span>
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="film-overlay" data-testid="film-overlay" />
          <Dialog.Content className="film-dialog" aria-describedby={undefined} data-testid="film-dialog">
            <div className="film-head">
              <div className="film-head-text">
                {eyebrow && <p className="film-eyebrow">{eyebrow}</p>}
                <Dialog.Title className="film-title">{title || label || "Film"}</Dialog.Title>
              </div>
              <Dialog.Close className="film-close" aria-label="Close" data-testid="film-close"><X size={20} aria-hidden="true" /></Dialog.Close>
            </div>
            <div className="film-frame">
              <video src={src} poster={safe(poster) || undefined} controls autoPlay playsInline preload="auto" data-testid="film-video" ref={start} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
