/* script.js */

// 1. Immediate theme check (runs before DOM is fully parsed to prevent flashing)
const savedTheme = localStorage.getItem('theme-pref') || 'system';
function initTheme(theme) {
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
initTheme(savedTheme);

// Listener for system color scheme shifts
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if ((localStorage.getItem('theme-pref') || 'system') === 'system') {
    initTheme('system');
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // Highlight active page link based on path (kept for compatibility)
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll("nav a");
  navLinks.forEach(link => {
    const href = link.getAttribute("href");
    if (currentPath === href || (href !== "/" && currentPath.includes(href))) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  // 2. Theme switch button listeners
  const themeButtons = document.querySelectorAll(".theme-btn");
  
  function applyTheme(theme) {
    initTheme(theme);
    localStorage.setItem('theme-pref', theme);
    
    themeButtons.forEach(btn => {
      if (btn.getAttribute('data-theme-val') === theme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Set initial button active states and register click events
  themeButtons.forEach(btn => {
    if (btn.getAttribute('data-theme-val') === (localStorage.getItem('theme-pref') || 'system')) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
    
    btn.addEventListener('click', () => {
      applyTheme(btn.getAttribute('data-theme-val'));
    });
  });
});
