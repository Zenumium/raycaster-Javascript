const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;

canvas.width = width;
canvas.height = height;

// Map configuration: 1 = wall, 0 = empty space, 2 = door
const map = [
  [1,1,1,1,1,1,1,1,1,1],
  [1,"p",0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,1,1,1,1,1],
  [1,0,1,1,1,1,1,1,1,1],
  [1,0,0,2,0,0,0,0,0,1],  // Added a door (2) here
  [1,1,1,1,1,1,1,1,0,1],
  [1,0,0,0,2,0,0,0,0,1],
  [1,2,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1],
];

// Track door states (open or closed)
const doors = [];

// Initialize doors from map
function initDoors() {
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] === 2) {
        doors.push({
          x: x,
          y: y,
          isOpen: false,
          openAmount: 0 // 0 = fully closed, 1 = fully open
        });
      }
    }
  }
}

const mapWidth = map[0].length;
const mapHeight = map.length;
const tileSize = 64;

const fov = Math.PI / 3; // 60 degrees field of view
const numRays = width;
const maxDepth = 1000;

let player = {
  x: tileSize * 1.5,
  y: tileSize * 1.5,
  angle: 0,
  speed: 0,
  turnSpeed: 0,
};

let walkCycle = 0; // Counter for walking cycle to simulate camera bobbing
let showInteractionMessage = false;
let nearbyDoor = null;

function castRay(rayAngle) {
  rayAngle = normalizeAngle(rayAngle);

  let distance = 0;
  let hit = false;
  let hitX = 0;
  let hitY = 0;
  let wallType = 0;

  while (!hit && distance < maxDepth) {
    distance += 1;

    let testX = Math.floor((player.x + Math.cos(rayAngle) * distance) / tileSize);
    let testY = Math.floor((player.y + Math.sin(rayAngle) * distance) / tileSize);

    if (testX < 0 || testX >= mapWidth || testY < 0 || testY >= mapHeight) {
      hit = true;
      distance = maxDepth;
    } else if (map[testY][testX] === 1) {
      hit = true;
      hitX = testX;
      hitY = testY;
      wallType = 1;
    } else if (map[testY][testX] === 2) {
      // Check if door is hit
      const door = getDoorAt(testX, testY);
      if (door && !door.isOpen) {
        hit = true;
        hitX = testX;
        hitY = testY;
        wallType = 2;
      }
    }
  }

  return {distance, wallType};
}

function getDoorAt(x, y) {
  return doors.find(door => door.x === x && door.y === y);
}

function normalizeAngle(angle) {
  angle = angle % (2 * Math.PI);
  if (angle < 0) angle += 2 * Math.PI;
  return angle;
}

function render3DView() {
  ctx.clearRect(0, 0, width, height);

  // Calculate vertical offset for camera bobbing
  let verticalOffset = 0;
  if (player.speed !== 0) {
    verticalOffset = Math.sin(walkCycle) * 6; // 6 pixels vertical bobbing amplitude
  }
  
  // Draw ceiling (top half)
  ctx.fillStyle = '#0000'; // Sky black color
  ctx.fillRect(0, 0, width, height / 2 + verticalOffset);
  
  // Draw floor (bottom half)
  ctx.fillStyle = '#0000'; // Black color for floor
  ctx.fillRect(0, height / 2 + verticalOffset, width, height / 2 - verticalOffset);

  for (let i = 0; i < numRays; i++) {
    let rayAngle = player.angle - fov / 2 + (i / numRays) * fov;
    let ray = castRay(rayAngle);

    // Correct fisheye effect
    let correctedDistance = ray.distance * Math.cos(rayAngle - player.angle);

    // Calculate wall height
    let wallHeight = (tileSize * height) / correctedDistance;

    // Choose wall color based on type (normal wall or door)
    let shade;
    if (ray.wallType === 2) {
      // Door color (brownish)
      shade = 255 - Math.min(255, correctedDistance * 0.5);
      ctx.fillStyle = `rgb(${shade},${shade * 0.6},${shade * 0.3})`;
    } else {
      // Normal wall color
      shade = 255 - Math.min(255, correctedDistance * 0.5);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    }

    // Draw vertical slice with vertical offset for bobbing
    ctx.fillRect(i, (height / 2) - wallHeight / 2 + verticalOffset, 1, wallHeight);
  }

  // Display "Press E to open" message when near a door
  if (showInteractionMessage) {
    ctx.font = '24px Arial';
    ctx.fillStyle = 'red';
    ctx.textAlign = 'center';
    ctx.fillText('Press E to open the door', width / 2, height - 50);
  }
}

function gameLoop() {
  update();
  render3DView();
  requestAnimationFrame(gameLoop);
}

function update() {
  // Update player position based on speed and turnSpeed
  player.angle += player.turnSpeed;

  let moveStep = player.speed;
  let newX = player.x + Math.cos(player.angle) * moveStep;
  let newY = player.y + Math.sin(player.angle) * moveStep;

  // Collision detection
  if (!isWall(newX, newY)) {
    player.x = newX;
    player.y = newY;
  }

  // Update walking cycle for camera bobbing if moving
  if (player.speed !== 0) {
    walkCycle += 0.13; // Adjust speed of bobbing here
  } else {
    walkCycle = 0; // Reset when not moving
  }

  // Check if player is near a door to show interaction message
  checkDoorProximity();

  // Update door animation if any door is in process of opening/closing
  updateDoors();
}

function updateDoors() {
  for (let door of doors) {
    if (door.isOpen && door.openAmount < 1) {
      // Door is opening
      door.openAmount += 0.05;
      if (door.openAmount >= 1) {
        door.openAmount = 1;
      }
    } else if (!door.isOpen && door.openAmount > 0) {
      // Door is closing
      door.openAmount -= 0.05;
      if (door.openAmount <= 0) {
        door.openAmount = 0;
      }
    }
  }
}

function isWall(x, y) {
  let mapX = Math.floor(x / tileSize);
  let mapY = Math.floor(y / tileSize);

  if (mapX < 0 || mapX >= mapWidth || mapY < 0 || mapY >= mapHeight) {
    return true;
  }
  
  // Check if it's a wall
  if (map[mapY][mapX] === 1) {
    return true;
  }
  
  // Check if it's a closed door
  if (map[mapY][mapX] === 2) {
    const door = getDoorAt(mapX, mapY);
    return door && !door.isOpen;
  }
  
  return false;
}

function checkDoorProximity() {
  // Check if the player is near a door (within 2 tiles)
  const doorInteractionDistance = tileSize * 2;
  
  showInteractionMessage = false;
  nearbyDoor = null;
  
  for (let door of doors) {
    const doorX = door.x * tileSize + tileSize / 2;
    const doorY = door.y * tileSize + tileSize / 2;
    
    const distanceToDoor = Math.sqrt(
      Math.pow(player.x - doorX, 2) + 
      Math.pow(player.y - doorY, 2)
    );
    
    if (distanceToDoor < doorInteractionDistance) {
      showInteractionMessage = true;
      nearbyDoor = door;
      break;
    }
  }
}

function interactWithDoor() {
  if (nearbyDoor) {
    nearbyDoor.isOpen = !nearbyDoor.isOpen;
  }
}

let gameStarted = false;

function handleKeyDown(e) {
  if (!gameStarted) return;
  // Arrow keys and WASD for movement
  if (e.key === 'ArrowUp' || e.key === 'z') {
    player.speed = 2;
  } else if (e.key === 'ArrowDown' || e.key === 's') {
    player.speed = -2;
  } else if (e.key === 'ArrowLeft' || e.key === 'q') {
    player.turnSpeed = -0.05;
  } else if (e.key === 'ArrowRight' || e.key === 'd') {
    player.turnSpeed = 0.05;
  } else if (e.key ==='z') {
    player.speed = 2;
  } else if (e.key === 's') {
    player.speed = -2;
  } else if (e.key === 'q') {
    player.turnSpeed = -0.05;
  } else if (e.key === 'd') {
    player.turnSpeed = 0.05;
  } else if (e.key === 'e' || e.key === 'E') {
    // Interact with door when E is pressed
    interactWithDoor();
  }
}

function handleKeyUp(e) {
  if (!gameStarted) return;

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'z' || e.key === 's') {
    player.speed = 0;
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'q' || e.key === 'd') {
    player.turnSpeed = 0;
  } else if (e.key ==='z') {
    player.speed = 0;
  } else if (e.key === 's') {
    player.speed = -0;
  } else if (e.key === 'q') {
    player.turnSpeed = -0.00;
  } else if (e.key === 'd') {
    player.turnSpeed = 0.00;
  }
}

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

function startGame() {
  gameStarted = true;
  initDoors(); // Initialize doors before starting the game
  gameLoop();
}

startGame();