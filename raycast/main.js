import { drawMenu, setOnStartGameCallback } from './mainmenu.js';

// Basic raycasting game engine inspired by DOOM

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;

canvas.width = width;
canvas.height = height;

// Map configuration: 1 = wall, 0 = empty space
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
  [1,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1],
];

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
    }
  }

  return {distance, wallType};
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
    verticalOffset = Math.sin(walkCycle) * 5; // 5 pixels vertical bobbing amplitude
  }

  for (let i = 0; i < numRays; i++) {
    let rayAngle = player.angle - fov / 2 + (i / numRays) * fov;
    let ray = castRay(rayAngle);

    // Correct fisheye effect
    let correctedDistance = ray.distance * Math.cos(rayAngle - player.angle);

    // Calculate wall height
    let wallHeight = (tileSize * height) / correctedDistance;

    // Shade walls based on distance
    let shade = 255 - Math.min(255, correctedDistance * 0.5);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;

    // Draw vertical slice with vertical offset for bobbing
    ctx.fillRect(i, (height / 2) - wallHeight / 2 + verticalOffset, 1, wallHeight);
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
}

function isWall(x, y) {
  let mapX = Math.floor(x / tileSize);
  let mapY = Math.floor(y / tileSize);

  if (mapX < 0 || mapX >= mapWidth || mapY < 0 || mapY >= mapHeight) {
    return true;
  }
  return map[mapY][mapX] === 1;
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
  gameLoop();
}

setOnStartGameCallback(startGame);

// Initially draw the menu
drawMenu();
