  'use strict';

    /* ============================================================
       UTILS
       Shared helpers used across all components
    ============================================================ */
    const Utils = {
      /** rAF-throttled function wrapper */
      raf(fn) {
        let ticking = false;
        return function (...args) {
          if (!ticking) {
            requestAnimationFrame(() => { fn.apply(this, args); ticking = false; });
            ticking = true;
          }
        };
      },

      /** Passive event helper */
      onPassive(el, ev, fn) {
        el.addEventListener(ev, fn, { passive: true });
      },

      /** easeOutQuart easing (counter animation) */
      easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); },

      /** Format number with locale separators */
      formatNumber(n) { return Math.floor(n).toLocaleString('id-ID'); },

      /** Clamp value between min and max */
      clamp(val, min, max) { return Math.min(Math.max(val, min), max); },

      /** Detect touch/coarse pointer device */
      isTouch() { return window.matchMedia('(pointer: coarse)').matches; }
    };


    /* ============================================================
       COMPONENT: Navigation
       - Mobile hamburger ☰ ↔ ✕
       - Sticky navbar (.scrolled on scroll > 50px)
       - Active section highlight via IntersectionObserver
       - Smooth scroll for nav links
    ============================================================ */
    function initNavigation() {
      const navbar   = document.querySelector('[data-navbar]');
      const hamburger= document.querySelector('[data-hamburger]');
      const mobileMenu = document.querySelector('[data-mobile-menu]');
      const navLinks = document.querySelectorAll('[data-nav-link]');
      const sections = document.querySelectorAll('main section[id]');

      if (!navbar) return;

      /* Sticky scroll + active link (scroll events) */
      let lastSection = '';
      const onScroll = Utils.raf(() => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);

        /* Active section highlight */
        let current = '';
        sections.forEach(s => {
          if (window.scrollY >= s.offsetTop - 120) current = s.id;
        });
        if (current !== lastSection) {
          lastSection = current;
          navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === '#' + current);
          });
        }
      });
      Utils.onPassive(window, 'scroll', onScroll);

      /* Hamburger toggle */
      if (hamburger && mobileMenu) {
        hamburger.addEventListener('click', () => {
          const isOpen = hamburger.getAttribute('aria-expanded') === 'true';
          hamburger.setAttribute('aria-expanded', String(!isOpen));
          mobileMenu.classList.toggle('open', !isOpen);
          mobileMenu.setAttribute('aria-hidden', String(isOpen));
          document.body.style.overflow = isOpen ? '' : 'hidden';
        });

        /* Close mobile menu on link click */
        mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
          hamburger.setAttribute('aria-expanded', 'false');
          mobileMenu.classList.remove('open');
          mobileMenu.setAttribute('aria-hidden', 'true');
          document.body.style.overflow = '';
        }));

        /* Close on outside click */
        document.addEventListener('click', e => {
          if (mobileMenu.classList.contains('open') &&
              !navbar.contains(e.target)) {
            hamburger.setAttribute('aria-expanded', 'false');
            mobileMenu.classList.remove('open');
            mobileMenu.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
          }
        });
      }

      /* Smooth scroll for all anchor links */
      document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', e => {
          const target = document.querySelector(link.getAttribute('href'));
          if (!target) return;
          e.preventDefault();
          const offset = navbar.offsetHeight;
          window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
        });
      });
    }


    /* ============================================================
       COMPONENT: Hero Slider
       - Auto-play 4s, fade transition
       - Prev/Next buttons
       - Dot indicators
       - Touch swipe (mobile)
    ============================================================ */
    function initHeroSlider() {
      const wrapper = document.querySelector('[data-slider]');
      if (!wrapper) return;

      const slides  = wrapper.querySelectorAll('[data-slide]');
      const dots    = wrapper.querySelectorAll('[data-dot]');
      const btnPrev = wrapper.querySelector('[data-slide-prev]');
      const btnNext = wrapper.querySelector('[data-slide-next]');

      let current = 0;
      let timer   = null;

      function goTo(n) {
        slides[current].classList.remove('hero__slide--active');
        dots[current].classList.remove('hero__dot--active');
        dots[current].setAttribute('aria-selected', 'false');
        current = ((n % slides.length) + slides.length) % slides.length;
        slides[current].classList.add('hero__slide--active');
        dots[current].classList.add('hero__dot--active');
        dots[current].setAttribute('aria-selected', 'true');
      }

      function start() { timer = setInterval(() => goTo(current + 1), 4000); }
      function stop()  { clearInterval(timer); }

      btnPrev?.addEventListener('click', () => { stop(); goTo(current - 1); start(); });
      btnNext?.addEventListener('click', () => { stop(); goTo(current + 1); start(); });
      dots.forEach(d => d.addEventListener('click', () => { stop(); goTo(+d.dataset.dot); start(); }));

      /* Touch swipe */
      let touchStartX = 0;
      Utils.onPassive(wrapper, 'touchstart', e => { touchStartX = e.touches[0].clientX; });
      Utils.onPassive(wrapper, 'touchend',   e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) < 40) return;
        stop();
        goTo(dx < 0 ? current + 1 : current - 1);
        start();
      });

      start();

      /* Cleanup on unload */
      window.addEventListener('pagehide', stop);
    }


    /* ============================================================
       COMPONENT: Counter Animation
       - IntersectionObserver threshold 0.5
       - easeOutQuart, 2000ms duration
       - requestAnimationFrame update
    ============================================================ */
    function initCounters() {
      const items = document.querySelectorAll('[data-counter]');
      if (!items.length) return;

      const obs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          obs.unobserve(entry.target);

          const target  = +entry.target.dataset.counter;
          const display = entry.target.querySelector('.stats__number');
          if (!display) return;

          const startTime = performance.now();
          const duration  = 2000;

          function tick(now) {
            const elapsed  = now - startTime;
            const progress = Utils.clamp(elapsed / duration, 0, 1);
            display.textContent = Utils.formatNumber(target * Utils.easeOutQuart(progress));
            if (progress < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        });
      }, { threshold: 0.5 });

      items.forEach(el => obs.observe(el));
    }


    /* ============================================================
       COMPONENT: 3D Card Tilt
       - .card-3d[data-tilt] elements
       - rotateX/Y ±8deg based on mouse position from center
       - rAF throttled, disabled on touch devices
    ============================================================ */
    function initTilt() {
      if (Utils.isTouch()) return;

      document.querySelectorAll('[data-tilt]').forEach(card => {
        const MAX_DEG = 8;

        const onMove = Utils.raf(e => {
          const rect = card.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
          const y = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
          const rotY = Utils.clamp( x * MAX_DEG, -MAX_DEG, MAX_DEG);
          const rotX = Utils.clamp(-y * MAX_DEG, -MAX_DEG, MAX_DEG);
          card.style.transform = `perspective(1000px) rotateY(${rotY}deg) rotateX(${rotX}deg) scale(1.025)`;
          card.style.boxShadow = `${-rotY * 1.5}px ${rotX * 1.5}px 24px rgba(58,143,111,.2)`;
        });

        card.addEventListener('mousemove', onMove);
        card.addEventListener('mouseleave', () => {
          card.style.transform = '';
          card.style.boxShadow = '';
        });
      });
    }


    /* ============================================================
       COMPONENT: Hero Parallax
       - Layers move at different speeds on mousemove
       - Speed: back 0.02, mid 0.05, front 0.1
       - Disabled on touch
    ============================================================ */
    function initParallax() {
      if (Utils.isTouch()) return;

      const hero = document.querySelector('[data-slider]');
      if (!hero) return;

      const layers = [
        { el: hero.querySelector('.hero__slides'), speed: 0.02 },
        { el: hero.querySelector('[data-hero-parallax]'), speed: 0.08 }
      ].filter(l => l.el);

      const onMove = Utils.raf(e => {
        const rect   = hero.getBoundingClientRect();
        const cx     = rect.width  / 2;
        const cy     = rect.height / 2;
        const dx     = e.clientX - rect.left - cx;
        const dy     = e.clientY - rect.top  - cy;

        layers.forEach(({ el, speed }) => {
          el.style.transform = `translate(${dx * speed}px, ${dy * speed}px)`;
        });
      });

      hero.addEventListener('mousemove', onMove);
      hero.addEventListener('mouseleave', () => {
        layers.forEach(({ el }) => { el.style.transform = ''; });
      });
    }


    /* ============================================================
       COMPONENT: Tab Filtering (Student Affairs)
       - Click tab → fade out → swap content → fade in
       - Active tab indicator
    ============================================================ */
    function initTabs() {
      const container = document.querySelector('[data-tabs]');
      if (!container) return;

      const tabs    = container.querySelectorAll('[data-tab]');
      const panels  = document.querySelectorAll('[data-tab-content]');

      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          if (tab.classList.contains('tab--active')) return;

          /* Deactivate all */
          tabs.forEach(t => { t.classList.remove('tab--active'); t.setAttribute('aria-selected', 'false'); });

          /* Fade out current panel */
          const activePanel = document.querySelector('[data-tab-content].tab-content--active');
          if (activePanel) {
            activePanel.style.opacity = '0';
            activePanel.style.transform = 'translateY(6px)';
          }

          setTimeout(() => {
            panels.forEach(p => { p.classList.remove('tab-content--active'); p.hidden = true; p.style.opacity = ''; p.style.transform = ''; });

            /* Activate clicked tab */
            tab.classList.add('tab--active');
            tab.setAttribute('aria-selected', 'true');

            const target = document.querySelector(`[data-tab-content="${tab.dataset.tab}"]`);
            if (target) {
              target.hidden = false;
              target.classList.add('tab-content--active');
              /* Fade in */
              requestAnimationFrame(() => {
                target.style.opacity = '0';
                target.style.transform = 'translateY(6px)';
                requestAnimationFrame(() => {
                  target.style.transition = 'opacity .35s ease, transform .35s ease';
                  target.style.opacity    = '1';
                  target.style.transform  = 'translateY(0)';
                });
              });
            }
          }, 200);
        });
      });
    }


    /* ============================================================
       COMPONENT: Lightbox Gallery
       - Click image → modal with full-size
       - Close: X button, overlay click, Escape key
       - Prev/Next navigation between images
       - Prevents body scroll
    ============================================================ */
    function initLightbox() {
      const modal   = document.querySelector('[data-lightbox-modal]');
      const imgEl   = document.querySelector('[data-lightbox-img]');
      const capEl   = document.querySelector('[data-lightbox-caption]');
      const closeBtn= document.querySelector('[data-lightbox-close]');
      if (!modal) return;

      const images  = [...document.querySelectorAll('[data-lightbox]')];
      let currentIdx = 0;

      /* Prev/Next buttons (injected) */
      const btnPrev = document.createElement('button');
      const btnNext = document.createElement('button');
      btnPrev.className = 'lightbox__nav lightbox__nav--prev';
      btnNext.className = 'lightbox__nav lightbox__nav--next';
      btnPrev.setAttribute('aria-label', 'Foto sebelumnya');
      btnNext.setAttribute('aria-label', 'Foto berikutnya');
      btnPrev.innerHTML = '<i class="fas fa-chevron-left" aria-hidden="true"></i>';
      btnNext.innerHTML = '<i class="fas fa-chevron-right" aria-hidden="true"></i>';
      modal.appendChild(btnPrev);
      modal.appendChild(btnNext);

      /* Inject nav styles */
      const navStyle = document.createElement('style');
      navStyle.textContent = `.lightbox__nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:#fff;width:48px;height:48px;border-radius:50%;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.3s ease;}.lightbox__nav:hover{background:rgba(255,255,255,.3);}.lightbox__nav--prev{left:1.5rem;}.lightbox__nav--next{right:1.5rem;}`;
      document.head.appendChild(navStyle);

      function showImage(idx) {
        currentIdx = ((idx % images.length) + images.length) % images.length;
        const img = images[currentIdx];
        imgEl.src = img.src;
        imgEl.alt = img.alt;
        capEl.textContent = img.dataset.caption || img.alt;
        btnPrev.style.display = images.length > 1 ? '' : 'none';
        btnNext.style.display = images.length > 1 ? '' : 'none';
      }

      function openLightbox(idx) {
        showImage(idx);
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        closeBtn.focus();
      }

      function closeLightbox() {
        modal.hidden = true;
        document.body.style.overflow = '';
      }

      /* Attach click to all gallery images */
      images.forEach((img, i) => {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', () => openLightbox(i));
      });

      closeBtn?.addEventListener('click', closeLightbox);
      btnPrev.addEventListener('click', e => { e.stopPropagation(); showImage(currentIdx - 1); });
      btnNext.addEventListener('click', e => { e.stopPropagation(); showImage(currentIdx + 1); });

      /* Close on overlay click */
      modal.addEventListener('click', e => { if (e.target === modal) closeLightbox(); });

      /* Keyboard navigation */
      document.addEventListener('keydown', e => {
        if (modal.hidden) return;
        if (e.key === 'Escape')    closeLightbox();
        if (e.key === 'ArrowLeft') showImage(currentIdx - 1);
        if (e.key === 'ArrowRight')showImage(currentIdx + 1);
      });

      /* Touch swipe inside lightbox */
      let swipeX = 0;
      Utils.onPassive(modal, 'touchstart', e => { swipeX = e.touches[0].clientX; });
      Utils.onPassive(modal, 'touchend',   e => {
        const dx = e.changedTouches[0].clientX - swipeX;
        if (Math.abs(dx) < 40) return;
        showImage(dx < 0 ? currentIdx + 1 : currentIdx - 1);
      });
    }


    /* ============================================================
       COMPONENT: Testimonial Carousel
       - Auto-slide 5s, translateX
       - Pause on hover
       - Dot indicators
       - Touch swipe
    ============================================================ */
    function initTestimonials() {
      const wrap  = document.querySelector('[data-testimonials]');
      const track = document.querySelector('[data-testimonials-track]');
      const dots  = document.querySelectorAll('[data-testimonials-dots] [data-dot]');
      if (!wrap || !track) return;

      const slides = track.querySelectorAll('[data-testimonial-slide]');
      let current  = 0;
      let timer    = null;
      let paused   = false;

      function goTo(n) {
        dots[current]?.classList.remove('testimonials__dot--active');
        dots[current]?.setAttribute('aria-selected', 'false');
        current = ((n % slides.length) + slides.length) % slides.length;
        track.style.transform = `translateX(-${current * 100}%)`;
        dots[current]?.classList.add('testimonials__dot--active');
        dots[current]?.setAttribute('aria-selected', 'true');
      }

      function start() {
        if (paused) return;
        timer = setInterval(() => goTo(current + 1), 5000);
      }
      function stop() { clearInterval(timer); }

      dots.forEach(d => d.addEventListener('click', () => { stop(); goTo(+d.dataset.dot); start(); }));

      Utils.onPassive(wrap, 'mouseenter', () => { paused = true;  stop(); });
      Utils.onPassive(wrap, 'mouseleave', () => { paused = false; start(); });

      /* Touch swipe */
      let touchX = 0;
      Utils.onPassive(track, 'touchstart', e => { touchX = e.touches[0].clientX; });
      Utils.onPassive(track, 'touchend',   e => {
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) < 40) return;
        stop(); goTo(dx < 0 ? current + 1 : current - 1); start();
      });

      start();
      window.addEventListener('pagehide', stop);
    }


    /* ============================================================
       COMPONENT: Form Handling
       - Validate name + email (required)
       - mailto action on submit
       - Success message (no backend)
    ============================================================ */
    function initForm() {
      const form = document.querySelector('.contact__form');
      if (!form) return;

      /* Inject success message container */
      const successMsg = document.createElement('div');
      successMsg.className = 'form-success';
      successMsg.setAttribute('role', 'alert');
      successMsg.setAttribute('aria-live', 'polite');
      successMsg.hidden = true;
      successMsg.innerHTML = `
        <i class="fas fa-check-circle" aria-hidden="true"></i>
        <p><strong>Pesan terkirim!</strong> Terima kasih, kami akan segera menghubungi Anda.</p>
      `;

      /* Inject success styles */
      const style = document.createElement('style');
      style.textContent = `.form-success{display:flex;align-items:center;gap:.75rem;background:#edfaf4;border:1px solid #5bb89a;border-radius:16px;padding:1rem 1.25rem;margin-top:1rem;color:#2c3e35;}.form-success i{color:#3a8f6f;font-size:1.5rem;flex-shrink:0;}.form-success[hidden]{display:none;}.form__group.error input,.form__group.error textarea{border-color:#e55;}.form__error{color:#e55;font-size:.8rem;margin-top:.25rem;display:block;}`;
      document.head.appendChild(style);
      form.appendChild(successMsg);

      function showError(field, msg) {
        const group = field.closest('.form__group');
        group.classList.add('error');
        let err = group.querySelector('.form__error');
        if (!err) { err = document.createElement('span'); err.className = 'form__error'; group.appendChild(err); }
        err.textContent = msg;
      }

      function clearErrors() {
        form.querySelectorAll('.form__group.error').forEach(g => g.classList.remove('error'));
        form.querySelectorAll('.form__error').forEach(e => e.remove());
      }

      /* Real-time clear on input */
      form.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('input', () => {
          const group = el.closest('.form__group');
          group.classList.remove('error');
          group.querySelector('.form__error')?.remove();
        });
      });

      form.addEventListener('submit', e => {
        e.preventDefault();
        clearErrors();

        const nameEl  = form.querySelector('#guest-name');
        const emailEl = form.querySelector('#guest-email');
        const msgEl   = form.querySelector('#guest-message');
        let valid = true;

        if (!nameEl.value.trim()) {
          showError(nameEl, 'Nama lengkap wajib diisi.');
          valid = false;
        }
        if (!emailEl.value.trim()) {
          showError(emailEl, 'Alamat email wajib diisi.');
          valid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value)) {
          showError(emailEl, 'Format email tidak valid.');
          valid = false;
        }
        if (!msgEl.value.trim()) {
          showError(msgEl, 'Pesan tidak boleh kosong.');
          valid = false;
        }
        if (!valid) { form.querySelector('.form__group.error input, .form__group.error textarea')?.focus(); return; }

        /* Build mailto and fire */
        const subject = encodeURIComponent(`Pesan dari ${nameEl.value.trim()} - Buku Tamu`);
        const body    = encodeURIComponent(`Nama: ${nameEl.value}\nEmail: ${emailEl.value}\n\n${msgEl.value}`);
        window.location.href = `mailto:info@sdnusantarabangsa.sch.id?subject=${subject}&body=${body}`;

        /* Show success, reset form */
        successMsg.hidden = false;
        form.reset();
        successMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setTimeout(() => { successMsg.hidden = true; }, 6000);
      });
    }


    /* ============================================================
       COMPONENT: Scroll Animations
       - .animate-on-scroll → IntersectionObserver
       - threshold 0.15, rootMargin '0px 0px -50px 0px'
       - Adds .visible → CSS handles transition
       - Stagger delay for list children
       - once: true
    ============================================================ */
    function initScrollAnimations() {
      /* Mark section headings */
      document.querySelectorAll('.section-title, .section-label, .section-subtitle').forEach(el => {
        el.classList.add('animate-on-scroll');
      });

      /* Mark cards / items with stagger */
      const staggerParents = [
        '.about__vm-grid', '.facilities__cards', '.teachers__grid',
        '.tab-grid', '.stats__grid', '.org__level--multi'
      ];
      staggerParents.forEach(sel => {
        document.querySelectorAll(sel).forEach(parent => {
          [...parent.children].forEach((child, i) => {
            child.classList.add('animate-on-scroll');
            child.style.transitionDelay = (i * 80) + 'ms';
          });
        });
      });

      /* Timeline, news, gallery */
      document.querySelectorAll('.timeline__item, .news__card, .gallery__item').forEach((el, i) => {
        el.classList.add('animate-on-scroll');
        el.style.transitionDelay = (i % 4 * 80) + 'ms';
      });

      /* Inject animate-on-scroll base CSS */
      const style = document.createElement('style');
      style.textContent = `.animate-on-scroll{opacity:0;transform:translateY(22px);transition:opacity .55s ease,transform .55s ease;}.animate-on-scroll.visible{opacity:1;transform:none;}`;
      document.head.appendChild(style);

      const obs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

      document.querySelectorAll('.animate-on-scroll').forEach(el => obs.observe(el));
    }


    /* ============================================================
       COMPONENT: Counter (already declared above as initCounters)
       COMPONENT: Back to Top
    ============================================================ */
    function initBackToTop() {
      const btn = document.querySelector('[data-back-to-top]');
      if (!btn) return;
      Utils.onPassive(window, 'scroll', Utils.raf(() => {
        btn.hidden = window.scrollY < 400;
      }));
      btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }


    /* ============================================================
       COMPONENT: Teacher Flip (touch/click toggle)
    ============================================================ */
    function initTeacherFlip() {
      if (!Utils.isTouch()) return;
      document.querySelectorAll('.teacher__card').forEach(card => {
        card.addEventListener('click', () => card.classList.toggle('flipped'));
      });
    }


    /* ============================================================
       INIT — DOMContentLoaded
    ============================================================ */
    document.addEventListener('DOMContentLoaded', () => {
      initNavigation();
      initHeroSlider();
      initCounters();
      initTilt();
      initParallax();
      initTabs();
      initLightbox();
      initTestimonials();
      initForm();
      initScrollAnimations();
      initBackToTop();
      initTeacherFlip();

      /* Footer year */
      const yr = document.getElementById('footer-year');
      if (yr) yr.textContent = new Date().getFullYear();
    });