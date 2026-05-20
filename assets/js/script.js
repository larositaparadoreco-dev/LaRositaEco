/* ==========================================================
   LaRosita-ECO  —  Main Script  (refactored)
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- AOS ---------- */
  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 700, once: true, offset: 60 });
  }

  /* ---------- Header scroll effect ---------- */
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 30);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Mobile menu (hamburger) ---------- */
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.querySelector('.main-nav');
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!expanded));
      mainNav.classList.toggle('open');
      document.body.classList.toggle('nav-open');
    });
    // Close when clicking a link
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('nav-open');
      });
    });
  }

  /* ---------- Active nav link ---------- */
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.main-nav a').forEach(a => {
    const href = a.getAttribute('href') || '';
    const linkPage = href.split('/').pop();
    if (linkPage === currentPage) a.classList.add('active');
  });

  /* ---------- Modal ---------- */
  const flyerModal = document.getElementById('flyerModal');
  const closeBtns = [
    document.getElementById('closeFlyerModal'),
    document.getElementById('closeFlyerModalSecondary')
  ];

  const openModal = () => {
    if (!flyerModal) return;
    flyerModal.classList.add('open');
    flyerModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    if (!flyerModal) return;
    flyerModal.classList.remove('open');
    flyerModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  closeBtns.forEach(btn => { if (btn) btn.addEventListener('click', closeModal); });

  if (flyerModal) {
    flyerModal.addEventListener('click', e => { if (e.target === flyerModal) closeModal(); });
    // Auto-open on homepage
    openModal();
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && flyerModal?.classList.contains('open')) closeModal();
  });

  /* ---------- Carousels (multiple support) ---------- */
  document.querySelectorAll('.gallery-carousel').forEach(carousel => {
    const track = carousel.querySelector('.carousel-track');
    const items = carousel.querySelectorAll('.carousel-item');
    const prev  = carousel.querySelector('.carousel-control.prev');
    const next  = carousel.querySelector('.carousel-control.next');
    const dotsC = carousel.querySelector('.carousel-dots');
    if (!track || !items.length) return;

    let idx = 0, autoTimer;

    const state = () => {
      const gap = parseFloat(getComputedStyle(track).gap) || 0;
      const itemW = items[0].offsetWidth;
      const trackW = track.parentElement.offsetWidth;
      const vis = Math.max(1, Math.round((trackW + gap) / (itemW + gap)));
      const pages = Math.max(1, items.length - vis + 1);
      return { itemW, gap, vis, pages };
    };

    const render = () => {
      const { itemW, gap, pages } = state();
      if (idx >= pages) idx = 0;
      if (idx < 0)     idx = pages - 1;
      track.style.transform = `translateX(${-idx * (itemW + gap)}px)`;
      if (dotsC) {
        dotsC.querySelectorAll('.carousel-dot')
          .forEach((d, i) => d.classList.toggle('active', i === idx));
      }
    };

    const buildDots = () => {
      if (!dotsC) return;
      const { pages } = state();
      dotsC.innerHTML = '';
      for (let i = 0; i < pages; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'carousel-dot';
        b.setAttribute('aria-label', `Imagen ${i + 1}`);
        b.addEventListener('click', () => { idx = i; render(); resetAuto(); });
        dotsC.appendChild(b);
      }
    };

    const go = dir => { idx += dir; render(); };
    const resetAuto = () => {
      clearInterval(autoTimer);
      autoTimer = setInterval(() => go(1), 6000);
    };

    /* Touch / swipe support */
    let touchStartX = 0;
    carousel.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    carousel.addEventListener('touchend', e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) { go(diff > 0 ? 1 : -1); resetAuto(); }
    }, { passive: true });

    buildDots(); render(); resetAuto();

    window.addEventListener('resize', () => { buildDots(); render(); });
    if (prev) prev.addEventListener('click', () => { go(-1); resetAuto(); });
    if (next) next.addEventListener('click', () => { go(1); resetAuto(); });
  });

  /* ---------- Scroll to top ---------- */
  const topBtn = document.getElementById('scrollTopBtn');
  if (topBtn) {
    window.addEventListener('scroll', () => {
      topBtn.classList.toggle('visible', window.scrollY > 500);
    }, { passive: true });
    topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ---------- Inscription form (page-specific) ---------- */
  const form = document.getElementById('inscriptionForm');
  if (form) {
    // SweetAlert handled in inscripcion.html inline script
  }

  /* ---------- Lazy-loading images (native fallback) ---------- */
  document.querySelectorAll('img:not([loading])').forEach(img => {
    img.setAttribute('loading', 'lazy');
  });

  /* ---------- Animated Kids Overlay ---------- */
  const kidsContainer = document.createElement('div');
  kidsContainer.className = 'animated-kids-container';
  kidsContainer.innerHTML = `
    <i class="fas fa-child kid-runner kid-1"></i>
    <i class="fas fa-person-running kid-runner kid-2"></i>
    <i class="fas fa-child-reaching kid-runner kid-3"></i>
  `;
  document.body.appendChild(kidsContainer);

});
