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
  // Highlight active page link based on path
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll("nav a");
  navLinks.forEach(link => {
    const href = link.getAttribute("href");
    const isHome = href === "index.html" || href === "/";
    const isCurrentHome = currentPath === "/" || currentPath.includes("index.html");
    
    if ((isHome && isCurrentHome) || (!isHome && href !== "#" && currentPath.includes(href))) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  // Highlight products dropdown trigger if on a product page
  if (currentPath.includes("open911") || currentPath.includes("resumerx")) {
    const productsTrigger = document.getElementById("productsTrigger");
    if (productsTrigger) {
      productsTrigger.classList.add("active");
    }
  }

  // 2. Theme switcher dropdown toggle and close behavior
  const themeDropdown = document.getElementById("themeDropdown");
  const themeTrigger = document.getElementById("themeTrigger");

  if (themeTrigger && themeDropdown) {
    themeTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      themeDropdown.classList.toggle("open");
    });
  }

  document.addEventListener("click", (e) => {
    if (themeDropdown && !themeDropdown.contains(e.target)) {
      themeDropdown.classList.remove("open");
    }
  });

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

    if (themeDropdown) {
      themeDropdown.classList.remove("open");
    }
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
