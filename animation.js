/* =========================================
   QUALITY ROOTS — THE DEAL DROP
   Animation Engine — GSAP 3.x
   ========================================= */

// Plugin registrations
gsap.registerPlugin(SplitText, DrawSVGPlugin, CustomEase);

// Custom ease: heavy slam into place then settle
CustomEase.create("priceSLAM", "M0,0 C0.05,0 0.15,1.15 0.3,1.04 0.5,0.92 0.65,1.0 1,1");

// =========================================
// CONSTANTS
// =========================================
const PRODUCTS_PER_CYCLE = 1;

// =========================================
// STATE
// =========================================
let PRODUCTS = [];
let currentBatch = 0;
let marqueeTween = null;
let currentSplit = null;
let livingTweens = [];
let particleTimers = [];
let badgeShown = false;

// =========================================
// UTILITY: Format price with $ and decimals
// =========================================
function formatPrice(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return '$0';
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
}

// =========================================
// UTILITY: Compute savings display
// =========================================
function computeSavings(originalStr, discountedNum) {
  const original = parseFloat(originalStr);
  const discounted = parseFloat(discountedNum);
  if (!original || !discounted) return '50% OFF';
  const pct = Math.round((1 - discounted / original) * 100);
  return `${pct}% OFF`;
}

// =========================================
// UTILITY: Build THC label
// =========================================
function buildThcLabel(product) {
  const val = product.lab_thc_value;
  const unit = product.lab_thc_unit || '';
  if (!val || val === 0) return 'THC N/A';
  // Format: 2.48mg or 26.19%
  const display = val % 1 === 0 ? val : val.toFixed(2);
  return `THC ${display}${unit}`;
}

// =========================================
// UTILITY: Get batch
// =========================================
function getBatch(batchIndex) {
  const count = PRODUCTS.length;
  if (count === 0) return [];
  const start = (batchIndex * PRODUCTS_PER_CYCLE) % count;
  const batch = [];
  for (let i = 0; i < PRODUCTS_PER_CYCLE; i++) {
    batch.push(PRODUCTS[(start + i) % count]);
  }
  return batch;
}

// =========================================
// MARQUEE: Update text + restart scroll
// =========================================
function updateMarquee(category) {
  const label = (category || 'CANNABIS').toUpperCase();
  const text = Array(10).fill(label).join(' · ') + ' · ';
  const el = document.getElementById('bg-marquee');
  el.textContent = text + text; // doubled for seamless loop

  if (marqueeTween) marqueeTween.kill();
  gsap.set(el, { x: 0 });
  marqueeTween = gsap.to(el, {
    x: '-50%',
    duration: 20,
    ease: 'none',
    repeat: -1
  });
}

// =========================================
// PARTICLE SYSTEM
// =========================================
function spawnParticle() {
  const layer = document.getElementById('particle-layer');
  if (!layer) return;

  const el = document.createElement('div');
  el.className = 'particle';

  // Random position in the product zone (right ~45% of canvas)
  const x = 960 + Math.random() * 840; // 960–1800px
  const yStart = 700 + Math.random() * 250; // 700–950px

  el.style.left = x + 'px';
  el.style.top = yStart + 'px';
  el.style.opacity = '0';
  // Vary size a little
  const size = 3 + Math.random() * 4;
  el.style.width = size + 'px';
  el.style.height = size + 'px';

  layer.appendChild(el);

  const riseAmount = 350 + Math.random() * 200;
  const dur = 3.0 + Math.random() * 2.0;

  gsap.timeline({
    onComplete: () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }
  })
    .to(el, { opacity: 0.55, duration: dur * 0.25, ease: 'power1.out' })
    .to(el, { y: -riseAmount, duration: dur, ease: 'power1.out' }, 0)
    .to(el, { opacity: 0, duration: dur * 0.4, ease: 'power2.in' }, dur * 0.6);
}

function startParticleLoop() {
  stopParticleLoop(); // clean slate
  function scheduleNext() {
    const delay = 0.25 + Math.random() * 0.8;
    const timer = gsap.delayedCall(delay, () => {
      spawnParticle();
      scheduleNext();
    });
    particleTimers.push(timer);
  }
  scheduleNext();
}

function stopParticleLoop() {
  particleTimers.forEach(t => t.kill());
  particleTimers = [];
  // Clear any existing particles
  const layer = document.getElementById('particle-layer');
  if (layer) layer.innerHTML = '';
}

// =========================================
// STOP ALL LIVING MOMENT LOOPS
// =========================================
function stopLivingLoops() {
  livingTweens.forEach(t => t.kill());
  livingTweens = [];
  stopParticleLoop();
}

// =========================================
// RENDER BATCH: Build DOM for one product
// =========================================
function renderBatch(products) {
  // Revert previous SplitText
  if (currentSplit) {
    currentSplit.revert();
    currentSplit = null;
  }

  const container = document.getElementById('products-container');
  container.innerHTML = '';

  if (!products || products.length === 0) return;
  const product = products[0];

  const originalPrice = formatPrice(product.price);
  const salePrice = formatPrice(product.discounted_price);
  const savingsLabel = computeSavings(product.price, product.discounted_price);
  const thcLabel = buildThcLabel(product);
  const category = (product.category || 'Cannabis').toUpperCase();
  const strainType = (product.strain_type || product.strain || 'Hybrid').toUpperCase();
  const vendorName = (product.vendor || '').toUpperCase();
  const brandName = (product.brand || '').toUpperCase();
  const productName = (product.name || '').toUpperCase();
  const imageUrl = product.image_url || '';

  container.innerHTML = `
    <div class="product-card">
      <div class="left-panel">
        <div class="left-accent-line"></div>
        <div class="category-chip">${category}</div>
        <div class="brand-name">${brandName}</div>

        <div class="decorative-rule-wrap">
          <svg class="decorative-rule" viewBox="0 0 420 2" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" y1="1" x2="420" y2="1" stroke="#2B6E28" stroke-width="2"/>
          </svg>
        </div>

        <div class="product-name">${productName}</div>

        <div class="price-block">
          <div class="was-row">
            <span class="was-label">WAS</span>
            <div class="original-price-wrap">
              <span class="original-price">${originalPrice}</span>
              <div class="strike-line"></div>
            </div>
          </div>
          <div class="now-row">
            <span class="now-label">NOW</span>
            <span class="new-price">${salePrice}</span>
          </div>
        </div>

        <div class="savings-badge">${savingsLabel}</div>

        <div class="bottom-info-bar">
          <span class="strain-pill">${strainType}</span>
          <div class="bar-divider"></div>
          <span class="thc-value">${thcLabel}</span>
          <div class="bar-divider"></div>
          <span class="bar-label">Quality Roots</span>
          <span class="vendor-name">${vendorName}</span>
        </div>
      </div>
      <div class="right-panel">
        <img
          class="product-image"
          src="${imageUrl}"
          alt="${productName}"
          crossorigin="anonymous"
        >
      </div>
    </div>
  `;
}

// =========================================
// MAIN CYCLE ANIMATION
// =========================================
function animateCycle(batchIndex) {
  // Kill any lingering living loops from previous cycle
  stopLivingLoops();

  const batch = getBatch(batchIndex);
  renderBatch(batch);

  if (!batch || batch.length === 0) {
    // No products — retry after a moment
    gsap.delayedCall(1, () => animateCycle(batchIndex + 1));
    return;
  }

  const product = batch[0];
  updateMarquee(product.category || 'Cannabis');

  // Create SplitText for product name
  const nameEl = document.querySelector('.product-name');
  if (nameEl) {
    currentSplit = SplitText.create(nameEl, { type: 'chars,words' });
  }

  // -------------------------------------------------------
  // Reset initial states (DOM just inserted — hidden)
  // -------------------------------------------------------
  gsap.set('.left-accent-line', { scaleY: 0, opacity: 0 });
  gsap.set('.category-chip', { y: -60, opacity: 0 });
  gsap.set('.brand-name', { opacity: 0 });
  gsap.set('.product-image', { y: 80, opacity: 0, scale: 0.92, filter: 'blur(12px)' });
  gsap.set('.savings-badge', { scale: 0, rotation: -20 });
  gsap.set('.bottom-info-bar', { y: 80, opacity: 0 });
  gsap.set('.was-label', { opacity: 0 });
  gsap.set('.original-price-wrap', { scale: 0.6, opacity: 0 });
  gsap.set('.strike-line', { width: '0%' });
  gsap.set('.now-label', { opacity: 0 });
  gsap.set('.new-price', { scale: 2.2, opacity: 0 });

  if (currentSplit && currentSplit.chars) {
    gsap.set(currentSplit.chars, { opacity: 0, y: 22 });
  }

  // -------------------------------------------------------
  // MAIN TIMELINE
  // -------------------------------------------------------
  const tl = gsap.timeline({
    onComplete: () => animateCycle(batchIndex + 1)
  });

  // ---- PHASE 1: Scene reveal (t=0 → 1.2s) ----

  // Accent line grows down
  tl.to('.left-accent-line', {
    scaleY: 1,
    opacity: 1,
    duration: 0.9,
    ease: 'power2.out',
    transformOrigin: 'top center'
  }, 0.1);

  // Product glow blooms
  tl.to('#product-glow', {
    opacity: 0.7,
    duration: 1.2,
    ease: 'power2.inOut'
  }, 0);

  // Category chip drops in
  tl.to('.category-chip', {
    y: 0,
    opacity: 1,
    duration: 0.4,
    ease: 'back.out(1.4)'
  }, 0.45);

  // Brand name slides in
  tl.fromTo('.brand-name',
    { x: -40, opacity: 0 },
    { x: 0, opacity: 1, duration: 0.35, ease: 'power2.out' },
    0.65
  );

  // Bottom bar slides up
  tl.to('.bottom-info-bar', {
    y: 0,
    opacity: 1,
    duration: 0.5,
    ease: 'power2.out'
  }, 0.75);

  // Brand badge (only first cycle)
  if (!badgeShown) {
    badgeShown = true;
    tl.to('#qr-brand-badge', {
      opacity: 1,
      duration: 0.7,
      ease: 'power2.inOut'
    }, 0.3);
  }

  // ---- PHASE 2: Product image arrival (t=0.8 → 1.7s) ----

  tl.to('.product-image', {
    y: 0,
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    duration: 0.85,
    ease: 'power3.out'
  }, 0.75);

  // ---- PHASE 3: Identity reveal (t=1.4 → 2.5s) ----

  // Decorative rule DrawSVG
  tl.fromTo('.decorative-rule line',
    { drawSVG: '0% 0%' },
    { drawSVG: '0% 100%', duration: 0.35, ease: 'power2.inOut' },
    1.4
  );

  // Product name chars stagger in
  if (currentSplit && currentSplit.chars && currentSplit.chars.length > 0) {
    tl.to(currentSplit.chars, {
      opacity: 1,
      y: 0,
      duration: 0.35,
      ease: 'power3.out',
      stagger: 0.018
    }, 1.7);
  }

  // ---- PHASE 4: Price drama (t=3.0 → 5.5s) ----

  // "WAS" label
  tl.to('.was-label', {
    opacity: 1,
    duration: 0.25,
    ease: 'power2.out'
  }, 3.0);

  // Original price scales in
  tl.to('.original-price-wrap', {
    scale: 1,
    opacity: 1,
    duration: 0.4,
    ease: 'back.out(1.2)'
  }, 3.2);

  // Strike-through draws across
  tl.to('.strike-line', {
    width: '112%',
    duration: 0.4,
    ease: 'power2.inOut'
  }, 3.75);

  // Brief pause then "NOW" label
  tl.to('.now-label', {
    opacity: 1,
    duration: 0.22,
    ease: 'power2.out'
  }, 4.3);

  // NEW PRICE SLAMS in — the hero moment
  tl.to('.new-price', {
    scale: 1,
    opacity: 1,
    duration: 0.5,
    ease: 'priceSLAM'
  }, 4.48);

  // Screen flash on slam
  tl.fromTo('#flash-overlay',
    { opacity: 0 },
    { opacity: 0.08, duration: 0.07, yoyo: true, repeat: 1 },
    4.48
  );

  // Savings badge spins in
  tl.to('.savings-badge', {
    scale: 1,
    rotation: -8,
    duration: 0.4,
    ease: 'back.out(2.2)'
  }, 5.05);

  // ---- PHASE 5: Living moment (t=5.5 → 8.5s) ----

  // These use separate tweens so we can kill them at exit
  tl.call(() => {
    // Product image float
    const floatTween = gsap.to('.product-image', {
      y: -24,
      duration: 4.2,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    });
    livingTweens.push(floatTween);

    // Glow pulse
    const glowTween = gsap.to('#product-glow', {
      opacity: 1.0,
      duration: 2.8,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    });
    livingTweens.push(glowTween);

    // Savings badge pulse
    const badgeTween = gsap.to('.savings-badge', {
      scale: 1.05,
      duration: 1.9,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    });
    livingTweens.push(badgeTween);

    // Start particle system
    startParticleLoop();
  }, [], 5.5);

  // ---- PHASE 6: Exit (t=8.5 → 10.0s) ----

  tl.addLabel('exit', 8.5);

  // Kill living loops just before exit
  tl.call(() => {
    stopLivingLoops();
  }, [], 'exit-=0.05');

  // Bottom bar exits down
  tl.to('.bottom-info-bar', {
    y: 80,
    opacity: 0,
    duration: 0.4,
    ease: 'power2.in'
  }, 'exit');

  // Brand/chip/labels slide left
  tl.to(['.category-chip', '.brand-name'], {
    x: -130,
    opacity: 0,
    duration: 0.45,
    ease: 'power2.in',
    stagger: 0.07
  }, 'exit+=0.05');

  // Product name chars slide left (stagger reverse)
  if (currentSplit && currentSplit.chars && currentSplit.chars.length > 0) {
    tl.to(currentSplit.chars, {
      x: -80,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
      stagger: { each: 0.01, from: 'end' }
    }, 'exit+=0.1');
  }

  // Price block exits left
  tl.to(['.was-row', '.now-row', '.savings-badge'], {
    x: -130,
    opacity: 0,
    duration: 0.45,
    ease: 'power2.in',
    stagger: 0.08
  }, 'exit+=0.2');

  // Accent line shrinks
  tl.to('.left-accent-line', {
    scaleY: 0,
    opacity: 0,
    duration: 0.5,
    ease: 'power2.in',
    transformOrigin: 'bottom center'
  }, 'exit+=0.15');

  // Product image exits right
  tl.to('.product-image', {
    x: 200,
    opacity: 0,
    scale: 0.9,
    duration: 0.65,
    ease: 'power2.in'
  }, 'exit+=0.12');

  // Glow fades out
  tl.to('#product-glow', {
    opacity: 0,
    duration: 0.55,
    ease: 'power2.in'
  }, 'exit+=0.1');

  return tl;
}

// =========================================
// LOAD PRODUCTS & KICK OFF
// =========================================
async function loadProducts() {
  try {
    const response = await fetch('./products.json', { cache: 'no-store' });
    const data = await response.json();
    PRODUCTS = data.products || [];
  } catch (error) {
    console.error('Failed to load products.json:', error);
    PRODUCTS = [];
  }

  if (PRODUCTS.length === 0) {
    console.warn('No products found in products.json');
    return;
  }

  // Brief pause to let fonts load
  gsap.delayedCall(0.3, () => {
    animateCycle(0);
  });
}

window.addEventListener('DOMContentLoaded', loadProducts);
