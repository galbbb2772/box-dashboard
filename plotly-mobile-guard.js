(() => {
  if (!window.Plotly || window.__FROZEN_PLOTLY_GUARD__) return;
  window.__FROZEN_PLOTLY_GUARD__ = true;

  const TOUCH_UI = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || window.innerWidth <= 900;
  const originalNewPlot = Plotly.newPlot.bind(Plotly);
  const originalReact = Plotly.react.bind(Plotly);

  function normalizeLayout(layout = {}) {
    const out = { ...layout };
    if (TOUCH_UI) out.dragmode = false;
    Object.keys(out).forEach((key) => {
      if (/^[xy]axis\d*$/.test(key) && out[key] && typeof out[key] === 'object') {
        out[key] = { ...out[key], fixedrange: TOUCH_UI ? true : out[key].fixedrange };
      }
    });
    return out;
  }

  function normalizeConfig(config = {}) {
    return {
      ...config,
      responsive: true,
      displaylogo: false,
      scrollZoom: false,
      doubleClick: 'reset',
      displayModeBar: TOUCH_UI ? false : (config.displayModeBar ?? true),
      modeBarButtonsToRemove: Array.from(new Set([
        ...(config.modeBarButtonsToRemove || []),
        'select2d',
        'lasso2d'
      ]))
    };
  }

  function rememberAxes(gd, layout) {
    const el = typeof gd === 'string' ? document.getElementById(gd) : gd;
    if (!el || el.__frozenAxisDefaults) return;
    const defaults = {};
    Object.keys(layout).forEach((key) => {
      if (!/^[xy]axis\d*$/.test(key) || !layout[key] || typeof layout[key] !== 'object') return;
      const axis = layout[key];
      defaults[key] = Array.isArray(axis.range)
        ? { range: [...axis.range], autorange: false }
        : { autorange: axis.autorange !== false };
    });
    el.__frozenAxisDefaults = defaults;
  }

  Plotly.newPlot = function(gd, data, layout = {}, config = {}) {
    const safeLayout = normalizeLayout(layout);
    rememberAxes(gd, safeLayout);
    return originalNewPlot(gd, data, safeLayout, normalizeConfig(config));
  };

  Plotly.react = function(gd, data, layout = {}, config = {}) {
    const safeLayout = normalizeLayout(layout);
    rememberAxes(gd, safeLayout);
    return originalReact(gd, data, safeLayout, normalizeConfig(config));
  };

  function resetAllPlots() {
    document.querySelectorAll('.js-plotly-plot').forEach((el) => {
      const defs = el.__frozenAxisDefaults || {};
      const patch = {};
      Object.entries(defs).forEach(([axis, state]) => {
        if (state.range) {
          patch[`${axis}.range`] = state.range;
          patch[`${axis}.autorange`] = false;
        } else {
          patch[`${axis}.autorange`] = true;
        }
      });
      if (Object.keys(patch).length) Plotly.relayout(el, patch).catch(() => {});
    });
  }

  function loadBo50ExactOverlay() {
    if (!document.getElementById('historical') || window.__FROZEN_BO50_EXACT_LOADER__) return;
    window.__FROZEN_BO50_EXACT_LOADER__ = true;
    const script = document.createElement('script');
    script.src = 'bo50-exact-overlay.js';
    script.async = true;
    script.dataset.frozenBo50Exact = '1';
    document.head.appendChild(script);
  }

  function installUi() {
    const style = document.createElement('style');
    style.textContent = `
      #frozenPlotReset{position:fixed;right:14px;bottom:14px;z-index:99999;border:1px solid #43536f;background:rgba(12,18,29,.94);color:#eaf1ff;border-radius:999px;padding:9px 13px;font:700 12px system-ui,-apple-system,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.28);cursor:pointer;touch-action:manipulation}
      #frozenPlotReset:active{transform:scale(.98)}
      @media(max-width:900px){.js-plotly-plot,.js-plotly-plot .plot-container{touch-action:pan-y!important}}
    `;
    document.head.appendChild(style);
    const btn = document.createElement('button');
    btn.id = 'frozenPlotReset';
    btn.type = 'button';
    btn.textContent = '↺ 重置图表';
    btn.title = TOUCH_UI ? '手机端已锁定误触缩放；点此恢复所有图表视图' : '恢复所有图表的默认视图';
    btn.addEventListener('click', resetAllPlots);
    document.body.appendChild(btn);
    loadBo50ExactOverlay();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installUi, { once: true });
  else installUi();
})();
