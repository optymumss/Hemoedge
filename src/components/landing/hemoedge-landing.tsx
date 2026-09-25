"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

const FORM_ENDPOINT = "https://formspree.io/f/mdeneawz";

const ROLE_OPTIONS = [
  "Biomedical Scientist",
  "Medical Laboratory Scientist / Technologist",
  "Trainee / Student",
  "Training Lead or Educator",
  "Laboratory Manager",
  "Haematologist / Clinician",
  "Other",
];

function WaitlistForm({ id, onDark = false }: { id: string; onDark?: boolean }) {
  return (
    <div className={`form-card${onDark ? " on-dark" : ""}`}>
      <p className="form-title">Register your interest</p>
      <form id={id} noValidate>
        <div className="field-row">
          <input className="field" type="text" name="name" placeholder="Full name" autoComplete="name" required />
          <input className="field" type="email" name="email" placeholder="Work email" autoComplete="email" required />
        </div>
        <div className="field-row">
          <select className="field" name="role" required defaultValue="">
            <option value="">Your role</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
          <input className="field" type="text" name="country" placeholder="Country" autoComplete="country-name" />
        </div>
        <input className="field" type="text" name="organisation" placeholder="Organisation (optional)" style={{ marginBottom: 11 }} />
        <input type="text" name="_gotcha" style={{ display: "none" }} tabIndex={-1} autoComplete="off" />
        <button className="btn" type="submit">
          Join the waitlist
        </button>
        <div className="form-msg" role="status" aria-live="polite" />
        <p className="form-note">
          We will contact you about early access and pilot opportunities. No marketing lists, and you can ask to be removed at any time.
        </p>
      </form>
    </div>
  );
}

export function HemoedgeLanding() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* mobile menu */
    const toggle = root.querySelector<HTMLButtonElement>("#navToggle");
    const panel = root.querySelector<HTMLDivElement>("#navLinks");
    function setOpen(open: boolean) {
      if (!toggle || !panel) return;
      panel.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
    function onToggleClick() {
      setOpen(!panel?.classList.contains("open"));
    }
    function onPanelClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "A") setOpen(false);
    }
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape" && panel?.classList.contains("open")) {
        setOpen(false);
        toggle?.focus();
      }
    }
    function onDocClick(e: MouseEvent) {
      if (!panel?.classList.contains("open")) return;
      const target = e.target as Node;
      if (!panel.contains(target) && !toggle?.contains(target)) setOpen(false);
    }
    function onResize() {
      if (window.innerWidth > 940) setOpen(false);
    }

    toggle?.addEventListener("click", onToggleClick);
    panel?.addEventListener("click", onPanelClick);
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("click", onDocClick);
    window.addEventListener("resize", onResize);

    /* smooth-scroll for in-page anchor links (nav, brand mark, CTA button) */
    const navAnchors = root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]');
    function onNavAnchorClick(e: Event) {
      const href = (e.currentTarget as HTMLAnchorElement).getAttribute("href");
      if (!href || href === "#") return;
      const anchor = root!.querySelector(href);
      if (!anchor) return;
      e.preventDefault();
      anchor.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
    }
    navAnchors.forEach((a) => a.addEventListener("click", onNavAnchorClick));

    /* footer year */
    const yr = root.querySelector("#yr");
    if (yr) yr.textContent = String(new Date().getFullYear());

    /* waitlist forms */
    function wireForm(form: HTMLFormElement | null) {
      if (!form) return;
      const msg = form.querySelector<HTMLDivElement>(".form-msg");
      const btn = form.querySelector<HTMLButtonElement>("button[type=submit]");
      if (!msg || !btn) return;

      function onSubmit(e: Event) {
        e.preventDefault();
        msg!.className = "form-msg";
        msg!.textContent = "";

        const data = new FormData(form!);
        const name = String(data.get("name") || "").trim();
        const email = String(data.get("email") || "").trim();
        const role = String(data.get("role") || "");

        if (!name || !email || !role) {
          msg!.className = "form-msg err";
          msg!.textContent = "Please add your name, email and role so we know who to contact.";
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          msg!.className = "form-msg err";
          msg!.textContent = "That email address does not look right. Please check it.";
          return;
        }

        btn!.disabled = true;
        const original = btn!.textContent;
        btn!.textContent = "Sending…";

        fetch(FORM_ENDPOINT, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new FormData(form!),
        })
          .then((r) => {
            if (r.ok) {
              form!.reset();
              msg!.className = "form-msg ok";
              msg!.textContent = "You are on the list. We will be in touch as early access opens.";
            } else {
              msg!.className = "form-msg err";
              msg!.textContent = "That did not send. Please email projects@optymumss.com instead.";
            }
          })
          .catch(() => {
            msg!.className = "form-msg err";
            msg!.textContent = "That did not send. Please email projects@optymumss.com instead.";
          })
          .then(() => {
            btn!.disabled = false;
            btn!.textContent = original;
          });
      }

      form.addEventListener("submit", onSubmit);
      return () => form.removeEventListener("submit", onSubmit);
    }
    const cleanupWaitlist1 = wireForm(root.querySelector("#waitlist"));
    const cleanupWaitlist2 = wireForm(root.querySelector("#waitlist2"));

    /* reveal-on-scroll */
    let io: IntersectionObserver | null = null;
    const revealEls = root.querySelectorAll<HTMLElement>(".rv");
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add("in");
              io?.unobserve(en.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
      );
      revealEls.forEach((el) => io?.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add("in"));
    }

    return () => {
      toggle?.removeEventListener("click", onToggleClick);
      panel?.removeEventListener("click", onPanelClick);
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("resize", onResize);
      navAnchors.forEach((a) => a.removeEventListener("click", onNavAnchorClick));
      cleanupWaitlist1?.();
      cleanupWaitlist2?.();
      io?.disconnect();
    };
  }, []);

  return (
    <div className="hemoedge-landing" ref={rootRef} style={{ background: "var(--lp-cream)", color: "var(--lp-navy)" }}>
      {/* reusable logo */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <symbol id="hemoedge-logo" viewBox="0 0 566 150">
          <rect className="logo-tube-stroke" x="7" y="11" width="39" height="128" rx="7" fill="none" strokeWidth="4" />
          <rect className="logo-tube-stroke" x="65" y="11" width="39" height="128" rx="7" fill="none" strokeWidth="4" />
          <path className="logo-tube-fill" d="M11 97h31v35a7 7 0 01-7 7H18a7 7 0 01-7-7z" />
          <path className="logo-tube-fill" d="M69 97h31v35a7 7 0 01-7 7H76a7 7 0 01-7-7z" />
          <rect className="logo-tube-mark" x="16" y="52" width="17" height="3.5" rx="1.7" />
          <rect className="logo-tube-mark" x="74" y="52" width="17" height="3.5" rx="1.7" />
          <circle className="logo-halo" cx="55.5" cy="80" r="26" />
          <circle cx="55.5" cy="80" r="21.5" fill="#7A0018" />
          <circle cx="49" cy="73.5" r="9.5" fill="#B01A2E" />
          <text x="116" y="112" fontFamily="Montserrat,system-ui,sans-serif" fontSize="88" fontWeight="700" letterSpacing="-2">
            <tspan className="logo-word-red">emo</tspan>
            <tspan className="logo-word-navy">Edge</tspan>
          </text>
        </symbol>
      </svg>

      {/* ============ NAV ============ */}
      <nav className="nav" aria-label="Primary">
        <div className="nav-in">
          <a className="brand" href="#top" aria-label="HemoEdge home">
            <svg className="logo" viewBox="0 0 566 150" role="img">
              <title>HemoEdge</title>
              <use href="#hemoedge-logo" />
            </svg>
          </a>
          <div className="nav-links" id="navLinks">
            <a href="#about">About</a>
            <a href="#platform">Platform</a>
            <a href="#tutor">AI tutor</a>
            <a href="#who">Who it&apos;s for</a>
            <a href="#reach">Reach</a>
            <Link href="/blog">Blog</Link>
            <Link href="/team">Team</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/login">Sign in</Link>
          </div>
          <div className="nav-right">
            <a className="nav-cta" href="#join">
              <span className="cta-long">Join the waitlist</span>
              <span className="cta-short">Join</span>
            </a>
            <button className="nav-toggle" id="navToggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="navLinks">
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header className="hero sec-cream" id="top">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">In development · 2026</p>
            <h1>
              Blood cell morphology skills should not depend on which staff are working, which slides are available, or{" "}
              <em>whether an expert has time to teach.</em>
            </h1>
            <p className="hero-sub">
              HemoEdge is a whole slide imaging platform for blood cell morphology training and competency, built specifically for the
              laboratory workforce. It brings together consultant haematologist-reviewed cases, guided annotations, a manual differential
              counter, structured competency tools and an AI tutor grounded in curated HemoEdge content. Being built for the frontline
              professionals trusted to report blood films.
            </p>
          </div>

          <div>
            <WaitlistForm id="waitlist" />
          </div>
        </div>
      </header>

      {/* ============ ABOUT ============ */}
      <section className="sec sec-lift" id="about">
        <div className="narrow">
          <div className="rv" style={{ marginBottom: "clamp(30px,4vw,46px)" }}>
            <p className="eyebrow">Our story</p>
            <h2 className="display h2">About HemoEdge</h2>
          </div>

          <div className="essay rv">
            <p className="first">
              HemoEdge was founded by scientists who were fortunate to be trained by experienced haematology consultants and senior
              laboratory professionals.
            </p>

            <p className="beat">That kind of training stays with you.</p>

            <p>
              The careful questioning at the microscope. The explanation behind a finding. The moment someone helps you see what you were
              missing. The confidence that grows when expert supervision turns uncertainty into understanding.
            </p>

            <p>But we also recognise that this level of access is becoming harder to provide.</p>

            <p>
              Consultants, senior scientists and training leads are under increasing pressure. Their time is stretched across clinical
              service, reporting demands, supervision, governance and workforce challenges. In many laboratories, the opportunity for
              regular one-to-one consultant morphology teaching is becoming less available, not because the value has reduced, but
              because the system has become harder to sustain.
            </p>

            <p className="beat">We noticed this with concern.</p>

            <p>
              Training can vary significantly from one laboratory to another. Some trainees are exposed to excellent teaching and a wide
              range of cases. Others may depend on whichever blood films happen to arrive during their placement or training period.
            </p>

            <p className="beat">And in morphology, exposure matters.</p>

            <p>
              Rare cases do not arrive on schedule. Good teaching slides are not always available when learners need them. Physical
              slides degrade over time. Valuable cases can be lost, stored away or seen only by a small number of people before the
              opportunity passes.
            </p>

            <p>At the same time, modern technology has created a new possibility.</p>

            <p>
              Digitised blood films, whole slide imaging, structured annotation, online learning and AI-supported educational tools now
              make it possible to preserve valuable morphology cases, make training more consistent and support learners beyond the
              limitations of place, time and slide availability.
            </p>

            <p className="beat">That is why we decided to build HemoEdge.</p>

            <p>
              HemoEdge brings together consultants, scientists, educators and digital expertise to create a structured morphology
              training and competency platform built around real scientists&apos; learning needs in the laboratory.
            </p>

            <p>
              It is designed to support the people who report blood films, the training leads responsible for developing competence and
              the laboratories working hard to prepare staff for modern diagnostic practice.
            </p>

            <div className="essay-close">
              <p style={{ marginBottom: 0 }}>
                Our aim is to make expert-style morphology teaching more accessible, consistent and scalable, so more laboratory
                professionals can build confidence, sharpen their judgement and learn from high-quality cases wherever they are.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ PLATFORM ============ */}
      <section className="sec sec-cream" id="platform">
        <div className="wrap">
          <div className="sec-head rv">
            <p className="eyebrow">The platform</p>
            <h2 className="display h2">The film is the classroom</h2>
            <p className="lede">
              HemoEdge turns digitised blood films into interactive learning environments, with annotated features, guided explanations
              and practical teaching shaped by consultant haematologists.
            </p>
          </div>

          <div className="feat-grid rv">
            <div className="feat">
              <svg className="feat-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <circle cx="20" cy="20" r="15" stroke="#8B0016" strokeWidth="1.6" />
                <circle cx="20" cy="20" r="5.5" fill="#F3E4E6" stroke="#0B1440" strokeWidth="1.2" />
                <path d="M20 5v4M20 31v4M5 20h4M31 20h4" stroke="#0B1440" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <h3>WSI viewer with differential counter</h3>
              <p>
                Navigate real peripheral blood films end to end at full diagnostic magnification, with a built-in manual differential
                counter so you can perform and record a count exactly as you would at the bench.
              </p>
            </div>
            <div className="feat">
              <svg className="feat-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <rect x="5" y="8" width="13" height="13" rx="1.5" stroke="#0B1440" strokeWidth="1.5" />
                <rect x="22" y="8" width="13" height="13" rx="1.5" stroke="#0B1440" strokeWidth="1.5" />
                <rect x="5" y="25" width="13" height="9" rx="1.5" stroke="#8B0016" strokeWidth="1.5" />
                <rect x="22" y="25" width="13" height="9" rx="1.5" stroke="#8B0016" strokeWidth="1.5" />
              </svg>
              <h3>Feature library</h3>
              <p>
                Cropped, labelled images of individual abnormal cells and inclusions, so a feature can be studied in isolation before it
                is found in context.
              </p>
            </div>
            <div className="feat">
              <svg className="feat-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <circle cx="16" cy="17" r="9" stroke="#8B0016" strokeWidth="1.6" />
                <path d="M23 24l10 10" stroke="#0B1440" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M12 17h8M16 13v8" stroke="#0B1440" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <h3>Guided annotation</h3>
              <p>Overlays that point to what matters on the field and explain the reasoning behind the interpretation, not just the answer.</p>
            </div>
            <div className="feat">
              <svg className="feat-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <path d="M8 30V17M16 30V10M24 30v-9M32 30V14" stroke="#0B1440" strokeWidth="2" strokeLinecap="round" />
                <path d="M6 34h28" stroke="#8B0016" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <h3>Competency tracking</h3>
              <p>Structured progression across morphology topics, with a record of what has been covered and where accuracy still drops.</p>
            </div>
            <div className="feat">
              <svg className="feat-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <rect x="4" y="10" width="23" height="20" rx="2.5" stroke="#0B1440" strokeWidth="1.5" />
                <path d="M27 18l9-5v14l-9-5z" stroke="#8B0016" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M13 16v8l7-4z" fill="#8B0016" />
              </svg>
              <h3>Video and audio narration</h3>
              <p>
                Modules include both video and audio, so you can watch an expert walk through a microscope setup or simply listen to a
                film interpretation while you move around the slide yourself.
              </p>
            </div>
            <div className="feat">
              <svg className="feat-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <path d="M9 20l7 7 15-15" stroke="#8B0016" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M31 20v11a2 2 0 01-2 2H11a2 2 0 01-2-2V11a2 2 0 012-2h13" stroke="#0B1440" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <h3>Case-based assessment</h3>
              <p>Quizzes built from real films with clinical context and full explanations, designed to test reasoning rather than recall.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ AI TUTOR ============ */}
      <section className="sec sec-lift" id="tutor">
        <div className="wrap">
          <div className="sec-head rv">
            <p className="eyebrow">AI learning support</p>
            <h2 className="display h2">An AI tutor that teaches from HemoEdge content, not the open internet</h2>
            <p className="lede" style={{ marginBottom: "1em" }}>
              The HemoEdge AI tutor is designed to support morphology learning inside a controlled educational environment.
            </p>
            <p className="lede" style={{ marginBottom: "1em" }}>
              It does not search the open internet for answers. Instead, it draws from HemoEdge&apos;s own curated teaching notes,
              morphology feature library, case context, annotations and quiz explanations, then uses a modern language model to explain
              the material clearly.
            </p>
            <p className="lede">The result is an AI tutor built for structured learning.</p>
          </div>

          <div className="why-grid">
            <div className="rv">
              <p className="why-label">Why it matters</p>
              <div className="why">
                <h3>Grounded in expert-reviewed morphology content</h3>
                <p>Built on curated educational material reviewed by practising consultant haematologists.</p>
              </div>
              <div className="why">
                <h3>Designed to develop reasoning, not just give answers</h3>
                <p>The tutor can guide learners through the features they should assess before revealing the conclusion.</p>
              </div>
              <div className="why">
                <h3>Aware of the case in front of the learner</h3>
                <p>It can respond in context, using the specific case, field, annotation or quiz explanation the learner is working through.</p>
              </div>
            </div>

            <div className="rv">
              <p className="why-label">Example interaction</p>
              <div className="chat">
                <div className="chat-bar">
                  <span className="chat-dot"></span> HemoEdge AI tutor · Case 042
                </div>
                <div className="chat-body">
                  <div className="msg you">
                    <span className="msg-who">You</span>Is this a reactive lymphocyte or a blast?
                  </div>
                  <div className="msg ai">
                    <span className="msg-who">Tutor</span>Before I answer, let&apos;s work through it. Start with the
                    nucleus-to-cytoplasm ratio, chromatin pattern and nucleoli. What are you seeing in each?
                  </div>
                  <div className="msg you">
                    <span className="msg-who">You</span>The chromatin looks fairly open, and there might be a nucleolus.
                  </div>
                  <div className="msg ai">
                    <span className="msg-who">Tutor</span>Good observation. Now look closely at the cytoplasm. Notice how it moulds
                    around neighbouring red cells and how basophilic the periphery appears. Does that push you more towards a reactive
                    lymphocyte or a blast?
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="tutor-close rv">
            HemoEdge AI tutor is built to make expert-style morphology teaching more accessible, structured and scalable.
          </p>
        </div>
      </section>

      {/* ============ WHO IT IS FOR ============ */}
      <section className="sec sec-cream" id="who">
        <div className="wrap">
          <div className="sec-head rv">
            <p className="eyebrow">Who it is for</p>
            <h2 className="display h2">Built for the frontline professionals trusted with blood film reporting.</h2>
            <p className="lede">
              HemoEdge is not designed as an exam revision platform for medical doctors. It is being built for laboratory professionals,
              with content shaped around practical morphology training, competency sign-off and the day-to-day realities of diagnostic
              laboratory work.
            </p>
          </div>

          <div className="aud-grid rv">
            <div className="aud">
              <span>Bench</span>
              <strong>Biomedical scientists</strong>
            </div>
            <div className="aud">
              <span>Department</span>
              <strong>Haematology laboratory staff</strong>
            </div>
            <div className="aud">
              <span>Bench</span>
              <strong>Medical laboratory technologists</strong>
            </div>
            <div className="aud">
              <span>Early career</span>
              <strong>Laboratory trainees and students</strong>
            </div>
            <div className="aud">
              <span>Bench</span>
              <strong>Medical laboratory scientists</strong>
            </div>
            <div className="aud">
              <span>Leadership</span>
              <strong>Educators and training leads</strong>
            </div>
          </div>
        </div>
      </section>

      {/* ============ REACH ============ */}
      <section className="sec sec-lift" id="reach">
        <div className="wrap">
          <div className="sec-head rv">
            <p className="eyebrow">Reach</p>
            <h2 className="display h2">Built in the UK. Designed for global impact.</h2>
            <p className="lede" style={{ marginBottom: "1em" }}>
              HemoEdge is starting where the standards are high, the training demands are clear and the need is immediate: UK laboratory
              practice.
            </p>
            <p className="lede" style={{ marginBottom: "1em" }}>
              Our first release is being shaped around UK haematology departments, university biomedical science programmes and the
              training leads responsible for helping staff build competence with confidence.
            </p>
            <p className="lede">But the problem HemoEdge addresses does not stop at the UK border.</p>
          </div>

          <div className="geo-grid rv">
            <div className="geo">
              <h3>United Kingdom</h3>
              <p className="geo-tag">Our first market and foundation</p>
              <p>
                HemoEdge is being built with the realities of UK NHS training in mind: limited supervisor time, increasing workload
                pressure, variable exposure to morphology, and the need for structured, evidence-based sign-off.
              </p>
              <p>It gives training departments a clearer way to support learning, assess progress and build confidence in blood film morphology.</p>
            </div>
            <div className="geo">
              <h3>Africa</h3>
              <p className="geo-tag">A market where the need is urgent</p>
              <p>
                In many settings, expert morphology supervision is limited, yet the consequences of diagnostic uncertainty can be
                significant. HemoEdge is being designed with this reality in mind.
              </p>
              <p>
                That means accessible, image-based training that can work on modest bandwidth, because in these environments, bandwidth
                is not a technical detail. It is a product requirement.
              </p>
            </div>
            <div className="geo">
              <h3>India &amp; Beyond</h3>
              <p className="geo-tag">A large and growing laboratory workforce</p>
              <p>
                Across India and other international markets, there is strong demand for structured, English-language, image-based
                morphology training that can support students, early-career scientists and laboratory professionals at scale.
              </p>
              <p>HemoEdge is being built to meet that demand.</p>
            </div>
          </div>

          <div className="reach-close rv">
            <p>Starting in the UK gives HemoEdge a firm foundation.</p>
            <p>Designing for global access gives it purpose.</p>
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="cta" id="join">
        <div className="wrap cta-grid">
          <div className="rv">
            <p className="eyebrow on-dark">Early access</p>
            <h2>
              Be one of the first
              <br />
              laboratories <em>on it.</em>
            </h2>
            <p className="lede on-dark">
              We are looking for scientists, training leads and departments willing to shape the platform while it is still being built.
              Tell us who you are and we will be in touch about pilot access.
            </p>
          </div>
          <div className="rv">
            <WaitlistForm id="waitlist2" onDark />
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="foot">
        <div className="wrap">
          <p className="foot-legal">
            HemoEdge is an educational platform currently being developed by Optymum SS (UK) Ltd. It is not a medical device. All case
            materials are intended strictly for training and educational purposes only.
          </p>
          <p className="foot-copy">
            &copy; <span id="yr">2026</span> HemoEdge. For enquiries, contact us at <a href="mailto:projects@optymumss.com">projects@optymumss.com</a>.
          </p>
        </div>
      </footer>
    </div>
  );
}
