/* Buildless portfolio: Three.js ribbons, Canvas fallback, GSAP choreography. */
const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
let manualPause = false;

let motionPaused = reducedMotion.matches || manualPause;
let redrawBackground = () => {};
let refreshMotion = () => {};

function syncThemeButton() {
  const light = root.classList.contains('light');
  const button = document.getElementById('themeToggle');
  const label = light ? 'Switch to dark mode' : 'Switch to light mode';
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', String(light));
  button.title = label;
}
function toggleTheme() {
  root.classList.toggle('light');
  try { localStorage.setItem('theme', root.classList.contains('light') ? 'light' : 'dark'); } catch (_) {}
  syncThemeButton();
  redrawBackground();
}
syncThemeButton();

function syncMotion() {
  motionPaused = reducedMotion.matches || manualPause;
  root.classList.toggle('motion-paused', motionPaused);
  refreshMotion();
}
reducedMotion.addEventListener('change', syncMotion);
syncMotion();

// Dialog: keyboard focus, Escape, backdrop closing, and scroll restoration.
const overlay = document.getElementById('modal');
const dialog = overlay.querySelector('.modal');
const profileBody = dialog.querySelector('.modal-body');
let scrollbarTimeout;
profileBody.addEventListener('scroll', () => {
  profileBody.classList.add('is-scrolling');
  clearTimeout(scrollbarTimeout);
  scrollbarTimeout = setTimeout(() => profileBody.classList.remove('is-scrolling'), 140);
}, { passive: true });
let previousFocus = null;
const pageSurfaces = [document.querySelector('main'), document.querySelector('nav'), document.querySelector('footer')];
function openModal() {
  previousFocus = document.activeElement;
  overlay.inert = false;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  pageSurfaces.forEach(el => { el.inert = true; });
  overlay.querySelector('button').focus({ preventScroll: true });
}
function closeModal() {
  overlay.classList.remove('open');
  pageSurfaces.forEach(el => { el.inert = false; });
  document.body.style.overflow = '';
  previousFocus?.focus({ preventScroll: true });
  overlay.inert = true;
  overlay.setAttribute('aria-hidden', 'true');
}
function handleOverlayClick(event) { if (event.target === overlay) closeModal(); }
document.addEventListener('keydown', event => {
  if (!overlay.classList.contains('open')) return;
  if (event.key === 'Escape') closeModal();
  if (event.key === 'Tab') {
    const items = [...dialog.querySelectorAll('button, a[href], [tabindex="0"]')];
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

// Light filaments are drawn locally. No video, framework, or WebGL dependency.
(() => {
  const canvas = document.getElementById('light-trails');
  const webgl = window.createRibbonExperience?.(canvas, {
    isLight: () => root.classList.contains('light'),
    isPaused: () => motionPaused,
  });
  if (webgl) {
    redrawBackground = webgl.draw;
    refreshMotion = webgl.refresh;
    return;
  }
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  let width = 0, height = 0, frame = 0, elapsed = 0, lastTime = 0;
  let scroll = window.scrollY, pointerX = 0, pointerY = 0;
  // Render sharp filaments once, then composite optical bloom from that image.
  const strands = document.createElement('canvas');
  const ink = strands.getContext('2d');
  if (!ink) return;
  const bloom = document.createElement('canvas');
  const glow = bloom.getContext('2d');
  if (!glow) return;
  function bezier(a, b, c, d, t) {
    const u = 1 - t;
    return u*u*u*a + 3*u*u*t*b + 3*u*t*t*c + t*t*t*d;
  }
  function ribbon(t, lane, time) {
    // The reference's signature: a bright, tight hairpin at the left of the
    // glass panel, opening into a broad fan above and below it.
    const turn = .365 + Math.sin(time * .19) * .018;
    const center = .665 + Math.sin(time * .16) * .025;
    const part = t < .5 ? t * 2 : (t - .5) * 2;
    let x = t < .5
      ? bezier(1.12, 1.03, turn - .008, turn, part)
      : bezier(turn, turn + .008, .76, .87, part);
    let y = t < .5
      ? bezier(-.2, .23, center - .15, center, part)
      : bezier(center, center + .15, .73, 1.28, part);
    const fan = Math.pow(Math.abs(t - .5) * 2, 1.25);
    x += lane * (.006 + .19 * fan);
    y += lane * (.005 + .09 * fan) + Math.sin(t * 17 + lane * 4 + time * .35) * .008 * fan;
    // Scroll carries the ribbon upwards, continuing the sweep behind sections.
    const shift = Math.max(0, scroll / height);
    y -= Math.sin(shift * 1.3) * .12;
    return [x * width + pointerX * 5, y * height + pointerY * 4];
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    ink.clearRect(0, 0, width, height);
    const light = root.classList.contains('light');
    const time = elapsed * .001;
    const count = width < 700 ? 70 : 125;
    ink.globalCompositeOperation = light ? 'source-over' : 'lighter';
    for (let i = 0; i < count; i++) {
      // Deterministic variation gives organic strands rather than an even wire grid.
      const lane = Math.sin(i * 127.1) * .94;
      const blue = i % 11 < 2;
      const color = light ? (blue ? '63,133,165' : '89,131,30') : (blue ? '115,196,230' : '206,246,125');
      const bright = i % 9 === 0;
      const shimmer = .78 + Math.sin(i * 3.1 + time * .5) * .22;
      ink.beginPath();
      for (let j = 0; j <= 110; j++) {
        const [x,y] = ribbon(j / 110, lane, time);
        if (!j) ink.moveTo(x,y); else ink.lineTo(x,y);
      }
      ink.strokeStyle = `rgba(${color}, ${(bright ? .7 : .22) * shimmer * (light ? .55 : 1)})`;
      ink.lineWidth = bright ? 1.6 : .65;
      ink.stroke();
    }
    // Low-resolution bloom is fast enough for mobile, while retaining full-size
    // filament detail. The concentrated turn naturally becomes almost white.
    glow.clearRect(0, 0, bloom.width, bloom.height);
    glow.drawImage(strands, 0, 0, bloom.width, bloom.height);
    ctx.globalCompositeOperation = light ? 'source-over' : 'screen';
    ctx.save();
    ctx.globalAlpha = light ? .18 : .85;
    ctx.filter = 'blur(34px)';
    ctx.drawImage(bloom, 0, 0, width, height);
    ctx.globalAlpha = light ? .28 : 1;
    ctx.filter = 'blur(10px)';
    ctx.drawImage(bloom, 0, 0, width, height);
    ctx.globalAlpha = light ? .4 : .85;
    ctx.filter = 'blur(3px)';
    ctx.drawImage(bloom, 0, 0, width, height);
    ctx.restore();
    const [hx,hy] = ribbon(.5, 0, time);
    const halo = ctx.createRadialGradient(hx,hy,0,hx,hy,width * .19);
    halo.addColorStop(0, light ? 'rgba(150,190,70,.18)' : 'rgba(204,255,108,.32)');
    halo.addColorStop(.25, light ? 'rgba(150,190,70,.08)' : 'rgba(153,202,52,.14)');
    halo.addColorStop(1, 'rgba(140,180,40,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0,0,width,height);
    ctx.drawImage(strands, 0, 0, width, height);
    // Tiny suspended particles and bright motes travelling with the flow.
    for (let i=0; i<45; i++) {
      const t = (i * .023 + time * .018) % 1;
      const [x,y] = ribbon(t, Math.sin(i * 7) * 1.7, time);
      ctx.beginPath();
      ctx.arc(x,y,i % 8 === 0 ? 1.5 : .65,0,Math.PI*2);
      ctx.fillStyle = light ? 'rgba(72,112,40,.35)' : `rgba(227,255,182,${.2 + Math.sin(t*Math.PI)*.5})`;
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function tick(now) {
    if (motionPaused || document.hidden) { frame = 0; lastTime = 0; return; }
    if (now - lastTime >= 32) {
      if (lastTime) elapsed += Math.min(now - lastTime, 80);
      lastTime = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function start() { if (!frame && !motionPaused && !document.hidden) frame = requestAnimationFrame(tick); }
  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, width < 700 ? 1 : 1.5);
    strands.width = Math.round(width * ratio);
    strands.height = Math.round(height * ratio);
    ink.setTransform(ratio, 0, 0, ratio, 0, 0);
    bloom.width = Math.round(width / 3);
    bloom.height = Math.round(height / 3);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }
  redrawBackground = draw;
  refreshMotion = () => {
    if (motionPaused && frame) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
    draw();
    start();
  };
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', () => { scroll = window.scrollY; }, { passive: true });
  window.addEventListener('pointermove', event => {
    if (!finePointer.matches || motionPaused) return;
    pointerX = event.clientX / width - .5;
    pointerY = event.clientY / height - .5;
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
    else start();
  });
  resize();
  start();
})();

// Scroll position and active navigation work independently of animation libraries.
const progress = document.querySelector('.scroll-progress');
const navbar = document.getElementById('navbar');
const sections = [...document.querySelectorAll('main > section')];
const navLinks = [...document.querySelectorAll('.nav-links > a')];

const menuToggle = document.getElementById('navMenuToggle');
const mobileMenu = document.getElementById('navLinks');
const mobileNav = window.matchMedia('(max-width: 580px)');
let menuAnimation;

function setMobileMenu(open, animate = true) {
  const wasOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  if (animate && open === wasOpen) return;

  menuAnimation?.kill();
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  mobileMenu.inert = mobileNav.matches && !open;

  const finish = () => {
    navbar.classList.toggle('menu-open', open);
    window.gsap?.set([mobileMenu, ...navLinks], { clearProps: 'opacity,transform' });
  };

  if (!animate || !mobileNav.matches || motionPaused || !window.gsap) {
    finish();
    return;
  }

  if (open) {
    const wasVisible = navbar.classList.contains('menu-open');
    navbar.classList.add('menu-open');
    if (!wasVisible) {
      gsap.set(mobileMenu, { opacity: 0, y: -8 });
      gsap.set(navLinks, { opacity: 0, y: -5 });
    }
    menuAnimation = gsap.timeline({ onComplete: finish })
      .to(mobileMenu, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' })
      .to(navLinks, { opacity: 1, y: 0, duration: 0.22, stagger: 0.04, ease: 'power2.out' }, 0.06);
  } else {
    menuAnimation = gsap.to(mobileMenu, {
      opacity: 0, y: -8, duration: 0.18, ease: 'power2.in', onComplete: finish,
    });
  }
}
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  setMobileMenu(open);
  if (open) navLinks[0].focus({ preventScroll: true });
});
navLinks.forEach(link => link.addEventListener('click', () => {
  if (navbar.classList.contains('menu-open')) menuToggle.focus({ preventScroll: true });
  setMobileMenu(false);
}));
document.addEventListener('click', event => {
  if (!navbar.contains(event.target) || event.target.closest('.nav-cta, .nav-logo')) setMobileMenu(false);
});
navbar.addEventListener('keydown', event => {
  if (event.key === 'Escape' && navbar.classList.contains('menu-open')) {
    setMobileMenu(false);
    menuToggle.focus({ preventScroll: true });
  }
});
mobileNav.addEventListener('change', () => setMobileMenu(false, false));
setMobileMenu(false, false);

let scrollPending = false;
let activeSection;
function updateScroll() {
  scrollPending = false;
  const scrollY = window.scrollY;
  const viewportHeight = window.innerHeight;
  const range = root.scrollHeight - viewportHeight;
  const activeThreshold = viewportHeight * .42;
  let current = '';
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= activeThreshold) current = section.id;
  }

  progress.style.transform = `scaleX(${range > 0 ? scrollY / range : 0})`;
  navbar.classList.toggle('is-scrolled', scrollY > 30);
  if (current === activeSection) return;
  activeSection = current;
  for (const link of navLinks) {
    const active = link.hash === `#${current}`;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
  }
}
window.addEventListener('scroll', () => {
  if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateScroll); }
}, { passive: true });
window.addEventListener('resize', updateScroll, { passive: true });
updateScroll();

// Accessible text masks preserve original wording and semantic headings.
function splitText(element, characters = false) {
  const label = element.textContent.trim().replace(/\s+/g, ' ');
  element.setAttribute('aria-label', label);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    const parts = characters ? [...node.textContent] : node.textContent.split(/(\s+)/);
    for (const part of parts) {
      if (!part.trim()) { fragment.appendChild(document.createTextNode(part)); continue; }
      const mask = document.createElement('span');
      mask.className = 'text-mask'; mask.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.className = 'text-piece'; inner.textContent = part;
      mask.appendChild(inner); fragment.appendChild(mask);
    }
    node.replaceWith(fragment);
  }
  return element.querySelectorAll('.text-piece');
}

if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  const reveals = [];
  const heroPieces = splitText(document.querySelector('.hero-name'), true);
  const headings = [...document.querySelectorAll('.section-title, .contact-big')];
  headings.forEach(heading => splitText(heading));

  if (!motionPaused) {
    const entrance = gsap.timeline({ defaults: { ease: 'power3.out', duration: 1.1 } });
    entrance.from('.hero-tag', { opacity: 0, y: 14 }, .1)
      .from(heroPieces, { yPercent: 115, rotation: 5, stagger: .035, duration: 1.25 }, .2)
      .from('.hero-role, .hero-bio, .hero-actions', { opacity: 0, y: 20, stagger: .12 }, .65)
      .from('.hero-right', { opacity: 0, y: 36, duration: 1.5 }, .6)
      .from('.stat-card', { opacity: 0, x: 18, stagger: .12 }, .9);
    reveals.push(entrance);
    headings.forEach(heading => {
      const tween = gsap.from(heading.querySelectorAll('.text-piece'), {
        scrollTrigger: { trigger: heading, start: 'top 90%', once: true },
        yPercent: 115, rotation: 3, duration: 1.05, stagger: .09, ease: 'power3.out',
      });
      reveals.push(tween);
    });
    document.querySelectorAll('.exp-grid, .projects-grid, .skills-container').forEach(group => {
      [...group.children].forEach((card,index) => {
        reveals.push(gsap.from(card, {
          scrollTrigger: { trigger: card, start: 'top 94%', once: true },
          opacity: 0, y: 36, duration: 1.05, delay: (index % (innerWidth > 800 ? 3 : 1)) * .07, ease: 'power3.out',
        }));
      });
    });
    document.querySelectorAll('.section-label, .contact-sub, .contact-links').forEach(el => {
      reveals.push(gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 94%', once: true }, opacity: 0, y: 18, duration: .8 }));
    });
  }
  const previousRefresh = refreshMotion;
  refreshMotion = () => {
    previousRefresh();
    if (motionPaused) {
      reveals.forEach(tween => { tween.progress(1); tween.scrollTrigger?.kill(); tween.kill(); });
      gsap.killTweensOf('#typed-role');
      gsap.set('#typed-role', { yPercent: 0, opacity: 1 });
    }
  };
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

const roles = ['Senior Developer', 'Frontend Specialist', 'React Developer', 'UI Engineer'];
let roleIndex = 0;
const role = document.getElementById('typed-role');
setInterval(() => {
  if (motionPaused || document.hidden) return;
  roleIndex = (roleIndex + 1) % roles.length;
  if (window.gsap) {
    gsap.to(role, { yPercent: -105, opacity: 0, duration: .35, ease: 'power2.in', onComplete: () => {
      role.textContent = roles[roleIndex];
      gsap.fromTo(role, { yPercent: 105 }, { yPercent: 0, opacity: 1, duration: .65, ease: 'power3.out' });
    }});
  } else { role.textContent = roles[roleIndex]; }
}, 4000);

if (window.gsap) {
  document.querySelectorAll('.project-card').forEach(card => {
    const rotateX = gsap.quickTo(card, 'rotationX', { duration: 0.35, ease: 'power3.out' });
    const rotateY = gsap.quickTo(card, 'rotationY', { duration: 0.35, ease: 'power3.out' });

    const resetTilt = () => {
      card.classList.remove('is-tilting');
      rotateX(0);
      rotateY(0);
    };

    card.addEventListener('pointermove', event => {
      if (!finePointer.matches || motionPaused || event.pointerType !== 'mouse') return;
      const bounds = card.getBoundingClientRect();
      const x = gsap.utils.clamp(-1, 1, (event.clientX - bounds.left) / bounds.width * 2 - 1);
      const y = gsap.utils.clamp(-1, 1, (event.clientY - bounds.top) / bounds.height * 2 - 1);
      if (!card.classList.contains('is-tilting')) {
        gsap.set(card, { transformPerspective: 900 });
        card.classList.add('is-tilting');
      }
      rotateX(-y * 6);
      rotateY(x * 7);
    }, { passive: true });

    card.addEventListener('pointerleave', resetTilt);
    reducedMotion.addEventListener('change', () => {
      if (!reducedMotion.matches) return;
      rotateX.tween.pause();
      rotateY.tween.pause();
      card.classList.remove('is-tilting');
      gsap.set(card, { rotationX: 0, rotationY: 0 });
    });
  });
}
