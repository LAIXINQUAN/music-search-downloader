/**
 * QB音乐 项目主页 — 交互脚本 v3.2
 * 包含：预加载、滚动动画、导航、打字机、数字滚动、Tab切换、FAQ、波纹、
 *       Canvas波形、卡片倾斜、浮动音符、粒子效果、进度条、移动菜单、自定义光标、
 *       聚光灯、磁吸按钮、文字渐显、音乐雨彩蛋、SVG图标动画、
 *       鼠标轨迹粒子、3D卡片光照、下载脉冲波纹、元素视差、Hero粒子交互等
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
  initSpotlight();
  initMagneticEffect();
  initTextReveal();
  initKeyboardEasterEgg();
  initFeatureIconAnimation();
  // v3.2 新增
  initMouseTrail();
  initCardLighting();
  initDownloadRipple();
  initElementParallax();
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
  const barWidth = canvas.width / bars;

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

  // 鼠标交互跟踪
  let mouseX = -1000, mouseY = -1000;
  const heroEl = document.querySelector('.hero');
  if (heroEl) {
    heroEl.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
    heroEl.addEventListener('mouseleave', () => {
      mouseX = -1000;
      mouseY = -1000;
    });
  }

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

      // v3.2 鼠标交互 — 粒子被光标吸引
      if (mouseX > 0 && heroEl) {
        const heroRect = heroEl.getBoundingClientRect();
        const relX = mouseX - heroRect.left;
        const relY = mouseY - heroRect.top;
        const dx = p.x - relX;
        const dy = p.y - relY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180 && dist > 5) {
          const force = (180 - dist) / 180 * 0.08;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      }

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

// ===== 20. 鼠标聚光灯效果 =====
function initSpotlight() {
  // 仅桌面端启用
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const spotlight = document.querySelector('.spotlight');
  if (!spotlight) return;

  let mouseX = 0, mouseY = 0;
  let targetX = 0, targetY = 0;
  let hideTimer;

  document.addEventListener('mousemove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
    spotlight.classList.add('active');

    // 3秒无操作后渐隐
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      spotlight.classList.remove('active');
    }, 3000);
  });

  // 平滑跟随动画
  function animate() {
    mouseX += (targetX - mouseX) * 0.05;
    mouseY += (targetY - mouseY) * 0.05;
    spotlight.style.left = mouseX + 'px';
    spotlight.style.top = mouseY + 'px';
    requestAnimationFrame(animate);
  }
  animate();
}

// ===== 21. 磁吸按钮效果 =====
function initMagneticEffect() {
  // 仅桌面端启用
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const magneticElements = document.querySelectorAll('.btn-primary, .btn-secondary, .dl-btn, .topbar-gh, .back-top');
  if (!magneticElements.length) return;

  magneticElements.forEach(el => {
    el.classList.add('magnetic');

    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const strength = 0.3;
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    });

    el.addEventListener('mouseleave', () => {
      el.style.transform = 'translate(0px, 0px)';
    });
  });
}

// ===== 22. 文字渐显效果 =====
function initTextReveal() {
  const descEls = document.querySelectorAll('.section .section-desc');
  if (!descEls.length) return;

  descEls.forEach(el => {
    el.classList.add('text-reveal');
  });

  // 根据滚动位置更新文字渐显进度
  window.addEventListener('scroll', () => {
    descEls.forEach(el => {
      const rect = el.getBoundingClientRect();
      const windowH = window.innerHeight;
      // 元素从底部进入视口到完全显示的过程中计算进度
      const progress = Math.max(0, Math.min(1, (windowH - rect.top) / (windowH * 0.6)));
      el.style.setProperty('--reveal-progress', (progress * 100) + '%');
    });
  }, { passive: true });
}

// ===== 23. 键盘彩蛋 — 音乐雨 =====
function initKeyboardEasterEgg() {
  const hint = document.querySelector('.kbd-hint');
  let musicRainActive = false;
  let rainTimer = null;

  function triggerMusicRain() {
    if (musicRainActive) return;
    musicRainActive = true;

    // 隐藏提示
    if (hint) hint.classList.add('fade-out');

    const notes = ['♪', '♫', '♬', '♩', '♪', '♫', '♬', '♩', '♩', '♪'];
    const colors = ['#ff6b4a', '#a78bfa', '#60a5fa', '#4ade80', '#fbbf24', '#f472b6'];
    const container = document.body;

    // 生成音乐雨
    let count = 0;
    const maxCount = 40;

    function spawnRainNote() {
      if (count >= maxCount) {
        // 3秒后允许再次触发
        setTimeout(() => {
          musicRainActive = false;
          if (hint) hint.classList.remove('fade-out');
        }, 3000);
        return;
      }

      const note = document.createElement('span');
      note.className = 'music-rain-note';
      note.textContent = notes[Math.floor(Math.random() * notes.length)];
      note.style.left = Math.random() * 90 + '%';
      note.style.color = colors[Math.floor(Math.random() * colors.length)];
      note.style.animationDuration = (2 + Math.random() * 3) + 's';
      note.style.animationDelay = Math.random() * 0.5 + 's';
      note.style.fontSize = (20 + Math.random() * 30) + 'px';

      container.appendChild(note);
      count++;

      note.addEventListener('animationend', () => {
        note.remove();
      });

      // 继续生成
      setTimeout(spawnRainNote, 80 + Math.random() * 120);
    }

    spawnRainNote();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'k' || e.key === 'K') {
      // 避免在输入框中触发
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      triggerMusicRain();
    }
  });
}

// ===== 24. 功能卡片 SVG 图标动画 =====
function initFeatureIconAnimation() {
  const icons = document.querySelectorAll('.feature-card .fc-icon svg');
  if (!icons.length) return;

  // 为每个图标添加 hover 动画监听
  const cards = document.querySelectorAll('.feature-card');
  cards.forEach(card => {
    const icon = card.querySelector('.fc-icon svg');
    if (!icon) return;

    card.addEventListener('mouseenter', () => {
      // 短暂的颜色脉冲动画
      const fcIcon = card.querySelector('.fc-icon');
      if (fcIcon) {
        fcIcon.style.color = 'var(--accent)';
        setTimeout(() => {
          if (!card.matches(':hover')) {
            fcIcon.style.color = '';
          }
        }, 200);
      }
    });

    card.addEventListener('mouseleave', () => {
      const fcIcon = card.querySelector('.fc-icon');
      if (fcIcon) {
        fcIcon.style.color = '';
      }
    });
  });
}

// ===== 25. 鼠标轨迹粒子系统 v3.2 =====
function initMouseTrail() {
  // 仅桌面端启用
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'mouse-trail-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let particles = [];
  let mouseX = -100, mouseY = -100;
  let lastSpawn = 0;
  const maxParticles = 150;
  const spawnRate = 25;

  // 画布尺寸自适应
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // 调色板
  const palette = [
    { r: 255, g: 107, b: 74 },   // 主色
    { r: 167, g: 139, b: 250 },  // 紫色
    { r: 96, g: 165, b: 250 },   // 蓝色
    { r: 74, g: 222, b: 128 },   // 绿色
    { r: 251, g: 191, b: 36 },   // 黄色
    { r: 244, g: 114, b: 182 },  // 粉色
  ];

  // 鼠标移动时生成粒子
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    const now = performance.now();
    if (now - lastSpawn > spawnRate) {
      lastSpawn = now;
      const color = palette[Math.floor(Math.random() * palette.length)];
      particles.push({
        x: mouseX + (Math.random() - 0.5) * 10,
        y: mouseY + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5 - 0.5,
        radius: Math.random() * 2.5 + 1,
        color,
        life: 1,
        decay: 0.008 + Math.random() * 0.015,
      });
    }
  });

  // 动画循环
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      const alpha = p.life * 0.7;
      // 绘制粒子核心
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha})`;
      ctx.fill();

      // 发光光晕
      if (p.life > 0.3) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * p.life * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha * 0.12})`;
        ctx.fill();
      }
    }

    // 限制粒子数量
    if (particles.length > maxParticles) {
      particles = particles.slice(-maxParticles);
    }

    requestAnimationFrame(animate);
  }
  animate();
}

// ===== 26. 3D 卡片光照效果 v3.2 =====
function initCardLighting() {
  // 仅桌面端启用
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const cards = document.querySelectorAll('.feature-card');
  if (!cards.length) return;

  cards.forEach(card => {
    // 初始化 CSS 变量
    card.style.setProperty('--mx', '0.5');
    card.style.setProperty('--my', '0.5');

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      card.style.setProperty('--mx', x.toFixed(3));
      card.style.setProperty('--my', y.toFixed(3));
    });

    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--mx', '0.5');
      card.style.setProperty('--my', '0.5');
    });
  });
}

// ===== 27. 下载按钮脉冲波纹 v3.2 =====
function initDownloadRipple() {
  const dlBtn = document.querySelector('.dl-btn');
  if (!dlBtn) return;

  // 确保按钮父容器可定位波纹
  dlBtn.style.position = 'relative';
  dlBtn.style.overflow = 'visible';

  // 创建单个脉冲波纹环
  function createPulseRing() {
    const ring = document.createElement('span');
    ring.className = 'dl-pulse-ring';
    dlBtn.appendChild(ring);

    ring.addEventListener('animationend', () => {
      ring.remove();
    });
  }

  // 初始创建两个错开的环
  createPulseRing();
  setTimeout(createPulseRing, 1000);

  // 每2秒创建新环
  setInterval(createPulseRing, 2000);
}

// ===== 28. 多层级元素视差滚动 v3.2 =====
function initElementParallax() {
  // 为关键元素动态设置视差速度
  const parallaxConfig = [
    { selector: '.hero-left .ver', speed: 0.08 },
    { selector: '.section-label', speed: 0.05 },
    { selector: '.section h2', speed: 0.03 },
    { selector: '.section .section-desc', speed: 0.04 },
  ];

  const elements = [];
  parallaxConfig.forEach(({ selector, speed }) => {
    document.querySelectorAll(selector).forEach(el => {
      el.dataset.parallaxSpeed = speed;
      elements.push(el);
    });
  });

  if (!elements.length) return;

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;

    elements.forEach(el => {
      const speed = parseFloat(el.dataset.parallaxSpeed) || 0.02;
      const rect = el.getBoundingClientRect();
      const windowH = window.innerHeight;

      // 仅处理视口内的元素
      if (rect.top < windowH && rect.bottom > 0) {
        const offset = (rect.top - windowH) * speed;
        el.style.transform = `translateY(${offset}px)`;
      }
    });
  }, { passive: true });
}