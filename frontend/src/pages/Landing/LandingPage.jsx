import React, { useState, lazy, Suspense, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import './LandingPage.css';

const KnowledgeGraph = lazy(() => import('../../components/common/KnowledgeGraph'));

/* ── Splash variants ── */
const splashVariants = {
  initial: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.5, ease: 'easeInOut' } },
};
const logoVariants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: {
    scale: [0.8, 1.1, 1.0, 1.08, 1.0],
    opacity: [0, 1, 1, 1, 1],
    transition: { duration: 1.4, ease: 'easeInOut' },
  },
};
const taglineVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { delay: 0.5, duration: 0.6 } },
};

/* ── Phase-2 staggered variants ── */
const navVariants = {
  hidden: { y: -100, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};
const heroTextVariants = {
  hidden: { y: 40, opacity: 0 },
  visible: (i) => ({
    y: 0,
    opacity: 1,
    transition: { delay: i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  }),
};
const heroVisualVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 1.5, ease: 'easeOut' },
  },
};
const sectionHeadingVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.6, ease: 'easeOut' } },
};
const cardVariants = {
  hidden: { y: 50, opacity: 0 },
  visible: (i) => ({
    y: 0,
    opacity: 1,
    transition: { delay: i * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};
const ctaVariants = {
  hidden: { y: 40, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.7, ease: 'easeOut' } },
};
const footerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } },
};

export default function LandingPage({ onGoLogin, onGoSignup }) {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smooth: true,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="lp-container">

      {/* ═══════════════ PHASE 1 – SPLASH SCREEN ═══════════════ */}
      <AnimatePresence>
        {!splashDone && (
          <motion.div
            className="lp-splash"
            variants={splashVariants}
            initial="initial"
            exit="exit"
            key="splash"
          >
            <motion.div
              className="lp-splash-logo-container"
              variants={logoVariants}
              initial="initial"
              animate="animate"
              onAnimationComplete={() => setSplashDone(true)}
            >
              <div className="lp-glowing-shadow"></div>
              <div className="lp-splash-logo-circle">
                <h1 className="lp-splash-logo">AssessIQ</h1>
              </div>
            </motion.div>

            <motion.p
              className="lp-splash-tagline"
              variants={taglineVariants}
              initial="initial"
              animate="animate"
            >
              Learn Smarter. Score Higher.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ PHASE 2 – MAIN CONTENT ═══════════════ */}
      {splashDone && (
        <>
          {/* ── Navbar ── */}
          <motion.nav
            className="lp-nav"
            variants={navVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="lp-nav-content lp-max-w">
              <div className="lp-logo">AssessIQ</div>

              <div className="lp-nav-links">
                <a className="lp-nav-link active" href="#features">Features</a>
                <a className="lp-nav-link" href="#how-it-works">How It Works</a>
              </div>

              <div className="lp-nav-actions">
                <a
                  className="lp-nav-link"
                  href="#"
                  onClick={(e) => { e.preventDefault(); onGoLogin(); }}
                >
                  Login
                </a>
                <button className="lp-btn-primary" onClick={onGoSignup}>
                  Get Started →
                </button>
              </div>
            </div>
          </motion.nav>

          {/* ── Hero — Split Layout ── */}
          <section className="lp-hero">
            {/* Ambient glow blobs */}
            <div className="lp-hero-blob lp-blob-1" />
            <div className="lp-hero-blob lp-blob-2" />
            <div className="lp-hero-blob lp-blob-3" />

            {/* Left — Text */}
            <div className="lp-hero-left">
              <motion.div variants={heroTextVariants} initial="hidden" animate="visible" custom={0}>
                <div className="lp-hero-badge">
                  <span className="lp-hero-badge-dot" />
                  AI-Powered Assessment Platform
                </div>
              </motion.div>

              <motion.h1 className="lp-h1" variants={heroTextVariants} initial="hidden" animate="visible" custom={1}>
                Smarter tests.<br />
                Better <span className="lp-gradient-text">outcomes.</span>
              </motion.h1>

              <motion.p className="lp-hero-sub" variants={heroTextVariants} initial="hidden" animate="visible" custom={2}>
                AssessIQ helps teachers create AI-generated tests and gives students
                real-time feedback, adaptive quizzes, and deep analytics — all in one place.
              </motion.p>

              <motion.div className="lp-hero-actions" variants={heroTextVariants} initial="hidden" animate="visible" custom={3}>
                <button className="lp-btn-primary lp-btn-lg" onClick={onGoSignup}>
                  Start for Free →
                </button>
                <button className="lp-btn-ghost lp-btn-lg" onClick={onGoLogin}>
                  Sign In
                </button>
              </motion.div>

              <motion.div className="lp-hero-proof" variants={heroTextVariants} initial="hidden" animate="visible" custom={4}>
                <div className="lp-hero-avatars">
                  {[
                    { bg: '#4F46E5', label: 'A' },
                    { bg: '#10B981', label: 'B' },
                    { bg: '#F59E0B', label: 'C' },
                    { bg: '#EF4444', label: 'D' },
                  ].map(({ bg, label }) => (
                    <div key={label} className="lp-avatar-pill" style={{ background: bg }}>
                      {label}
                    </div>
                  ))}
                </div>
                <div className="lp-proof-text">
                  <strong>2,000+ students &amp; teachers</strong>
                  already using AssessIQ
                </div>
              </motion.div>
            </div>

            {/* Right — 3D Knowledge Graph */}
            <motion.div
              className="lp-hero-right"
              variants={heroVisualVariants}
              initial="hidden"
              animate="visible"
            >
              {/* Label pills floating around the canvas */}
              <div className="lp-kg-pill lp-pill-1">🎓 Students</div>
              <div className="lp-kg-pill lp-pill-2">🏫 Teachers</div>
              <div className="lp-kg-pill lp-pill-3">📊 Analytics</div>
              <div className="lp-kg-pill lp-pill-4">🤖 AI Grading</div>

              <div className="lp-kg-wrapper">
                <Suspense fallback={<div className="lp-kg-loader">Loading…</div>}>
                  <KnowledgeGraph />
                </Suspense>
              </div>

              {/* Floating stat cards */}
              <div className="lp-hero-stat-card card-score">
                <div className="lp-stat-icon green">🎯</div>
                <div>
                  <div className="lp-stat-label">Avg. Score</div>
                  <div className="lp-stat-value">85%</div>
                </div>
              </div>

              <div className="lp-hero-stat-card card-ai">
                <div className="lp-stat-icon indigo">⚡</div>
                <div>
                  <div className="lp-stat-label">AI Graded</div>
                  <div className="lp-stat-value">1.2k tests</div>
                </div>
              </div>
            </motion.div>
          </section>

          {/* ── Features — Bento Grid ── */}
          <section className="lp-features-section" id="features">
            <div className="lp-features-inner">
              <motion.div
                className="lp-features-header"
                variants={sectionHeadingVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.4 }}
              >
                <div className="lp-section-label">Features</div>
                <h2 className="lp-h2">Everything you need to assess and succeed</h2>
                <p className="lp-section-sub">
                  Powerful AI tools wrapped in a clean, intuitive interface built for students and teachers.
                </p>
              </motion.div>

              <div className="lp-bento-grid">
                {/* Big card — AI Question Gen */}
                <motion.div
                  className="lp-bento-card lp-span2 lp-accent-card"
                  variants={cardVariants} initial="hidden" whileInView="visible"
                  viewport={{ once: true, amount: 0.2 }} custom={0}
                >
                  <div className="lp-bento-icon bg-white">🧠</div>
                  <h3 className="lp-h3">AI Question Generation</h3>
                  <p className="lp-bento-card-body">
                    Generate curriculum-aligned MCQs, short answers, and long answer questions in seconds.
                    Just set the topic, difficulty, and Bloom's taxonomy level — our AI does the rest.
                  </p>
                  <div className="lp-bento-stat-row">
                    <div className="lp-bento-stat">
                      <div className="lp-bento-stat-num">5×</div>
                      <div className="lp-bento-stat-label">Faster creation</div>
                    </div>
                    <div className="lp-bento-stat">
                      <div className="lp-bento-stat-num">100%</div>
                      <div className="lp-bento-stat-label">Curriculum aligned</div>
                    </div>
                    <div className="lp-bento-stat">
                      <div className="lp-bento-stat-num">4</div>
                      <div className="lp-bento-stat-label">Question types</div>
                    </div>
                  </div>
                </motion.div>

                {/* Card — Automated Grading */}
                <motion.div
                  className="lp-bento-card"
                  variants={cardVariants} initial="hidden" whileInView="visible"
                  viewport={{ once: true, amount: 0.2 }} custom={1}
                >
                  <div className="lp-bento-icon bg-green">✅</div>
                  <h3 className="lp-h3">Automated Grading</h3>
                  <p className="lp-bento-card-body">
                    Instant AI grading for MCQs and subjective answers. Get detailed feedback with suggested scores.
                  </p>
                  <div className="lp-bento-tags">
                    <span className="lp-bento-tag">MCQ</span>
                    <span className="lp-bento-tag">Short Answer</span>
                    <span className="lp-bento-tag">Essay</span>
                  </div>
                </motion.div>

                {/* Card — Deep Analytics */}
                <motion.div
                  className="lp-bento-card"
                  variants={cardVariants} initial="hidden" whileInView="visible"
                  viewport={{ once: true, amount: 0.2 }} custom={2}
                >
                  <div className="lp-bento-icon bg-amber">📊</div>
                  <h3 className="lp-h3">Deep Analytics</h3>
                  <p className="lp-bento-card-body">
                    Visualize student performance with rich charts. Track strengths, weaknesses, and class averages.
                  </p>
                  <div className="lp-bento-tags">
                    <span className="lp-bento-tag">Progress Tracking</span>
                    <span className="lp-bento-tag">Class Reports</span>
                  </div>
                </motion.div>

                {/* Card — Proctoring */}
                <motion.div
                  className="lp-bento-card"
                  variants={cardVariants} initial="hidden" whileInView="visible"
                  viewport={{ once: true, amount: 0.2 }} custom={3}
                >
                  <div className="lp-bento-icon bg-rose">🛡️</div>
                  <h3 className="lp-h3">Smart Proctoring</h3>
                  <p className="lp-bento-card-body">
                    Tab-switch detection, timed assessments, and anti-cheat mechanisms keep tests fair.
                  </p>
                </motion.div>

                {/* Card — Multi-role */}
                <motion.div
                  className="lp-bento-card lp-amber-card"
                  variants={cardVariants} initial="hidden" whileInView="visible"
                  viewport={{ once: true, amount: 0.2 }} custom={4}
                >
                  <div className="lp-bento-icon bg-amber">👥</div>
                  <h3 className="lp-h3">Multi-Role Platform</h3>
                  <p className="lp-bento-card-body">
                    Students, Teachers, Parents, and Admins all have dedicated dashboards tailored to their needs.
                  </p>
                </motion.div>
              </div>
            </div>
          </section>

          {/* ── CTA Section ── */}
          <motion.section
            className="lp-cta-section"
            id="how-it-works"
            variants={ctaVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
          >
            <div className="lp-cta-inner">
              <div className="lp-cta-box">
                <h2 className="lp-cta-title">Ready to transform your classroom?</h2>
                <p className="lp-cta-sub">
                  Join thousands of students and educators using AssessIQ to make learning smarter.
                </p>
                <div className="lp-cta-actions">
                  <button className="lp-btn-white" onClick={onGoSignup}>
                    Create Free Account →
                  </button>
                  <button
                    className="lp-btn-outline-white"
                    onClick={(e) => { e.preventDefault(); onGoLogin(); }}
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </div>
          </motion.section>

          {/* ── Footer ── */}
          <motion.footer
            className="lp-footer"
            variants={footerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="lp-footer-inner">
              <div className="lp-footer-logo">AssessIQ</div>
              <div className="lp-footer-links">
                <a className="lp-footer-link" href="#">Privacy Policy</a>
                <a className="lp-footer-link" href="#">Terms of Service</a>
                <a className="lp-footer-link" href="#">Support</a>
              </div>
              <div className="lp-footer-copy">© 2026 AssessIQ. All rights reserved.</div>
            </div>
          </motion.footer>
        </>
      )}
    </div>
  );
}
