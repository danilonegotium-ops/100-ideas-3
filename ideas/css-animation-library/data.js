// CSS Animation Library — seed data.
// Each entry's `css` field is BOTH the live demo stylesheet (injected into
// <head> by app.js) and the exact text copied to the clipboard when the
// user clicks "Copy CSS". Single source of truth, no drift between demo and copy.
//
// `demoClass` must match the class name defined inside `css`.
// `category` groups animations for the sidebar/chip filter — one of the ids
// listed in CATEGORIES below.

const CATEGORIES = [
  { id: "entrance", label: "Entrances", accent: "#818cf8", accentRgb: "129, 140, 248" },
  { id: "exit", label: "Exits", accent: "#fbbf24", accentRgb: "251, 191, 36" },
  { id: "attention", label: "Attention Seekers", accent: "#ff7eb0", accentRgb: "255, 126, 176" }
];

const ANIMATIONS = [
  {
    id: "fade-in",
    name: "Fade In",
    demoClass: "anim-fade-in",
    category: "entrance",
    css: `.fade-in {
  animation: fadeIn 0.9s ease both;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}`
  },
  {
    id: "fade-out",
    name: "Fade Out",
    demoClass: "anim-fade-out",
    category: "exit",
    css: `.fade-out {
  animation: fadeOut 0.9s ease both;
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}`
  },
  {
    id: "slide-in-left",
    name: "Slide In Left",
    demoClass: "anim-slide-in-left",
    category: "entrance",
    css: `.slide-in-left {
  animation: slideInLeft 0.6s cubic-bezier(.25,.8,.25,1) both;
}

@keyframes slideInLeft {
  from { transform: translateX(-100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}`
  },
  {
    id: "slide-in-right",
    name: "Slide In Right",
    demoClass: "anim-slide-in-right",
    category: "entrance",
    css: `.slide-in-right {
  animation: slideInRight 0.6s cubic-bezier(.25,.8,.25,1) both;
}

@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}`
  },
  {
    id: "slide-in-up",
    name: "Slide In Up",
    demoClass: "anim-slide-in-up",
    category: "entrance",
    css: `.slide-in-up {
  animation: slideInUp 0.6s cubic-bezier(.25,.8,.25,1) both;
}

@keyframes slideInUp {
  from { transform: translateY(60%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}`
  },
  {
    id: "slide-in-down",
    name: "Slide In Down",
    demoClass: "anim-slide-in-down",
    category: "entrance",
    css: `.slide-in-down {
  animation: slideInDown 0.6s cubic-bezier(.25,.8,.25,1) both;
}

@keyframes slideInDown {
  from { transform: translateY(-60%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}`
  },
  {
    id: "bounce",
    name: "Bounce",
    demoClass: "anim-bounce",
    category: "attention",
    css: `.bounce {
  animation: bounce 1s ease infinite;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-22px); }
  60% { transform: translateY(-11px); }
}`
  },
  {
    id: "pulse",
    name: "Pulse",
    demoClass: "anim-pulse",
    category: "attention",
    css: `.pulse {
  animation: pulse 1.1s ease infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.12); }
  100% { transform: scale(1); }
}`
  },
  {
    id: "shake",
    name: "Shake",
    demoClass: "anim-shake",
    category: "attention",
    css: `.shake {
  animation: shake 0.7s ease infinite;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
  20%, 40%, 60%, 80% { transform: translateX(8px); }
}`
  },
  {
    id: "spin",
    name: "Spin",
    demoClass: "anim-spin",
    category: "attention",
    css: `.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}`
  },
  {
    id: "flip-in-x",
    name: "Flip In X",
    demoClass: "anim-flip-in-x",
    category: "entrance",
    css: `.flip-in-x {
  animation: flipInX 0.8s ease both;
  backface-visibility: visible;
}

@keyframes flipInX {
  from { transform: perspective(400px) rotateX(90deg); opacity: 0; }
  40% { transform: perspective(400px) rotateX(-12deg); }
  70% { transform: perspective(400px) rotateX(6deg); }
  to { transform: perspective(400px) rotateX(0deg); opacity: 1; }
}`
  },
  {
    id: "flip-in-y",
    name: "Flip In Y",
    demoClass: "anim-flip-in-y",
    category: "entrance",
    css: `.flip-in-y {
  animation: flipInY 0.8s ease both;
  backface-visibility: visible;
}

@keyframes flipInY {
  from { transform: perspective(400px) rotateY(90deg); opacity: 0; }
  40% { transform: perspective(400px) rotateY(-12deg); }
  70% { transform: perspective(400px) rotateY(6deg); }
  to { transform: perspective(400px) rotateY(0deg); opacity: 1; }
}`
  },
  {
    id: "zoom-in",
    name: "Zoom In",
    demoClass: "anim-zoom-in",
    category: "entrance",
    css: `.zoom-in {
  animation: zoomIn 0.6s ease both;
}

@keyframes zoomIn {
  from { transform: scale(0.3); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}`
  },
  {
    id: "zoom-out",
    name: "Zoom Out",
    demoClass: "anim-zoom-out",
    category: "exit",
    css: `.zoom-out {
  animation: zoomOut 0.6s ease both;
}

@keyframes zoomOut {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(0.3); opacity: 0; }
}`
  },
  {
    id: "rotate-in",
    name: "Rotate In",
    demoClass: "anim-rotate-in",
    category: "entrance",
    css: `.rotate-in {
  animation: rotateIn 0.7s ease both;
  transform-origin: center;
}

@keyframes rotateIn {
  from { transform: rotate(-200deg); opacity: 0; }
  to { transform: rotate(0deg); opacity: 1; }
}`
  },
  {
    id: "wobble",
    name: "Wobble",
    demoClass: "anim-wobble",
    category: "attention",
    css: `.wobble {
  animation: wobble 1s ease infinite;
}

@keyframes wobble {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  15% { transform: translateX(-18px) rotate(-6deg); }
  30% { transform: translateX(14px) rotate(5deg); }
  45% { transform: translateX(-10px) rotate(-3deg); }
  60% { transform: translateX(8px) rotate(2deg); }
  75% { transform: translateX(-4px) rotate(-1deg); }
}`
  },
  {
    id: "heartbeat",
    name: "Heartbeat",
    demoClass: "anim-heartbeat",
    category: "attention",
    css: `.heartbeat {
  animation: heartbeat 1.1s ease infinite;
}

@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  14% { transform: scale(1.2); }
  28% { transform: scale(1); }
  42% { transform: scale(1.2); }
  70% { transform: scale(1); }
}`
  },
  {
    id: "swing",
    name: "Swing",
    demoClass: "anim-swing",
    category: "attention",
    css: `.swing {
  animation: swing 1s ease infinite;
  transform-origin: top center;
}

@keyframes swing {
  20% { transform: rotate(12deg); }
  40% { transform: rotate(-9deg); }
  60% { transform: rotate(6deg); }
  80% { transform: rotate(-3deg); }
  100% { transform: rotate(0deg); }
}`
  },
  {
    id: "rubber-band",
    name: "Rubber Band",
    demoClass: "anim-rubber-band",
    category: "attention",
    css: `.rubber-band {
  animation: rubberBand 0.9s ease infinite;
}

@keyframes rubberBand {
  0% { transform: scale3d(1, 1, 1); }
  30% { transform: scale3d(1.25, 0.75, 1); }
  50% { transform: scale3d(0.85, 1.15, 1); }
  70% { transform: scale3d(1.1, 0.9, 1); }
  100% { transform: scale3d(1, 1, 1); }
}`
  },
  {
    id: "flash",
    name: "Flash",
    demoClass: "anim-flash",
    category: "attention",
    css: `.flash {
  animation: flash 1s ease infinite;
}

@keyframes flash {
  0%, 50%, 100% { opacity: 1; }
  25%, 75% { opacity: 0; }
}`
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ANIMATIONS, CATEGORIES };
}
