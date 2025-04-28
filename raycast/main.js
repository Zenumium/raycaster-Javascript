   // Get WebGL context
   const canvas = document.getElementById('gameCanvas');
   const gl = canvas.getContext('webgl');
   const messageEl = document.getElementById('interaction-message');

   if (!gl) {
     alert('WebGL not supported. Please use a WebGL-compatible browser.');
     throw new Error('WebGL not supported');
   }

   // Set canvas dimensions
   function resizeCanvas() {
     canvas.width = window.innerWidth;
     canvas.height = window.innerHeight;
     gl.viewport(0, 0, canvas.width, canvas.height);
   }
   
   resizeCanvas();
   window.addEventListener('resize', resizeCanvas);

   // Map configuration: 1 = wall, 0 = empty space, 2 = door
   const map = [
     [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],  // Added a door (2) here
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
     [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
   ];

   // Track door states (open or closed)
   const doors = [];

   // Game constants
   const mapWidth = map[0].length;
   const mapHeight = map.length;
   const tileSize = 64;
   const fov = Math.PI / 2;
   const maxDepth = 2000;

   // Player state
   let player = {
     x: tileSize * 1.5,
     y: tileSize * 1.5,
     angle: 0,
     pitch: 0, // vertical look angle
     speed: 0,
     turnSpeed: 0,
     strafeSpeed: 0,
   };

   let walkCycle = 0;
   let showInteractionMessage = false;
   let nearbyDoor = null;
   let gameStarted = false;

   // Shader sources
   const vertexShaderSource = `
     attribute vec4 aVertexPosition;
     attribute vec2 aTextureCoord;

     uniform mat4 uModelViewMatrix;
     uniform mat4 uProjectionMatrix;
     uniform float uVerticalOffset;

     varying highp vec2 vTextureCoord;

     void main() {
       vec4 position = aVertexPosition;
       position.y += uVerticalOffset;
       gl_Position = uProjectionMatrix * uModelViewMatrix * position;
       vTextureCoord = aTextureCoord;
     }
   `;

   const fragmentShaderSource = `
     precision mediump float;
     
     uniform sampler2D uSampler;
     uniform float uFogDistance;
     uniform vec3 uWallColor;
     uniform bool uIsTextured;
     
     varying highp vec2 vTextureCoord;
     
     void main() {
       vec4 color;
       
       if (uIsTextured) {
         color = texture2D(uSampler, vTextureCoord);
       } else {
         color = vec4(uWallColor, 1.0);
       }
       
       // Apply distance fog effect
       float fogFactor = 1.0 - min(1.0, uFogDistance / 10.0);
       color.rgb = mix(color.rgb, vec3(0.0, 0.0, 0.0), fogFactor);
       
       gl_FragColor = color;
     }
   `;

   // Compile shader
   function compileShader(gl, source, type) {
     const shader = gl.createShader(type);
     gl.shaderSource(shader, source);
     gl.compileShader(shader);

     if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
       console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
       gl.deleteShader(shader);
       return null;
     }

     return shader;
   }

   // Initialize shader program
   function initShaderProgram(gl, vsSource, fsSource) {
     const vertexShader = compileShader(gl, vsSource, gl.VERTEX_SHADER);
     const fragmentShader = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);

     const shaderProgram = gl.createProgram();
     gl.attachShader(shaderProgram, vertexShader);
     gl.attachShader(shaderProgram, fragmentShader);
     gl.linkProgram(shaderProgram);

     if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
       console.error('Shader program linking error:', gl.getProgramInfoLog(shaderProgram));
       return null;
     }

     return shaderProgram;
   }

   // Initialize WebGL resources
   function initWebGL() {
     // Create shader program
     const shaderProgram = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);

     // Get shader attribute and uniform locations
     const programInfo = {
       program: shaderProgram,
       attribLocations: {
         vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
         textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
       },
       uniformLocations: {
         projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
         modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
         verticalOffset: gl.getUniformLocation(shaderProgram, 'uVerticalOffset'),
         sampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
         fogDistance: gl.getUniformLocation(shaderProgram, 'uFogDistance'),
         wallColor: gl.getUniformLocation(shaderProgram, 'uWallColor'),
         isTextured: gl.getUniformLocation(shaderProgram, 'uIsTextured'),
       },
     };

     // Create buffers for wall segments
     const buffers = initBuffers(gl);

     // Create textures for walls and doors
     const textures = {
       wall: createColorTexture(gl, [0.7, 0.7, 0.7]),  // Gray walls
       door: createColorTexture(gl, [0.6, 0.4, 0.2]),  // Brown doors
     };

     return { programInfo, buffers, textures };
   }

   // Create a simple color texture
   function createColorTexture(gl, color) {
     const texture = gl.createTexture();
     gl.bindTexture(gl.TEXTURE_2D, texture);
     
     // Create a 1x1 pixel texture with the specified color
     const pixel = new Uint8Array([
       Math.floor(color[0] * 255),
       Math.floor(color[1] * 255),
       Math.floor(color[2] * 255),
       255
     ]);
     gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
     
     // Set texture parameters
     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
     
     return texture;
   }

   // Initialize buffers for wall rendering
   function initBuffers(gl) {
     // Create buffers for a simple quad (two triangles)
     const positions = [
       -1.0, -1.0,  0.0,
        1.0, -1.0,  0.0,
        1.0,  1.0,  0.0,
       -1.0,  1.0,  0.0,
     ];
     
     const positionBuffer = gl.createBuffer();
     gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
     gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

     // Texture coordinates
     const textureCoordinates = [
       0.0, 1.0,
       1.0, 1.0,
       1.0, 0.0,
       0.0, 0.0,
     ];
     
     const textureCoordBuffer = gl.createBuffer();
     gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
     gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

     // Element indices
     const indices = [0, 1, 2, 0, 2, 3];
     
     const indexBuffer = gl.createBuffer();
     gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
     gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

     return {
       position: positionBuffer,
       textureCoord: textureCoordBuffer,
       indices: indexBuffer,
     };
   }

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

   function getDoorAt(x, y) {
     return doors.find(door => door.x === x && door.y === y);
   }

   function normalizeAngle(angle) {
     angle = angle % (2 * Math.PI);
     if (angle < 0) angle += 2 * Math.PI;
     return angle;
   }

   function castRay(rayAngle) {
     rayAngle = normalizeAngle(rayAngle);

     let distance = 0;
     let hit = false;
     let hitX = 0;
     let hitY = 0;
     let wallType = 0;
     let texX = 0; // Texture X coordinate

     const rayDirX = Math.cos(rayAngle);
     const rayDirY = Math.sin(rayAngle);

     // Use DDA (Digital Differential Analysis) algorithm for ray casting
     // This is more efficient than the original incremental approach
     
     // Calculate ray position and direction
     let mapX = Math.floor(player.x / tileSize);
     let mapY = Math.floor(player.y / tileSize);
     
     // Length of ray from current position to next x or y-side
     let sideDistX;
     let sideDistY;
     
     // Length of ray from one x or y-side to next x or y-side
     const deltaDistX = Math.abs(1 / rayDirX);
     const deltaDistY = Math.abs(1 / rayDirY);
     
     // Direction to step in x or y direction (either +1 or -1)
     let stepX;
     let stepY;
     
     // Calculate step and initial sideDist
     if (rayDirX < 0) {
       stepX = -1;
       sideDistX = (player.x / tileSize - mapX) * deltaDistX;
     } else {
       stepX = 1;
       sideDistX = (mapX + 1.0 - player.x / tileSize) * deltaDistX;
     }
     
     if (rayDirY < 0) {
       stepY = -1;
       sideDistY = (player.y / tileSize - mapY) * deltaDistY;
     } else {
       stepY = 1;
       sideDistY = (mapY + 1.0 - player.y / tileSize) * deltaDistY;
     }
     
     // Perform DDA
     let side; // Was a NS or a EW wall hit?
     
     while (!hit && distance < maxDepth) {
       // Jump to next map square, either in x-direction, or in y-direction
       if (sideDistX < sideDistY) {
         sideDistX += deltaDistX;
         mapX += stepX;
         side = 0;
       } else {
         sideDistY += deltaDistY;
         mapY += stepY;
         side = 1;
       }
       
       // Check if ray has hit a wall
       if (mapX < 0 || mapX >= mapWidth || mapY < 0 || mapY >= mapHeight) {
         hit = true;
         distance = maxDepth;
       } else if (map[mapY][mapX] === 1) {
         hit = true;
         wallType = 1;
         
         // Calculate exact hit position for texture mapping
         if (side === 0) {
           distance = (mapX - player.x / tileSize + (1 - stepX) / 2) / rayDirX;
           texX = (player.y / tileSize + distance * rayDirY) % 1.0;
         } else {
           distance = (mapY - player.y / tileSize + (1 - stepY) / 2) / rayDirY;
           texX = (player.x / tileSize + distance * rayDirX) % 1.0;
         }
         
         // Scale to tile size
         distance *= tileSize;
       } else if (map[mapY][mapX] === 2) {
         // Check if door is hit
         const door = getDoorAt(mapX, mapY);
         if (door && !door.isOpen) {
           hit = true;
           wallType = 2;
           
           // Calculate exact hit position for texture mapping
           if (side === 0) {
             distance = (mapX - player.x / tileSize + (1 - stepX) / 2) / rayDirX;
             texX = (player.y / tileSize + distance * rayDirY) % 1.0;
           } else {
             distance = (mapY - player.y / tileSize + (1 - stepY) / 2) / rayDirY;
             texX = (player.x / tileSize + distance * rayDirX) % 1.0;
           }
           
           // Scale to tile size
           distance *= tileSize;
         }
       }
     }

     return { distance, wallType, texX, side };
   }

   // Render the scene using WebGL
   function render(programInfo, buffers, textures) {
     gl.clearColor(0.0, 0.0, 0.0, 1.0);
     gl.clearDepth(1.0);
     gl.enable(gl.DEPTH_TEST);
     gl.depthFunc(gl.LEQUAL);
     gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

     // Calculate vertical offset for camera bobbing and vertical look
     let verticalOffset = 0;
     if (player.speed !== 0) {
       verticalOffset = Math.sin(walkCycle) * 0.05; // Convert to normalized device coordinates
     }
     // Add vertical look offset based on player.pitch
     verticalOffset += player.pitch * 0.5; // Adjust multiplier for desired vertical look effect

     // Create perspective projection matrix
     const aspect = canvas.clientWidth / canvas.clientHeight;
     const projectionMatrix = mat4.create();
     mat4.perspective(projectionMatrix, fov, aspect, 0.1, 100.0);

     // Set shader program
     gl.useProgram(programInfo.program);
     gl.uniform1f(programInfo.uniformLocations.verticalOffset, verticalOffset);

     // Set up buffer attributes
     gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
     gl.vertexAttribPointer(
       programInfo.attribLocations.vertexPosition,
       3,        // Number of components per vertex
       gl.FLOAT, // Data type
       false,    // Normalized
       0,        // Stride
       0         // Offset
     );
     gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

     gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
     gl.vertexAttribPointer(
       programInfo.attribLocations.textureCoord,
       2,        // Number of components
       gl.FLOAT, // Data type
       false,    // Normalized
       0,        // Stride
       0         // Offset
     );
     gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

     gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

     // Active texture unit 0
     gl.activeTexture(gl.TEXTURE0);
     gl.uniform1i(programInfo.uniformLocations.sampler, 0);

     // Disable texturing initially
     gl.uniform1i(programInfo.uniformLocations.isTextured, false);

     // Draw ceiling
     const ceilingModelViewMatrix = mat4.create();
     mat4.translate(ceilingModelViewMatrix, ceilingModelViewMatrix, [0.0, 0.5, -1.0]);
     mat4.scale(ceilingModelViewMatrix, ceilingModelViewMatrix, [1.0, 0.5, 1.0]);
     
     gl.uniformMatrix4fv(
       programInfo.uniformLocations.modelViewMatrix,
       false,
       ceilingModelViewMatrix
     );
     gl.uniformMatrix4fv(
       programInfo.uniformLocations.projectionMatrix,
       false,
       projectionMatrix
     );
     
     gl.uniform3fv(programInfo.uniformLocations.wallColor, [0.1, 0.1, 0.1]); // Dark ceiling
     gl.uniform1f(programInfo.uniformLocations.fogDistance, 0.0);
     
     gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

     // Draw floor
     const floorModelViewMatrix = mat4.create();
     mat4.translate(floorModelViewMatrix, floorModelViewMatrix, [0.0, -0.5, -1.0]);
     mat4.scale(floorModelViewMatrix, floorModelViewMatrix, [1.0, 0.5, 1.0]);
     
     gl.uniformMatrix4fv(
       programInfo.uniformLocations.modelViewMatrix,
       false,
       floorModelViewMatrix
     );
     
     gl.uniform3fv(programInfo.uniformLocations.wallColor, [0.2, 0.2, 0.2]); // Darker floor
     gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

     // Set up variables for raycasting
     const numRays = canvas.width;
     const rayStep = fov / numRays;

     // Cast rays and draw walls
     for (let i = 0; i < numRays; i++) {
       const rayAngle = player.angle - fov / 2 + i * rayStep;
       const ray = castRay(rayAngle);

       // Correct fisheye effect
       const correctedDistance = ray.distance * Math.cos(rayAngle - player.angle);

       // Skip rendering for very distant walls
       if (correctedDistance >= maxDepth) continue;

       // Calculate wall height and position
       const wallHeight = (tileSize * canvas.height) / correctedDistance;
       const normalizedHeight = wallHeight / canvas.height;
       
       // Calculate the wall's position on screen
       const wallX = (i / numRays) * 2 - 1; // Convert to normalized device coordinates (-1 to 1)
       const wallWidth = 2 / numRays; // Width in normalized device coordinates
       
       // Set up model view matrix for this wall slice
       const modelViewMatrix = mat4.create();
       mat4.translate(modelViewMatrix, modelViewMatrix, [wallX, 0.0, -0.5]);
       mat4.scale(modelViewMatrix, modelViewMatrix, [wallWidth, normalizedHeight, 1.0]);
       
       gl.uniformMatrix4fv(
         programInfo.uniformLocations.modelViewMatrix,
         false,
         modelViewMatrix
       );
       
       // Choose texture based on wall type
       if (ray.wallType === 2) {
         // Door texture
         gl.bindTexture(gl.TEXTURE_2D, textures.door);
         gl.uniform3fv(programInfo.uniformLocations.wallColor, [0.6, 0.4, 0.2]); // Brown color
       } else {
         // Wall texture
         gl.bindTexture(gl.TEXTURE_2D, textures.wall);
         
         // Darken walls based on orientation for a subtle 3D effect
         if (ray.side === 0) {
           gl.uniform3fv(programInfo.uniformLocations.wallColor, [0.7, 0.7, 0.7]); // Light gray
         } else {
           gl.uniform3fv(programInfo.uniformLocations.wallColor, [0.5, 0.5, 0.5]); // Darker gray
         }
       }
       
       // Apply fog based on distance
       gl.uniform1f(
         programInfo.uniformLocations.fogDistance, 
         correctedDistance / tileSize
       );
       
       // Draw the wall slice
       gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
     }
     
     // Update interaction message
     if (showInteractionMessage) {
       messageEl.textContent = 'Press E to open the door';
     } else {
       messageEl.textContent = '';
     }
   }

   function update() {
     // Update player position based on speed, turnSpeed, and strafeSpeed
     player.angle += player.turnSpeed;

     let moveStep = player.speed;
     let strafeStep = player.strafeSpeed;

     // Calculate new position with forward/backward movement
     let newX = player.x + Math.cos(player.angle) * moveStep;
     let newY = player.y + Math.sin(player.angle) * moveStep;

     // Calculate strafe movement perpendicular to player angle
     newX += Math.cos(player.angle + Math.PI / 2) * strafeStep;
     newY += Math.sin(player.angle + Math.PI / 2) * strafeStep;

     // Collision detection
     if (!isWall(newX, newY)) {
       player.x = newX;
       player.y = newY;
     }

     // Update walking cycle for camera bobbing if moving
     if (player.speed !== 0) {
       walkCycle += 0.1; // Adjust speed of bobbing here
     } else {
       walkCycle = 0; // Reset when not moving
     }

     // Check if player is near a door to show interaction message
     checkDoorProximity();

     // Update door animation if any door is in process of opening/closing
     updateDoors();
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

   function handleKeyDown(e) {
     if (!gameStarted) return;
     // Arrow keys and WASD for movement
     if (e.key === 'ArrowUp' || e.key === 'z'|| e.key === 'Z' || e.key === 'w'|| e.key === 'W') {
       player.speed = 2;
     } else if (e.key === 'ArrowDown' || e.key === 's'|| e.key === 'S') {
       player.speed = -2;
     } else if (e.key === 'q'|| e.key === 'Q'|| e.key === 'a'|| e.key === 'A') {
       player.strafeSpeed = -2;
     } else if (e.key === 'd'|| e.key === 'D') {
       player.strafeSpeed = 2;
     } else if (e.key === 'ArrowLeft') {
       player.turnSpeed = -0.05;
     } else if (e.key === 'ArrowRight') {
       player.turnSpeed = 0.05;
     } else if (e.key === 'e' || e.key === 'E') {
       // Interact with door when E is pressed
       interactWithDoor();
     }
   }

   function handleKeyUp(e) {
     if (!gameStarted) return;

     if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'z' || e.key === 'Z'|| e.key === 's' || e.key === 'S' || e.key === 'w' || e.key === 'W') {
       player.speed = 0;
     } else if (e.key === 'q' || e.key === 'd'|| e.key === 'D' || e.key === 'q' || e.key === 'Q' || e.key === 'a' || e.key === 'A') {
       player.strafeSpeed = 0;
     } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
       player.turnSpeed = 0;
     }
   }

   window.addEventListener('keydown', handleKeyDown);
   window.addEventListener('keyup', handleKeyUp);

   // Request pointer lock on canvas click to capture mouse movement
   canvas.addEventListener('click', () => {
     canvas.requestPointerLock();
   });

   // Mouse move event to update player angle for looking around
   window.addEventListener('mousemove', (e) => {
     if (document.pointerLockElement === canvas) {
       // Adjust sensitivity as needed
       const sensitivity = 0.002;
       player.angle += e.movementX * sensitivity;

       // Normalize angle between 0 and 2*PI
       if (player.angle < 0) {
         player.angle += 2 * Math.PI;
       } else if (player.angle >= 2 * Math.PI) {
         player.angle -= 2 * Math.PI;
       }

       // Remove vertical look (pitch) update to prevent player following mouse up/down
       // player.pitch -= e.movementY * sensitivity;
       // const maxPitch = Math.PI / 2;
       // if (player.pitch > maxPitch) player.pitch = maxPitch;
       // if (player.pitch < -maxPitch) player.pitch = -maxPitch;
     }
   });

   // Simple matrix library implementation (minimized version of gl-matrix)
   const mat4 = {
     create: function() {
       return new Float32Array([
         1, 0, 0, 0,
         0, 1, 0, 0,
         0, 0, 1, 0,
         0, 0, 0, 1
       ]);
     },
     
     perspective: function(out, fovy, aspect, near, far) {
       const f = 1.0 / Math.tan(fovy / 2);
       out[0] = f / aspect;
       out[1] = 0;
       out[2] = 0;
       out[3] = 0;
       out[4] = 0;
       out[5] = f;
       out[6] = 0;
       out[7] = 0;
       out[8] = 0;
       out[9] = 0;
       out[10] = (far + near) / (near - far);
       out[11] = -1;
       out[12] = 0;
       out[13] = 0;
       out[14] = (2 * far * near) / (near - far);
       out[15] = 0;
       return out;
     },
     
     translate: function(out, a, v) {
       const x = v[0], y = v[1], z = v[2];
       
       out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
       out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
       out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
       out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
       
       return out;
     },
     
     scale: function(out, a, v) {
       const x = v[0], y = v[1], z = v[2];
       
       out[0] = a[0] * x;
       out[1] = a[1] * x;
       out[2] = a[2] * x;
       out[3] = a[3] * x;
       out[4] = a[4] * y;
       out[5] = a[5] * y;
       out[6] = a[6] * y;
       out[7] = a[7] * y;
       out[8] = a[8] * z;
       out[9] = a[9] * z;
       out[10] = a[10] * z;
       out[11] = a[11] * z;
       
       return out;
     }
   };

   // Main game loop
   function gameLoop() {
     update();
     render(webGLResources.programInfo, webGLResources.buffers, webGLResources.textures);
     requestAnimationFrame(gameLoop);
   }

   // Initialize the game
   function startGame() {
     gameStarted = true;
     initDoors(); // Initialize doors before starting the game
     gameLoop();
   }

   // Initialize WebGL resources and start the game
   const webGLResources = initWebGL();
   startGame();