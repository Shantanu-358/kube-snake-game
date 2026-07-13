/**
 * GameHub Catalog Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const gameCards = document.querySelectorAll('.game-card:not(.disabled)');
    const overlay = document.getElementById('gameOverlay');
    const closeBtn = document.getElementById('btnCloseOverlay');
    const iframe = document.getElementById('gameIframe');
    const iframeLoader = document.getElementById('iframeLoader');
    const hudGameName = document.getElementById('hudGameName');
    
    // Launch Game Action
    const launchGame = (card) => {
        const gameUrl = card.getAttribute('data-game-url');
        const gameTitle = card.getAttribute('data-game-title');
        
        if (!gameUrl) return;
        
        // Update HUD
        hudGameName.textContent = gameTitle.toUpperCase();
        
        // Show Loader & Overlay
        iframeLoader.style.opacity = '1';
        iframeLoader.style.display = 'flex';
        overlay.style.display = 'flex';
        
        // Trigger reflow for transition
        void overlay.offsetWidth;
        overlay.classList.add('active');
        
        // Load Game URL
        iframe.src = gameUrl;
        
        // Track focus redirection
        iframe.addEventListener('load', handleIframeLoad, { once: true });
    };

    // Close Game Overlay
    const closeOverlay = () => {
        overlay.classList.remove('active');
        
        // Smoothly fade out overlay before cleaning up source
        setTimeout(() => {
            overlay.style.display = 'none';
            // Reset iframe source to release memory/stop audio threads
            iframe.src = '';
            iframeLoader.style.opacity = '1';
            iframeLoader.style.display = 'flex';
        }, 400);
    };

    // Hide loader once Iframe finishes rendering
    const handleIframeLoad = () => {
        setTimeout(() => {
            iframeLoader.style.opacity = '0';
            setTimeout(() => {
                iframeLoader.style.display = 'none';
                // Automatically focus the iframe so game controls work immediately
                iframe.focus();
            }, 300);
        }, 800); // Small deliberate delay to let UI transition complete nicely
    };

    // Bind event listeners to playable game cards
    gameCards.forEach(card => {
        const launchBtn = card.querySelector('.btn-launch');
        
        // Clicking anywhere on card launches the game
        card.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                launchGame(card);
            }
        });
        
        if (launchBtn) {
            launchBtn.addEventListener('click', () => {
                launchGame(card);
            });
        }
    });

    // Close action event listeners
    closeBtn.addEventListener('click', closeOverlay);
    
    // Close overlay on ESC key press
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeOverlay();
        }
    });

    // Listen for postMessages from inside game iframe (e.g. Exit event)
    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'exit-game') {
            closeOverlay();
        }
    });
});
