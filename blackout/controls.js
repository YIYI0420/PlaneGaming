(function(root, factory) {
  const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.BlackoutControls = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  class MouseControls {
    constructor(element, doc, { enabled, engage, look }) {
      this.buttons = 0; this.last = { x: 0, y: 0 }; this.element = element; this.doc = doc;
      this.down = event => {
        if (!enabled() || event.sourceCapabilities?.firesTouchEvents || ![0, 2].includes(event.button)) return;
        if (event.target !== element && doc.pointerLockElement !== element) return;
        event.preventDefault(); this.buttons = event.buttons & 3; this.last = { x: event.clientX, y: event.clientY };
        if (doc.pointerLockElement !== element) engage();
      };
      this.up = event => { this.buttons = enabled() ? event.buttons & 3 : 0; };
      this.move = event => {
        if (!enabled()) { this.reset(); return; }
        const locked = doc.pointerLockElement === element;
        if (!locked && !this.buttons) return;
        this.buttons = event.buttons & 3;
        const dx = locked ? event.movementX : event.clientX - this.last.x, dy = locked ? event.movementY : event.clientY - this.last.y;
        this.last = { x: event.clientX, y: event.clientY }; look(dx || 0, dy || 0);
      };
      // Mouse events report every button transition; pointerdown/up only report the first/last button of a chord.
      doc.addEventListener('mousedown', this.down); doc.addEventListener('mouseup', this.up); doc.addEventListener('mousemove', this.move);
      element.addEventListener('contextmenu', event => event.preventDefault());
    }
    get fire() { return !!(this.buttons & 1); }
    get aim() { return !!(this.buttons & 2); }
    reset() { this.buttons = 0; }
  }
  return { MouseControls };
});
