/**
 * Landing interactions:
 *   1. Smooth-scroll for in-page anchors
 *   2. Auto-fill the footer year
 *   3. Multiple waitlist forms wired to Supabase REST
 *   4. Sticky mobile CTA — hidden while a form is in view
 *
 * The Supabase anon key is intentionally public — bundled in the app already,
 * RLS on `waitlist` restricts it to insert-only.
 */

const SUPABASE_URL = 'https://oljzqoznxqbuocdykmpw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sanpxb3pueHFidW9jZHlrbXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMDgyMzAsImV4cCI6MjA4Nzg4NDIzMH0.vLU9iHgDNi1xrtHcR4yROdiMeaftK0XaSizNmHF7w8M';

// Footer year
const yearEl = document.getElementById('footer-year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Smooth scroll for same-page anchors
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (!targetId || targetId === '#') return;
        const target = document.querySelector(targetId);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // If linking to a CTA section, auto-focus the first email field inside it
        const input = target.querySelector('input[type="email"]');
        if (input) {
            setTimeout(() => input.focus({ preventScroll: true }), 500);
        }
    });
});

// Wire every waitlist form on the page
function wireWaitlistForm(form) {
    if (!form) return;
    // Convention: form id `xxx-cta` pairs with status id `xxx-status`.
    // Legacy/feature pages use `xxx-form` paired with `xxx-status`.
    const statusId = form.id
        ? form.id.replace(/-cta$/, '-status').replace(/-form$/, '-status').replace(/^notify-form/, 'notify-status')
        : null;
    const status = statusId ? document.getElementById(statusId) : null;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const input = form.querySelector('input[type="email"]');
        const submitBtn = form.querySelector('button[type="submit"]');
        if (!input || !submitBtn) return;

        const email = input.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setStatus(status, 'Please enter a valid email address.', 'error');
            return;
        }

        submitBtn.disabled = true;
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Submitting...';
        setStatus(status, '', '');

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal',
                },
                body: JSON.stringify({ email, source: 'landing' }),
            });

            if (res.ok) {
                setStatus(status, "You're on the list. We'll email you at launch.", 'success');
                input.value = '';
                celebrate();
            } else if (res.status === 409) {
                setStatus(status, "You're already on the list. Hang tight.", 'success');
                input.value = '';
            } else {
                const body = await res.text();
                console.error('Waitlist signup failed:', res.status, body);
                setStatus(status, "Couldn't sign you up. Try again or email us.", 'error');
            }
        } catch (err) {
            console.error(err);
            setStatus(status, "Network error. Check your connection and try again.", 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

// Wire every waitlist form on the page (covers homepage + sub-pages)
document.querySelectorAll('form.hero-form, form.notify-form').forEach(wireWaitlistForm);

function setStatus(el, message, type) {
    if (!el) return;
    el.textContent = message;
    el.className = el.className.replace(/\b(success|error)\b/g, '').trim();
    if (type) el.classList.add(type);
}

// Sticky mobile CTA — hide while any CTA section is on screen so we don't double-stack
const stickyBtn = document.querySelector('.sticky-cta-mobile');
const ctaSections = document.querySelectorAll('#cta, .final-cta, .hero-conv');
if (stickyBtn && ctaSections.length && 'IntersectionObserver' in window) {
    let visibleCount = 0;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) visibleCount++;
            else visibleCount--;
        });
        visibleCount = Math.max(0, visibleCount);
        stickyBtn.classList.toggle('hidden', visibleCount > 0);
    }, { threshold: 0.2 });
    ctaSections.forEach((s) => observer.observe(s));
}

// Tiny celebration on successful signup
function celebrate() {
    const colors = ['#0F8C5C', '#2D6CDF', '#E8A623', '#7C57E0', '#E76A55'];
    const count = 20;
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:50%;bottom:30%;pointer-events:none;z-index:9999;';
    document.body.appendChild(container);

    for (let i = 0; i < count; i++) {
        const dot = document.createElement('span');
        const angle = Math.PI * (i / count) - Math.PI / 2;
        const speed = 180 + Math.random() * 180;
        const x = Math.cos(angle) * speed * (Math.random() - 0.5) * 2;
        const y = -Math.abs(Math.sin(angle)) * speed - Math.random() * 80;
        const color = colors[i % colors.length];

        dot.style.cssText = `
            position:absolute;
            left:0;bottom:0;
            width:10px;height:10px;border-radius:50%;
            background:${color};
            transform:translate(0,0);
            transition: transform 1s cubic-bezier(0.22, 1, 0.36, 1), opacity 1s;
            opacity:1;
        `;
        container.appendChild(dot);

        requestAnimationFrame(() => {
            dot.style.transform = `translate(${x}px, ${y}px)`;
            dot.style.opacity = '0';
        });
    }

    setTimeout(() => container.remove(), 1100);
}
