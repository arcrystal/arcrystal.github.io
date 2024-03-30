// Example array of images from the "brilliants" directory
const images = [
    'brilliants/b01.png',
    'brilliants/b02.png',
    'brilliants/b03.png',
    'brilliants/b04.png',
    'brilliants/b05.png',
    'brilliants/b06.png',
    'brilliants/b07.png',
    'brilliants/b08.png',
    'brilliants/b09.png',
    'brilliants/b10.png',
    'brilliants/b11.png',
    'brilliants/b12.png',
    'brilliants/b13.png'
];
const texts = [
    "Image 1 Description",
    "Image 2 Description",
    "Image 3 Description",
    "Image 1 Description",
    "Image 2 Description",
    "Image 3 Description",
    "Image 1 Description",
    "Image 2 Description",
    "Image 3 Description",
    "Image 1 Description",
    "Image 2 Description",
    "Image 3 Description",
    "Image 1 Description"
];

let slideshowIndex = 0; // Current index of the slideshow
let timer = null; // For automatic slide change

// Function to change and show the slide
function showSlide(index) {
    // Adjust index for navigation
    slideshowIndex += index;
    if (slideshowIndex >= images.length) { slideshowIndex = 0; }
    if (slideshowIndex < 0) { slideshowIndex = images.length - 1; }

    const slideshow = document.getElementById('slideshow');
    slideshow.style.backgroundImage = `url(${images[slideshowIndex]})`;
    const slideshowText = document.getElementById('slideshowText');
    slideshowText.textContent = texts[slideshowIndex];

    // Reset and restart the automatic slideshow timer
    clearTimeout(timer);
    timer = setTimeout(() => showSlide(1), 6000); // Change slide every 6 seconds
}

// Initial setup to show the first slide and start automatic cycling
window.onload = () => {
    showSlide(0);

    // Optionally preload images
    images.forEach(image => {
        const img = new Image();
        img.src = image;
    });
};

function playAudio() {
    document.getElementById('audioPlayer').play();
}

function changeAudio(source) {
    const audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.src = source;
    audioPlayer.play();
}
