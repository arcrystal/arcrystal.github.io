document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname.split('/').pop();
    const navIcons = document.querySelectorAll('.nav-icon');

    navIcons.forEach(icon => {
        if(icon.href.includes(currentPage)) {
            icon.classList.add('current-page');
        }
    });
});