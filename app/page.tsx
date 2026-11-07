import type { Metadata } from "next";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CheckCheck, CircleDot, GitPullRequest, Inbox, Layers3, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import WaitlistForm from "@/components/waitlist-form";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Context · Less chasing. More resolving.",
  description: "Turn scattered customer signals into clear decisions. Context brings the issue, the evidence, and the next step together. Join the early-access waitlist.",
};

function Brand() {
  return <span className={styles.brand}><span className={styles.brandMark} aria-hidden="true"><i /><i /><i /></span>context<span className={styles.brandPeriod}>.</span></span>;
}

export default function Page() {
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className={styles.header}>
        <a href="/" aria-label="Context home"><Brand /></a>
        <nav className={styles.nav} aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#why-context">Why Context</a>
        </nav>
        <a className={styles.dashboardButton} href="/context">Open dashboard <ArrowUpRight size={16} aria-hidden="true" /></a>
      </header>

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="hero-title">
          <a className={styles.announcement} href="#waitlist"><span />Built for the work between teams <ArrowRight size={13} aria-hidden="true" /></a>
          <h1 id="hero-title">Every customer signal.<br />A little more <em>context.</em></h1>
          <p className={styles.heroDescription}>24/7 Customer Support for your system</p>
          <div id="waitlist" className={styles.waitlist}><WaitlistForm /></div>
          <a href="#product-preview" className={styles.exploreLink}>Less chasing. More resolving. <ArrowDown size={14} aria-hidden="true" /></a>
        </section>

        <section id="product-preview" className={styles.previewSection} aria-label="Context dashboard preview">
          <div className={styles.previewCaption}><span><span className={styles.liveDot} /> THE BIG PICTURE, IN ONE PLACE</span><span>YOUR TEAM’S NEXT CHAPTER</span></div>
          <div className={styles.preview}>
            <div className={styles.previewBar}><Brand /><span className={styles.previewBreadcrumb}>Workspace <span>/</span> Issue overview</span><span className={styles.demoBadge}>Illustrative preview</span></div>
            <div className={styles.previewBody}>
              <aside className={styles.previewSidebar} aria-label="Preview sections">
                <div className={styles.workspaceLabel}><span>O</span> Orbit workspace</div>
                <div className={styles.sidebarActive}><Layers3 size={16} aria-hidden="true" /> Overview</div>
                <div><Inbox size={16} aria-hidden="true" /> Customer signals <span>8</span></div>
                <div><CircleDot size={16} aria-hidden="true" /> Issues <span>2</span></div>
                <div><CheckCheck size={16} aria-hidden="true" /> Follow-through</div>
                <p>LESS NOISE.<br />MORE CONTEXT.</p>
              </aside>
              <div className={styles.previewContent}>
                <div className={styles.previewHeading}><div><span className={styles.overline}>YOUR CUSTOMER OPERATIONS, CONNECTED</span><h2>Every issue. In context.</h2><p>The evidence, the next step, and the people it matters to.</p></div><span className={styles.status}><span /> Needs your review</span></div>
                <div className={styles.caseGrid}>
                  <article className={styles.caseCard}>
                    <div className={styles.caseTop}><span className={styles.caseIcon}><MessageSquare size={18} aria-hidden="true" /></span><span>CUSTOMER EXPERIENCE</span><span>01</span></div>
                    <h3>A double charge.<br />Not a double workload.</h3>
                    <p>Customer history and billing evidence, already brought together.</p>
                    <div className={styles.evidence}><span><Check size={13} aria-hidden="true" /> Customer context collected</span><span><Check size={13} aria-hidden="true" /> Refund prepared for review</span></div>
                    <div className={styles.caseBottom}><span className={styles.avatar}>AL</span><span>Anna’s billing issue</span><span className={styles.reviewBadge}>Review ready</span></div>
                  </article>
                  <article className={styles.caseCard}>
                    <div className={styles.caseTop}><span className={`${styles.caseIcon} ${styles.blueIcon}`}><GitPullRequest size={18} aria-hidden="true" /></span><span>ENGINEERING HANDOFF</span><span>02</span></div>
                    <h3>From “it’s broken”<br />to a clearer next step.</h3>
                    <p>The report, reproduction steps, and a proposed fix. All in one case.</p>
                    <div className={styles.evidence}><span><Check size={13} aria-hidden="true" /> Related reports connected</span><span><Check size={13} aria-hidden="true" /> Proposed patch ready for review</span></div>
                    <div className={styles.caseBottom}><span className={`${styles.avatar} ${styles.blueAvatar}`}>MK</span><span>Marc’s checkout issue</span><span className={styles.reviewBadge}>Review ready</span></div>
                  </article>
                </div>
                <div className={styles.previewFoot}><span><ShieldCheck size={15} aria-hidden="true" /> You approve the actions. Context keeps the thread.</span><a href="/context">Explore the workspace <ArrowUpRight size={14} aria-hidden="true" /></a></div>
              </div>
            </div>
          </div>
          <div className={styles.previewNote}><span>From first report to verified recovery.</span><span>Sample scenarios. No live calls, refunds, or deployments.</span></div>
        </section>

        <section id="how-it-works" className={styles.howSection}>
          <div className={styles.sectionIntro}><span className={styles.overline}>FROM SIGNAL TO RESOLUTION</span><h2>Less lost in translation.<br /><em>More moving forward.</em></h2><p>Customer support, engineering, and the people making decisions. Finally, on the same page.</p></div>
          <div className={styles.steps}>
            <article><span className={styles.stepNumber}>01 / CONNECT</span><MessageSquare size={25} aria-hidden="true" /><h3>Start with the signal.</h3><p>Bring the customer’s report and the missing details into one shared case.</p></article>
            <article><span className={styles.stepNumber}>02 / UNDERSTAND</span><Layers3 size={25} aria-hidden="true" /><h3>See the whole story.</h3><p>Connect related issues, customer impact, and evidence before deciding what to do.</p></article>
            <article><span className={styles.stepNumber}>03 / FOLLOW THROUGH</span><CheckCheck size={25} aria-hidden="true" /><h3>Close the loop.</h3><p>Review the next step, track the handoff, and confirm the outcome with the customer.</p></article>
          </div>
        </section>

        <section id="why-context" className={styles.closing}>
          <div><span className={styles.overline}><Sparkles size={15} aria-hidden="true" /> CONTEXT, NOT JUST ANOTHER INBOX</span><h2>Your team has enough tabs.<br /><em>Give them the full picture.</em></h2></div>
          <div className={styles.closingAction}><a className={styles.primaryButton} href="#waitlist">Join the waitlist <ArrowRight size={17} aria-hidden="true" /></a><p>Get an early look at a calmer way to work.</p></div>
        </section>
      </main>
      <footer className={styles.footer}><a href="/" aria-label="Context home"><Brand /></a><p>Customer operations. With context.</p><a href="/context">Open dashboard <ArrowUpRight size={15} aria-hidden="true" /></a></footer>
    </div>
  );
}
