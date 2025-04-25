// mainmenu.js - Basic main menu for the raycasting game

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const menuOptions = ['Start Game', 'Instructions', 'Settings'];
let selectedOption = 0;
let onStartGameCallback = null;

function drawMenu() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'white';
  ctx.font = '48px Arial';
  ctx.textAlign = 'center';

  ctx.fillText('Raycasting Game', canvas.width / 2, 100);

  ctx.font = '32px Arial';

  menuOptions.forEach((option, index) => {
    if (index === selectedOption) {
      ctx.fillStyle = 'yellow';
    } else {
      ctx.fillStyle = 'white';
    }
    ctx.fillText(option, canvas.width / 2, 200 + index * 60);
  });
}

function moveSelectionUp() {
  selectedOption = (selectedOption - 1 + menuOptions.length) % menuOptions.length;
  drawMenu();
}

function moveSelectionDown() {
  selectedOption = (selectedOption + 1) % menuOptions.length;
  drawMenu();
}

function selectOption() {
  const option = menuOptions[selectedOption];
  switch(option) {
    case 'Start Game':
      if (onStartGameCallback) {
        onStartGameCallback();
      }
      break;
      case 'Instructions':
        // Create a modal or a popup to display the instructions
        const instructionsModal = document.getElementById('instructions-modal');
        if (!instructionsModal) {
          // Create the modal if it doesn't exist
          const modal = document.createElement('div');
          modal.id = 'instructions-modal';
          modal.innerHTML = `
            <h2>Instructions</h2>
            <p>Use arrow keys or WASD to move and turn.</p>
            <button id="close-instructions">Close</button>
          `;
          document.body.appendChild(modal);
        } else {
          // Show the modal if it already exists
          instructionsModal.style.display = 'block';
        }
      
        // Add an event listener to close the modal when the close button is clicked
        const closeButton = document.getElementById('close-instructions');
        closeButton.addEventListener('click', () => {
          instructionsModal.style.display = 'none';
        });
      break;
    case 'Settings':
      alert('Settings menu not implemented yet.');
      break;
  }
}

function setOnStartGameCallback(callback) {
  onStartGameCallback = callback;
}

window.addEventListener('keydown', (e) => {
  switch(e.key) {
    case 'ArrowUp':
    case 'w':
    case 'z':
      moveSelectionUp();
      break;
    case 'ArrowDown':
    case 's':
      moveSelectionDown();
      break;
    case 'Enter':
      selectOption();
      break;
  }
});

// Initial draw
drawMenu();

export { drawMenu, moveSelectionUp, moveSelectionDown, selectOption, setOnStartGameCallback };
