// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Contact form submission
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
        e.preventDefault();
        
        // Get form values
        const name = this.querySelector('input[type="text"]').value;
        const email = this.querySelector('input[type="email"]').value;
        const message = this.querySelector('textarea').value;
        
        // Simple validation
        if (name && email && message) {
            // Show success message
            alert('Thank you for your message! We will get back to you soon.');
            
            // Reset form
            this.reset();
        } else {
            alert('Please fill in all fields.');
        }
    });
}

// Add active state to navigation links on scroll
window.addEventListener('scroll', () => {
    let current = '';
    
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (pageYOffset >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });
    
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').slice(1) === current) {
            link.classList.add('active');
        }
    });
});

// Add animation to feature cards on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.feature-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(card);
});

// Login button functionality
const loginBtn = document.querySelector('.btn-login');
if (loginBtn) {
    loginBtn.addEventListener('click', function(e) {
        e.preventDefault();
        alert('Login functionality would be implemented here.');
    });
}

// Demo button functionality
const demoBtn = document.querySelector('.btn-secondary');
if (demoBtn) {
    demoBtn.addEventListener('click', function(e) {
        e.preventDefault();
        alert('Demo video would play here.');
    });
}

// Start Free Trial button
const trialBtn = document.querySelector('.btn-primary');
if (trialBtn) {
    trialBtn.addEventListener('click', function(e) {
        e.preventDefault();
        alert('Sign up for free trial would open here.');
    });
}

console.log('OurSideHQ website loaded successfully!');
