/**
 * assessment.js — Step-by-step spiritual assessment
 */
requireAuth();

let categories  = [];
let responses   = {};   // { gift_category_id: score }
let notes       = {};   // { gift_category_id: journal note }
let currentStep = 0;    // 0-based index into categories
const TOTAL     = 7;

// =============================================
// Init
// =============================================
async function init() {
  document.getElementById('back-btn').addEventListener('click', () => {
    if (confirm('Exit assessment? Your progress will be lost.')) {
      window.location.href = '/dashboard.html';
    }
  });

  try {
    categories = await api.get('/assessments/categories');
    categories.sort((a, b) => a.sort_order - b.sort_order);

    // Default all scores to 5, notes to empty
    categories.forEach(c => { responses[c.id] = 5; notes[c.id] = ''; });

    buildSteps();
    buildDots();
    updateProgress();

    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('steps-container').classList.remove('hidden');
    document.getElementById('assess-nav').classList.remove('hidden');
    showStep(0);
  } catch (err) {
    document.getElementById('loading-state').innerHTML =
      `<p class="text-muted">Failed to load assessment. <a href="/assessment.html">Retry</a></p>`;
  }

  document.getElementById('prev-btn').addEventListener('click', prevStep);
  document.getElementById('next-btn').addEventListener('click', nextStep);
  document.getElementById('submit-btn').addEventListener('click', submitAssessment);
}

// =============================================
// Build DOM for all steps
// =============================================
function buildSteps() {
  const container = document.getElementById('steps-container');
  container.innerHTML = '';

  categories.forEach((cat, idx) => {
    const div = document.createElement('div');
    div.className = 'step-card';
    div.id = `step-${idx}`;
    div.innerHTML = `
      <div class="card" style="padding:0; overflow:hidden;">
        <div class="step-gift-header" style="padding: 20px 16px 16px;">
          <div class="step-number">Gift ${cat.sort_order} of ${TOTAL}</div>
          <div class="step-gift-name">${cat.name}</div>
          <div class="step-struggle">Core Struggle: ${cat.core_struggle}</div>
        </div>
        <div class="step-body">

          <div class="slider-section">
            <div class="slider-labels">
              <div class="slider-label-item slider-label-natural">
                ← Natural State<br>${cat.natural_state_label}
              </div>
              <div class="slider-label-item slider-label-spiritual">
                Spiritual State →<br>${cat.spiritual_state_label}
              </div>
            </div>

            <input
              type="range"
              class="gift-slider"
              id="slider-${cat.id}"
              min="1"
              max="10"
              step="1"
              value="5"
              aria-label="${cat.name} score">

            <div class="slider-value-display">
              <div class="slider-score-badge" id="badge-${cat.id}"
                   style="background:${scoreColor(5)}">5</div>
              <div class="slider-score-zone" id="zone-${cat.id}">${scoreZone(5)}</div>
            </div>
          </div>

          <div class="slider-descriptions">
            <div class="slider-desc-item slider-desc-natural">
              <span class="desc-label">Natural (1–3)</span>
              ${cat.natural_description || cat.natural_state_label}
            </div>
            <div class="slider-desc-item slider-desc-spiritual">
              <span class="desc-label">Spiritual (7–10)</span>
              ${cat.spiritual_description || cat.spiritual_state_label}
            </div>
          </div>

          <div class="step-journal">
            <label class="form-label step-journal-label">
              <span class="material-icons" style="font-size:16px;vertical-align:middle;margin-right:4px;">edit_note</span>
              Journal Note
            </label>
            <textarea
              class="form-input form-textarea step-journal-textarea"
              id="note-${cat.id}"
              placeholder="Reflect on where you are with ${cat.name} today…"
              maxlength="500"
              rows="3"></textarea>
            <div class="step-journal-count"><span id="note-count-${cat.id}">0</span> / 500</div>
          </div>

        </div>
      </div>
    `;
    container.appendChild(div);

    // Slider live update
    const slider = div.querySelector(`#slider-${cat.id}`);
    slider.addEventListener('input', () => onSliderChange(cat.id, parseInt(slider.value)));

    // Journal note live update
    const textarea = div.querySelector(`#note-${cat.id}`);
    textarea.addEventListener('input', () => {
      notes[cat.id] = textarea.value;
      document.getElementById(`note-count-${cat.id}`).textContent = textarea.value.length;
    });
  });
}

function onSliderChange(catId, value) {
  responses[catId] = value;
  document.getElementById(`badge-${catId}`).textContent = value;
  document.getElementById(`badge-${catId}`).style.background = scoreColor(value);
  document.getElementById(`zone-${catId}`).textContent = scoreZone(value);
}

// =============================================
// Step navigation
// =============================================
function buildDots() {
  const container = document.getElementById('step-dots');
  container.innerHTML = '';
  for (let i = 0; i < TOTAL; i++) {
    const dot = document.createElement('div');
    dot.className = 'step-dot';
    dot.id = `dot-${i}`;
    container.appendChild(dot);
  }
}

function showStep(index) {
  // Hide all steps
  document.querySelectorAll('.step-card').forEach(el => el.classList.remove('active'));

  if (index >= TOTAL) {
    // Show review
    showReview();
    return;
  }

  currentStep = index;
  document.getElementById(`step-${index}`).classList.add('active');

  document.getElementById('progress-label').textContent = `${index + 1} / ${TOTAL}`;
  document.getElementById('prev-btn').disabled = (index === 0);
  document.getElementById('next-btn').textContent = index === TOTAL - 1 ? 'Review' : 'Next';
  // Remove arrow icon when last step turns to Review
  document.getElementById('next-btn').innerHTML = index === TOTAL - 1
    ? 'Review <span class="material-icons">done_all</span>'
    : 'Next <span class="material-icons">chevron_right</span>';

  updateDots(index);
  updateProgress();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateDots(active) {
  for (let i = 0; i < TOTAL; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (i < active) { dot.className = 'step-dot done'; }
    else if (i === active) { dot.className = 'step-dot active'; }
    else { dot.className = 'step-dot'; }
  }
}

function updateProgress() {
  const pct = ((currentStep) / TOTAL) * 100;
  document.getElementById('step-fill').style.width = `${pct}%`;
}

function prevStep() { if (currentStep > 0) showStep(currentStep - 1); }
function nextStep()  { showStep(currentStep + 1); }

// =============================================
// Review screen
// =============================================
function showReview() {
  document.getElementById('steps-container').classList.add('hidden');
  document.getElementById('assess-nav').classList.add('hidden');
  document.getElementById('review-screen').classList.remove('hidden');

  // Fill progress to full
  document.getElementById('step-fill').style.width = '100%';
  document.getElementById('progress-label').textContent = 'Review';

  const listEl = document.getElementById('review-list');
  listEl.innerHTML = categories.map((cat, idx) => {
    const score = responses[cat.id];
    return `
      <div class="review-row">
        <div class="avatar avatar-sm" style="background:${scoreColor(score)};font-size:.8rem">${score}</div>
        <div class="review-gift-name">${cat.name}</div>
        <input type="range" class="gift-slider" style="flex:1;height:6px"
               id="review-slider-${cat.id}" min="1" max="10" step="1" value="${score}">
      </div>
    `;
  }).join('');

  // Attach update handlers to review sliders too
  categories.forEach(cat => {
    const slider = document.getElementById(`review-slider-${cat.id}`);
    slider.addEventListener('input', () => {
      const val = parseInt(slider.value);
      responses[cat.id] = val;
      slider.previousElementSibling.textContent  = val;
      slider.previousElementSibling.style.background = scoreColor(val);
    });
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// Submit
// =============================================
async function submitAssessment() {
  hideAlert('submit-error');
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px"></span> Saving…';

  const payload = {
    responses: categories.map(cat => ({
      gift_category_id: cat.id,
      score: responses[cat.id],
      note: (notes[cat.id] || '').trim() || null
    })),
    notes: (document.getElementById('assessment-notes').value || '').trim() || null
  };

  try {
    await api.post('/assessments', payload);
    showSuccess();
  } catch (err) {
    showAlert('submit-error', err.error || 'Failed to save assessment. Please try again.');
    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons" style="vertical-align:middle;margin-right:4px">check_circle</span>Submit Assessment';
  }
}

function showSuccess() {
  document.getElementById('review-screen').classList.add('hidden');
  document.getElementById('success-screen').classList.remove('hidden');
  document.getElementById('step-fill').style.width = '100%';
  document.getElementById('progress-label').textContent = 'Complete!';

  const scores = document.getElementById('success-scores');
  scores.innerHTML = categories.map(cat => {
    const s = responses[cat.id];
    return `
      <div class="gift-score-row">
        <div class="gift-score-name">${cat.short_name}</div>
        <div class="gift-score-bar-track">
          <div class="gift-score-bar-fill" style="width:${s * 10}%;background:${scoreColor(s)}"></div>
        </div>
        <div class="gift-score-value" style="color:${scoreColor(s)}">${s}</div>
      </div>
    `;
  }).join('');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// Start
// =============================================
init();
