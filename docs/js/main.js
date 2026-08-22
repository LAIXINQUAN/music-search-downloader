/**
 * QB音乐 项目主页 — 交互脚本 v3.0
 * 包含：预加载、滚动动画、导航、打字机、数字滚动、Tab切换、FAQ、波纹、
 *       Canvas波形、卡片倾斜、浮动音符、粒子效果、进度条、移动菜单、自定义光标等
 */

// ===== DOM Ready =====
document.addEventListener('DOMContentLoaded', () => {
  initPreloader();
  initRevealOnScroll();
  initScrollProgress();
  initNavScroll();
  initBackToTop();
  initTypewriter();
  initCountUp();
  initWinTabs();
  initCopyCode();
  initRipple();
  initFAQ();
  initSmoothScroll();
  initMobileMenu();
  initCustomCursor();
  initSectionDots();
  initWaveformCanvas();
  initFloatingNotes();
  initHeroParticles();
  initCardTilt();
  initParallaxOrbs();
});

// ===== 0. 预加载动画 =====
function initPreloader() {
  const preloader = document.getElementById('preloader');
  if (!preloader) return;

  // 页面完全加载后隐藏预加载器
  window.addEventListener('load', () => {
    setTimeout(() => {
      preloader.classList.add('hidden');
      // 动画结束后移除DOM
      setTimeout(() => {
        if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
      }, 500);
    }, 600);
  });

  // 兜底：最多等4秒
  setTimeout(() => {
    if (!preloader.classList.contains('hidden')) {
      preloader.classList.add('hidden');
      setTimeout(() => {
        if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
      }, 500);
    }
  }, 4000);
}

// ===== 1. Intersection Observer — 滚动渐显动画 =====
function initRevealOnScroll() {
  const reveals = document.querySelectorAll('.reveal');
  if (!reveals.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

  reveals.forEach(el => observer.observe(el));
}

// ===== 2. 导航栏滚动效果 =====
function initNavScroll() {
  const topbar = document.querySelector('.topbar');
  const sections = document.querySelectorAll('.section');
  const navLinks = document.querySelectorAll('.topbar-links a[data-section]');
  if (!topbar || !navLinks.length) return;

  window.addEventListener('scroll', () => {
    topbar.classList.toggle('scrolled', window.scrollY > 20);

    let current = '';
    sections.forEach(sec => {
      const top = sec.getBoundingClientRect().top;
      if (top < 120) current = sec.id;
    });
    navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.section === current);
    });
  });
}

// ===== 3. 回到顶部按钮 =====
function initBackToTop() {
  const btn = document.querySelector('.back-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 500);
  });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ===== 4. 打字机效果 =====
function initTypewriter() {
  const el = document.querySelector('.typewriter-text');
  if (!el) return;

  const texts = ['聚合搜索，一键下载', '多平台音源，想听就听', '免费开源，持续更新', 'Windows 桌面音乐客户端'];
  let textIdx = 0, charIdx = 0, isDeleting = false;
  const typeSpeed = 60, deleteSpeed = 30, pauseTime = 2500;

  function tick() {
    const current = texts[textIdx];
    if (isDeleting) {
      el.textContent = current.substring(0, charIdx - 1);
      charIdx--;
    } else {
      el.textContent = current.substring(0, charIdx + 1);
      charIdx++;
    }

    if (!isDeleting && charIdx === current.length) {
      setTimeout(tick, pauseTime);
      isDeleting = true;
      return;
    }
    if (isDeleting && charIdx === 0) {
      isDeleting = false;
      textIdx = (textIdx + 1) % texts.length;
      setTimeout(tick, 400);
      return;
    }
    setTimeout(tick, isDeleting ? deleteSpeed : typeSpeed);
  }

  setTimeout(tick, 800);
}

// ===== 5. 数字滚动动画 =====
function initCountUp() {
  const countEls = document.querySelectorAll('.stat-num[data-count]');
  if (!countEls.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.count);
      const duration = 1400;
      const start = performance.now();

      function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased);
        if (progress < 1) requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
      observer.unobserve(el);
    });
  }, { threshold: 0.4 });

  countEls.forEach(el => observer.observe(el));
}

// ===== 6. 截图窗口 Tab 切换 + 自动轮播 =====
function initWinTabs() {
  const tabs = document.querySelectorAll('.win-tab');
  const panels = document.querySelectorAll('.win-panel');
  if (!tabs.length || !panels.length) return;

  let autoTimer;

  function switchTab(target) {
    tabs.forEach(t => t.classList.remove('on'));
    panels.forEach(p => p.classList.remove('active'));
    const tab = document.querySelector(`.win-tab[data-tab="${target}"]`);
    const panel = document.querySelector(`.win-panel[data-panel="${target}"]`);
    if (tab) tab.classList.add('on');
    if (panel) panel.classList.add('active');
  }

  function startAutoSwitch() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      const current = document.querySelector('.win-tab.on');
      const all = [...tabs];
      const idx = all.indexOf(current);
      const next = all[(idx + 1) % all.length];
      if (next) switchTab(next.dataset.tab);
    }, 3500);
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
      startAutoSwitch();
    });
  });

  startAutoSwitch();
}

// ===== 7. 复制代码按钮 =====
function initCopyCode() {
  const btn = document.querySelector('.copy-btn');
  if (!btn) return;

  const rawCommands = [
    'git clone https://github.com/LAIXINQUAN/music-search-downloader.git',
    'cd music-search-downloader',
    'npm install',
    'npm start',
    '',
    '# 或者启动桌面客户端',
    'npm run electron'
  ].join('\n');

  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(rawCommands).then(() => {
      btn.textContent = '已复制';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '复制';
        btn.classList.remove('copied');
      }, 2000);
    }).catch(() => {
      btn.textContent = '失败';
      setTimeout(() => { btn.textContent = '复制'; }, 1500);
    });
  });
}

// ===== 8. 下载按钮波纹效果 =====
function initRipple() {
  document.querySelectorAll('.dl-btn, .btn-primary').forEach(btn => {
    btn.addEventListener('click', function (e) {
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      this.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  });
}

// ===== 9. FAQ 折叠面板 =====
function initFAQ() {
  const questions = document.querySelectorAll('.faq-question');
  if (!questions.length) return;

  questions.forEach(q => {
    q.addEventListener('click', () => {
      const item = q.parentElement;
      const isOpen = item.classList.contains('open');

      // 关闭所有
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));

      // 打开当前（如果不是已经打开的）
      if (!isOpen) item.classList.add('open');
    });
  });
}

// ===== 10. 平滑滚动导航 =====
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ===== 11. Canvas 波形可视化 =====
function initWaveformCanvas() {
  const canvas = document.getElementById('waveformCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let animationId;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = 200;
  }
  resize();
  window.addEventListener('resize', resize);

  const bars = 120;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const time = Date.now() * 0.001;
    const actualBarWidth = canvas.width / bars;

    for (let i = 0; i < bars; i++) {
      // 生成模拟的音频波形数据
      const freq1 = Math.sin(i * 0.15 + time * 0.8) * 0.5 + 0.5;
      const freq2 = Math.sin(i * 0.3 + time * 1.2) * 0.5 + 0.5;
      const freq3 = Math.sin(i * 0.05 + time * 0.4) * 0.5 + 0.5;
      const noise = Math.sin(i * 0.7 + time * 2.1) * 0.25 + 0.25;

      const amplitude = (freq1 * 0.4 + freq2 * 0.3 + freq3 * 0.2 + noise * 0.1);
      const barHeight = amplitude * canvas.height * 0.8 + 10;

      const x = i * actualBarWidth;
      const gradient = ctx.createLinearGradient(x, canvas.height, x, canvas.height - barHeight);
      gradient.addColorStop(0, 'rgba(255, 107, 74, 0)');
      gradient.addColorStop(0.5, 'rgba(255, 107, 74, 0.5)');
      gradient.addColorStop(1, 'rgba(255, 107, 74, 0.8)');

      ctx.fillStyle = gradient;
      ctx.fillRect(x + 1, canvas.height - barHeight, actualBarWidth - 2, barHeight);
    }

    animationId = requestAnimationFrame(draw);
  }

  // 使用 IntersectionObserver 控制动画启停以节省性能
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      if (!animationId) draw();
    } else {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    }
  }, { threshold: 0 });

  observer.observe(canvas);
  // 默认启动
  draw();
}

// ===== 12. 浮动音符生成 =====
function initFloatingNotes() {
  const container = document.getElementById('notesContainer');
  if (!container) return;

  const notes = ['♪', '♫', '♬', '♩', '♪', '♫', '♬', '♩'];
  const variants = ['', 'alt', 'alt2'];

  function spawnNote() {
    const note = document.createElement('span');
    note.className = 'floating-note';
    const variant = variants[Math.floor(Math.random() * variants.length)];
    if (variant) note.classList.add(variant);
    note.textContent = notes[Math.floor(Math.random() * notes.length)];

    // 随机位置
    note.style.left = Math.random() * 90 + '%';
    note.style.bottom = '0px';
    // 随机动画时长
    const duration = 5 + Math.random() * 7;
    note.style.animationDuration = duration + 's';

    container.appendChild(note);

    // 动画结束后移除
    note.addEventListener('animationend', () => note.remove());
  }

  // 每2-4秒生成一个音符
  function scheduleNext() {
    const delay = 2000 + Math.random() * 3000;
    setTimeout(() => {
      spawnNote();
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}

// ===== 13. Hero 粒子效果 =====
function initHeroParticles() {
  const canvas = document.getElementById('heroParticles');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let animationId;
  let particles = [];

  function resize() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    const rect = hero.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  // 创建粒子
  const particleCount = 50;
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3 - 0.2,
      alpha: Math.random() * 0.5 + 0.1,
      alphaSpeed: (Math.random() - 0.5) * 0.005,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha += p.alphaSpeed;

      // 边界检测
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      if (p.alpha <= 0 || p.alpha >= 0.6) p.alphaSpeed *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 107, 74, ${p.alpha})`;
      ctx.fill();
    });

    // 绘制粒子间连线
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(255, 107, 74, ${0.04 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    animationId = requestAnimationFrame(draw);
  }

  draw();

  // 清理
  window.addEventListener('beforeunload', () => {
    if (animationId) cancelAnimationFrame(animationId);
  });
}

// ===== 14. 卡片倾斜效果 =====
function initCardTilt() {
  const tiltWrapper = document.querySelector('.hero-right .tilt-wrapper');
  if (!tiltWrapper) return;

  const heroRight = document.querySelector('.hero-right');
  if (!heroRight) return;

  heroRight.addEventListener('mousemove', (e) => {
    const rect = heroRight.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 计算旋转角度 (最大 ±8度)
    const rotateY = ((x / rect.width) - 0.5) * 16;
    const rotateX = ((y / rect.height) - 0.5) * -16;

    tiltWrapper.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
  });

  heroRight.addEventListener('mouseleave', () => {
    tiltWrapper.style.transform = 'rotateY(0deg) rotateX(0deg)';
  });
}

// ===== 15. 滚动进度条 =====
function initScrollProgress() {
  const bar = document.querySelector('.scroll-progress-bar');
  if (!bar) return;

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = progress + '%';
  }, { passive: true });
}

// ===== 16. 移动端菜单 =====
function initMobileMenu() {
  const btn = document.querySelector('.mobile-menu-btn');
  if (!btn) return;

  // 创建菜单覆盖层
  const overlay = document.createElement('div');
  overlay.className = 'mobile-menu-overlay';

  const panel = document.createElement('nav');
  panel.className = 'mobile-menu-panel';

  // 复制导航链接
  const navLinks = [
    { href: '#features', text: '功能' },
    { href: '#tech', text: '技术' },
    { href: '#changelog', text: '更新' },
    { href: '#faq', text: '常见问题' },
    { href: '#install', text: '安装' },
    { href: '#download', text: '下载' },
  ];

  navLinks.forEach(link => {
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.text;
    a.addEventListener('click', () => closeMenu());
    panel.appendChild(a);
  });

  // GitHub 链接
  const ghLink = document.createElement('a');
  ghLink.href = 'https://github.com/LAIXINQUAN/music-search-downloader';
  ghLink.target = '_blank';
  ghLink.rel = 'noopener';
  ghLink.textContent = 'GitHub';
  ghLink.className = 'gh-link';
  panel.appendChild(ghLink);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // 切换菜单
  function openMenu() {
    btn.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    btn.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', () => {
    if (btn.classList.contains('active')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // 点击遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeMenu();
  });

  // ESC 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && btn.classList.contains('active')) {
      closeMenu();
    }
  });

  // 窗口大小变化时关闭菜单
  window.addEventListener('resize', () => {
    if (window.innerWidth > 960 && btn.classList.contains('active')) {
      closeMenu();
    }
  });
}

// ===== 17. 自定义光标 =====
function initCustomCursor() {
  // 仅桌面端启用
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  if (!dot || !ring) return;

  let mouseX = 0, mouseY = 0;
  let ringX = 0, ringY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // 点直接跟随
    dot.style.left = mouseX + 'px';
    dot.style.top = mouseY + 'px';
  });

  // 环带延迟跟随
  function animateRing() {
    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;
    ring.style.left = ringX + 'px';
    ring.style.top = ringY + 'px';
    requestAnimationFrame(animateRing);
  }
  animateRing();

  // 鼠标离开窗口时隐藏
  document.addEventListener('mouseleave', () => {
    dot.style.opacity = '0';
    ring.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    dot.style.opacity = '1';
    ring.style.opacity = '1';
  });

  // 悬停在可交互元素上时放大环
  const interactiveSelectors = 'a, button, .win-tab, .faq-question, .copy-btn, .section-dot, .feature-card, .tech-tag';
  document.querySelectorAll(interactiveSelectors).forEach(el => {
    el.addEventListener('mouseenter', () => ring.classList.add('hover'));
    el.addEventListener('mouseleave', () => ring.classList.remove('hover'));
  });
}

// ===== 18. 右侧导航圆点 =====
function initSectionDots() {
  // 仅桌面端显示
  if (window.innerWidth <= 960) return;

  const sections = document.querySelectorAll('.section[id]');
  if (!sections.length) return;

  // 创建圆点容器
  const dotsContainer = document.createElement('div');
  dotsContainer.className = 'section-dots';

  const labels = {
    features: '功能',
    tech: '技术',
    changelog: '更新',
    faq: '常见问题',
    install: '安装',
    download: '下载',
  };

  sections.forEach(sec => {
    const dot = document.createElement('a');
    dot.className = 'section-dot';
    dot.href = '#' + sec.id;
    dot.dataset.section = sec.id;
    dot.dataset.label = labels[sec.id] || sec.id;
    dot.title = labels[sec.id] || sec.id;
    dot.addEventListener('click', (e) => {
      e.preventDefault();
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    dotsContainer.appendChild(dot);
  });

  document.body.appendChild(dotsContainer);

  // 滚动时高亮对应圆点
  const dots = dotsContainer.querySelectorAll('.section-dot');
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(sec => {
      const top = sec.getBoundingClientRect().top;
      if (top < 200) current = sec.id;
    });
    dots.forEach(dot => {
      dot.classList.toggle('active', dot.dataset.section === current);
    });
  }, { passive: true });
}

// ===== 19. 环境光视差滚动 =====
function initParallaxOrbs() {
  const orbs = document.querySelectorAll('.ambient-orb');
  if (!orbs.length) return;

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const multiplier = 0.03;

    orbs.forEach((orb, i) => {
      const direction = i % 2 === 0 ? 1 : -1;
      const offset = scrollY * multiplier * direction * (i + 1);
      orb.style.transform = `translateY(${offset}px)`;
    });
  }, { passive: true });
}