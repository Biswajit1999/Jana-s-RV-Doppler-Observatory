(function initialiseInterfaceMotion() {
  'use strict'

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const localLibraryIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"></path><path d="M8 9h8M8 13h5M8 17h7"></path></svg><span>Local RV library</span>'

  function syncNavigation() {
    const active = document.querySelector('.tab-panel.active')?.id
    document.querySelectorAll('.nav-item').forEach((button) => {
      const selected = button.dataset.tab === active
      if (selected) button.setAttribute('aria-current', 'page')
      else button.removeAttribute('aria-current')
    })
  }

  function decorateDynamicNavigation() {
    const button = document.querySelector('.nav-item[data-tab="localrv"]')
    if (button && !button.querySelector('svg')) button.innerHTML = localLibraryIcon
    syncNavigation()
  }

  function setupMobileNavigation() {
    const sidebar = document.querySelector('.sidebar')
    const toggle = document.getElementById('navToggle')
    if (!sidebar || !toggle) return

    const setOpen = (open) => {
      sidebar.classList.toggle('nav-open', open)
      toggle.setAttribute('aria-expanded', String(open))
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation')
    }

    toggle.addEventListener('click', () => setOpen(!sidebar.classList.contains('nav-open')))
    sidebar.addEventListener('click', (event) => {
      if (event.target.closest('.nav-item') && window.innerWidth <= 700) setOpen(false)
    })
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false)
    })
    window.addEventListener('resize', () => {
      if (window.innerWidth > 700) setOpen(false)
    }, { passive: true })
  }

  function setupReveals() {
    const candidates = document.querySelectorAll('.ops-ribbon > *, .hero-console > *, .dashboard-grid > *, .two-column-grid > *, .section-intro')
    candidates.forEach((element) => element.setAttribute('data-reveal', ''))

    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      candidates.forEach((element) => element.classList.add('is-visible'))
      return
    }

    document.documentElement.classList.add('motion-ready')
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { rootMargin: '0px 0px -7% 0px', threshold: .08 })

    candidates.forEach((element, index) => {
      element.style.transitionDelay = `${Math.min(index % 5, 4) * 45}ms`
      observer.observe(element)
    })
  }

  function setupPanelTransitions() {
    const panels = document.querySelectorAll('.tab-panel')
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        const panel = record.target
        if (!panel.classList.contains('active')) return
        syncNavigation()
        if (reduceMotion.matches || typeof panel.animate !== 'function') return
        panel.animate([
          { opacity: .45, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 360, easing: 'cubic-bezier(.22, 1, .36, 1)' })
      })
    })
    panels.forEach((panel) => observer.observe(panel, { attributes: true, attributeFilter: ['class'] }))
  }

  function setupThemeControl() {
    const button = document.getElementById('themeToggle')
    if (!button) return
    const update = () => {
      const night = document.documentElement.dataset.theme === 'night'
      const next = night ? 'light' : 'dark'
      const icon = button.querySelector('svg')
      if (icon) icon.innerHTML = night
        ? '<path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z"></path>'
        : '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"></path>'
      button.setAttribute('aria-label', `Switch to ${next} theme`)
      button.setAttribute('title', `Switch to ${next} theme`)
    }
    button.addEventListener('click', () => window.requestAnimationFrame(update))
    update()
  }

  window.addEventListener('DOMContentLoaded', () => {
    decorateDynamicNavigation()
    setupMobileNavigation()
    setupThemeControl()
    setupPanelTransitions()
    window.requestAnimationFrame(setupReveals)

    const nav = document.querySelector('.side-nav')
    if (nav) new MutationObserver(decorateDynamicNavigation).observe(nav, { childList: true })
  })
})()
