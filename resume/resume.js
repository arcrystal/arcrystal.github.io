document.getElementById('toggleAbstract').addEventListener('click', function() {
    var abstractContent = document.getElementById('abstract-content');
    if (abstractContent.style.display === 'none') {
        abstractContent.style.display = 'block';
        this.textContent = 'Hide Abstract';
    } else {
        abstractContent.style.display = 'none';
        this.textContent = 'Show Abstract';
    }
});


document.addEventListener("DOMContentLoaded", () => {
    const sections = document.querySelectorAll("section");
    const navLinks = document.querySelectorAll('.navigation ul li a');

    // Function to remove 'active' class from all nav links
    const removeActiveClass = () => {
        navLinks.forEach(link => {
            link.classList.remove('active');
        });
    };

    // Function to add 'active' class to the nav link corresponding to visible section
    const addActiveClass = (id) => {
        const activeLink = document.querySelector(`.navigation ul li a[href="#${id}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    };

    // IntersectionObserver to watch section visibility changes
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                removeActiveClass();
                addActiveClass(id);
            }
        });
    }, { rootMargin: "-50% 0px -50% 0px", threshold: 0.1 });

    // Observing each section
    sections.forEach(section => {
        observer.observe(section);
    });

    // Smooth scrolling setup
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetSection = document.querySelector(this.getAttribute('href'));
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
});

document.addEventListener("DOMContentLoaded", function() {
    // Function to handle adding and removing the 'active' class
    function makeActive(evt) {
        const fromTop = window.scrollY;

        // Remove 'active' class from all links
        navLinks.forEach(link => {
            link.classList.remove('active');
        });

        // Add 'active' class to the link whose section is currently in view
        navLinks.forEach(link => {
            let section = document.querySelector(link.hash);

            if (
                section.offsetTop <= fromTop &&
                section.offsetTop + section.offsetHeight > fromTop
            ) {
                link.classList.add('active');
            }
        });
    }

    // Select navigation links
    const navLinks = document.querySelectorAll('.navigation a');

    // Add 'click' event listeners to navigation links for smooth scrolling
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetSection = document.querySelector(this.getAttribute('href'));
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // Call makeActive function on scroll and on initial load
    window.addEventListener('scroll', makeActive);
    makeActive(); // Initialize on load

});
