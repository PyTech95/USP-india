import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, ArrowLeft, ArrowRight } from "lucide-react";
import { HtmlDiv } from "./editor/HtmlDiv";
import { Photo } from "./Photo";
import { media } from "../../lib/api";

const Title = ({ data, id, editable }) => <h2 className="h2 about-title" data-testid={`${id}-heading`} {...editable("heading")}>{data.heading}</h2>;
const Copy = ({ html, id, ed }) => <HtmlDiv className="prose" data-testid={id} {...ed} html={html || ""} />;

export const AboutHero = ({ data, first, id, editable }) => {
  const Heading = first ? "h1" : "h2";
  return <div className="about-hero" data-testid="about-hero">
    <Heading className="h1 about-title" data-testid={`${id}-heading`} {...editable("heading")}>{data.heading}</Heading>
  </div>;
};

export const AboutIntroduction = ({ data, id, editable }) => <section className="about-intro-column" data-testid={id}>
  <Copy html={data.body_html} id={`${id}-body`} ed={editable("body_html")} />
</section>;

// A team member's story ("Full story" in the admin), blank line = new paragraph.
const storyOf = (person) => String(person?.bio || "").split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);

export const AboutTeam = ({ data, id, editable }) => {
  const [open, setOpen] = useState(null);
  const people = data.items || [];
  return <section className="about-core" data-testid={id}>
    <div className="about-inner">
      <Title data={data} id={id} editable={editable} />
      <div className="about-team-grid" data-testid="about-team-grid">
        {people.map((person, i) => <article className="about-team-member" data-testid={`about-team-member-${i}`} key={i}>
          <Photo ref_={person.image} crop="3/4" cropMobile="3/4" className="about-team-portrait" sizes="(min-width: 1440px) 350px, (min-width: 701px) 27vw, 85vw" testid={`${id}-person-${i}-image`} ed={editable(`items.${i}.image`)}
            overlay={storyOf(person).length ? <button type="button" className="about-team-more" onClick={() => setOpen(i)} aria-label={`Read more about ${person.name || "this team member"}`} aria-haspopup="dialog" data-testid={`${id}-person-${i}-more`}><Plus size={22} strokeWidth={1.6} aria-hidden="true" /></button> : null} />
          <h3 className="about-person-name" data-testid={`${id}-person-${i}-name`} {...editable(`items.${i}.name`)}>{person.name}</h3>
          <p className="about-person-intro" data-testid={`${id}-person-${i}-intro`} {...editable(`items.${i}.intro`)}>{person.intro}</p>
        </article>)}
      </div>
    </div>
    <TeamStory people={people} label={data.heading} at={open} onShow={setOpen} id={id} />
  </section>;
};

// The pop-up with a team member's photo and story; the arrows (and ← → keys) go to the next person.
function TeamStory({ people, label, at, onShow, id }) {
  const withStory = people.map((p, i) => (storyOf(p).length ? i : -1)).filter((i) => i >= 0);
  const person = at === null ? null : people[at];
  const pic = person?.image?.media;
  const k = withStory.indexOf(at);
  const prev = k > 0 ? withStory[k - 1] : withStory[withStory.length - 1];
  const next = k < withStory.length - 1 ? withStory[k + 1] : withStory[0];
  const many = withStory.length > 1;
  return <Dialog.Root open={!!person} onOpenChange={(o) => { if (!o) onShow(null); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="team-story-overlay" data-testid="team-story-overlay" />
      <Dialog.Content className="team-story" aria-describedby={undefined} data-testid="team-story"
        onKeyDown={(e) => { if (!many) return; if (e.key === "ArrowRight") onShow(next); if (e.key === "ArrowLeft") onShow(prev); }}>
        {person && <>
          {/* the whole photo, uncropped: the column takes the picture's own shape */}
          <div className="team-story-photo" style={pic?.width && pic?.height ? { "--ar": `${pic.width} / ${pic.height}` } : undefined}>
            {pic ? <img src={media(pic.src)} srcSet={(pic.srcs || []).map((s) => `${media(s.url)} ${s.w}w`).join(", ") || undefined} sizes="(min-width: 761px) 600px, 100vw"
              width={pic.width} height={pic.height} alt={person.image.alt ?? pic.alt ?? ""} data-testid={`${id}-story-image`} /> : <div className="team-story-noimage" />}
          </div>
          <div className="team-story-text">
            {label && <p className="team-story-label">{label}</p>}
            <Dialog.Title className="team-story-name" data-testid="team-story-name">{person.name}</Dialog.Title>
            {person.intro && <p className="team-story-intro">{person.intro}</p>}
            <span className="team-story-rule" aria-hidden="true" />
            <div className="team-story-bio" data-testid="team-story-bio">{storyOf(person).map((t, n) => <p key={n}>{t}</p>)}</div>
            {many && <nav className="team-story-nav" aria-label="Other team members">
              <button type="button" onClick={() => onShow(prev)} data-testid="team-story-prev"><ArrowLeft size={16} aria-hidden="true" /> <span>{people[prev]?.name}</span></button>
              <button type="button" onClick={() => onShow(next)} data-testid="team-story-next"><span>{people[next]?.name}</span> <ArrowRight size={16} aria-hidden="true" /></button>
            </nav>}
          </div>
        </>}
        <Dialog.Close className="team-story-close" aria-label="Close" data-testid="team-story-close"><X size={20} aria-hidden="true" /></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

export const AboutApproach = ({ data, id, editable }) => <section className="about-approach" data-testid={id}>
  <div className="about-approach-copy">
    <Title data={data} id={id} editable={editable} />
    <Copy html={data.body_html} id={`${id}-body`} ed={editable("body_html")} />
  </div>
  <aside className="about-principles" aria-label="Our principles" data-testid="about-principles" {...editable("_principles")}>
    <ul>{(data.values || []).map((value, i) => <li key={i}><span data-testid={`${id}-principle-${i}`} {...editable(`values.${i}.text`)}>{value.text}</span></li>)}</ul>
  </aside>
</section>;