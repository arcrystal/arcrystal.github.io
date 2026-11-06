// Page tool, mounted by the single-page app (static/app/pages). Runs once per visit to the page.
export function mount() {
    document.querySelector('[data-print]')?.addEventListener('click', () => window.print());

    const links = [...document.querySelectorAll('.resume-index nav a')];
    const sections = links.map((link) => document.querySelector(link.hash)).filter(Boolean);
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            const visible = entries
                .filter((entry) => entry.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (!visible) return;
            links.forEach((link) => link.classList.toggle('active', link.hash === `#${visible.target.id}`));
        }, { rootMargin: '-25% 0px -60%', threshold: [0,.25,.5] });
        sections.forEach((section) => observer.observe(section));
        return () => observer.disconnect();
    }
}
