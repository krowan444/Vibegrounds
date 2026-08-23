import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';

const Section = ({ title, children }) => (
  <div className="retro-panel" style={{ marginTop: '16px' }}>
    <div className="section-header"><h2>{title}</h2></div>
    {/* The Rules are several screens of solid paragraphs — the single
        longest read on the site, and the one page where somebody is trying
        to understand rather than browse. */}
    <div className="retro-panel-body vg-prose vg-prose-soft">
      {children}
    </div>
  </div>
);

export default function RulesPage() {
  return (
    <>
      <SiteHeader compact />
      <div className="profile-page" style={{ paddingBottom: '40px' }}>

        <div className="retro-panel">
          <div className="section-header"><h2>📜 The House Rules</h2></div>
          <div className="retro-panel-body vg-prose">
            <p style={{
              color: 'var(--orange)', fontFamily: 'var(--font-retro)', fontSize: '24px',
            }}>
              Be weird. Be experimental. Be unfinished.
            </p>
            <p style={{ marginTop: '8px' }}>
              VibeGrounds is built on the old internet: the bit where you made something
              strange at 2am and put it up because you could. That spirit needs almost no
              rules — but it does need a few, because a handful of people always try to
              ruin it for everybody else.
            </p>
          </div>
        </div>

        <Section title="✅ Post Whatever You Made">
          <p>Games, AI movies, software, websites, art, audio, half-broken experiments — all welcome.</p>
          <p>Rough round the edges is fine. Prototypes are fine. One-nighters are fine.</p>
          <p>Nobody here expects a finished product. Ship it and see what people think.</p>
        </Section>

        <Section title="🚫 The Short List of Things That Get You Removed">
          <p><strong style={{ color: 'var(--red)' }}>Hate speech, slurs and bigotry.</strong> Racism, homophobia, transphobia, misogyny and the rest. Permanent ban, first offence, no appeal worth writing. This is the one we care about most.</p>
          <p style={{ marginTop: '8px' }}><strong style={{ color: 'var(--red)' }}>Harassment.</strong> Going after a specific person, doxxing, pile-ons, threats.</p>
          <p style={{ marginTop: '8px' }}><strong style={{ color: 'var(--red)' }}>Malware, scams and phishing.</strong> Every link gets checked when reported.</p>
          <p style={{ marginTop: '8px' }}><strong style={{ color: 'var(--red)' }}>Spam.</strong> Vibe Coins exist partly to make this uneconomical. Do not test it.</p>
          <p style={{ marginTop: '8px' }}><strong style={{ color: 'var(--red)' }}>Stolen work.</strong> Do not post someone else&#39;s project as your own.</p>
          <p style={{ marginTop: '8px' }}><strong style={{ color: 'var(--red)' }}>Sexual content involving minors, or anything illegal.</strong> Reported to the relevant authorities, not just removed.</p>
        </Section>

        <Section title="🚩 Reporting">
          <p>Every submission, comment and forum post has a 🚩 Report button. Use it. It goes straight to a moderator queue that a human reads.</p>
          <p>Reports are anonymous to the person you are reporting. Filing obviously bad-faith reports to harass someone is itself a bannable offence.</p>
        </Section>

        <Section title="⚖️ Voting Fairly">
          <p>Vote 0–5 on what you actually think of the work. You cannot vote on your own submissions.</p>
          <p>Scores use a weighted average, so a few generous votes from friends will not lift something to the top of the All-Time chart. Getting there takes real support from real people.</p>
          <p>Vote manipulation — alt accounts, vote rings, begging in DMs — voids your scores and can cost you your account.</p>
        </Section>

        <Section title="🪙 Vibe Coins">
          <p>Everyone gets 50 Vibe Coins free once they confirm their email. Posting costs 10.</p>
          <p>That is five submissions before you spend anything. Top-ups are optional and exist to keep the lights on and make spam expensive.</p>
          <p>Vibe Coins have no cash value and cannot be transferred or cashed out.</p>
        </Section>

        <Section title="🛡️ How Moderation Actually Works">
          <p>A report is reviewed by a human. Depending on what we find, we might remove the content, issue a temporary ban, or permanently remove the account and everything it posted.</p>
          <p>Every action is written to a moderation log. We are trying to run this transparently, not arbitrarily.</p>
          <p>If you think we got it wrong, reply to the email you receive and say so. We do read them.</p>
        </Section>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link to="/upload" className="retro-cta" style={{ display: 'inline-block' }}>
            🚀 GOT IT — LET ME POST SOMETHING
          </Link>
        </div>
      </div>
    </>
  );
}
