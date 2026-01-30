import * as THREE from 'three';
import { Network } from './network.js';
import { ItemSystem } from './items.js';
import { Track } from './track.js';

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });

        this.network = new Network();
        this.track = new Track(this.scene);
        this.items = new ItemSystem(this.scene, this.track); // Init after track

        this.players = {}; // Map of playerId -> Kart Mesh
        this.localPlayerId = null;

        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Basic Environment
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue

        // Ground
        const groundGeometry = new THREE.PlaneGeometry(500, 500);
        const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // Grid helper for reference
        const gridHelper = new THREE.GridHelper(500, 50);
        this.scene.add(gridHelper);

        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);

        // Listeners included here
        window.addEventListener('resize', () => this.onWindowResize(), false);
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());

        this.animate();
    }

    async startGame() {
        const name = document.getElementById('player-name').value || 'Player';
        const roomCode = document.getElementById('room-code').value || 'default';

        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('hud').style.display = 'block';

        // Random color
        const color = Math.random() * 0xffffff;

        // Initialize local player kart
        this.localKart = this.createKart('local', 0, color);
        this.input = new InputHandler();
        this.laps = 1;
        document.getElementById('lap-counter').innerText = `Lap: 1/3`;

        // Network Setup
        this.network.callbacks.onPlayerJoined = (data) => this.onRemotePlayerJoined(data);
        this.network.callbacks.onPlayerMoved = (data) => this.onRemotePlayerMoved(data);
        this.network.callbacks.onPlayerLeft = (id) => this.onRemotePlayerLeft(id);

        const myId = await this.network.joinRoom(roomCode, name, color);
        if (myId) this.localPlayerId = myId;
    }

    onRemotePlayerJoined(data) {
        if (!this.players[data.id]) {
            console.log("Player joined", data.id);
            this.createKart(data.id, data.x, data.color);
        }
    }

    onRemotePlayerMoved(data) {
        const kart = this.players[data.id];
        if (kart) {
            // Interpolate? For now, direct set
            kart.mesh.position.x = data.x;
            kart.mesh.position.z = data.z;
            kart.mesh.rotation.y = data.angle;
        } else {
            // If we missed the join event
            this.createKart(data.id, data.x, data.color);
        }
    }

    onRemotePlayerLeft(id) {
        if (this.players[id]) {
            this.scene.remove(this.players[id].mesh);
            delete this.players[id];
        }
    }

    createKart(id, x, color) {
        const kart = new Kart(id, x, color, this.scene);
        this.players[id] = kart;
        return kart;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.localKart) {
            const oldT = this.localKart.currentT || 0;
            this.localKart.update(this.input.keys, this.track);
            const newT = this.localKart.currentT;

            // Check Lap
            if (oldT > 0.9 && newT < 0.1) {
                this.laps++;
                document.getElementById('lap-counter').innerText = `Lap: ${this.laps}/3`;
            }

            this.items.checkCollisions(this.localKart);

            // Speedometer
            document.getElementById('speedometer').innerText = Math.floor(this.localKart.speed * 100) + " km/h";

            // Camera follow
            const relativeCameraOffset = new THREE.Vector3(0, 5, 10);
            const cameraOffset = relativeCameraOffset.applyMatrix4(this.localKart.mesh.matrixWorld);
            this.camera.position.lerp(cameraOffset, 0.1);
            this.camera.lookAt(this.localKart.mesh.position);

            // Network Update (throttle this in production, but okay for basic test)
            if (this.localPlayerId) {
                this.network.updateState({
                    x: this.localKart.mesh.position.x,
                    z: this.localKart.mesh.position.z,
                    angle: this.localKart.angle,
                    speed: this.localKart.speed
                });
            }
        }

        this.items.update();
        this.renderer.render(this.scene, this.camera);
    }
}

class Kart {
    constructor(id, x, color, scene) {
        this.id = id;
        this.scene = scene;
        this.speed = 0;
        this.maxSpeed = 1.5;
        this.acceleration = 0.02;
        this.friction = 0.96;
        this.turnSpeed = 0.05;
        this.angle = 0;

        // Mesh
        const geometry = new THREE.BoxGeometry(1, 0.5, 2);
        const material = new THREE.MeshStandardMaterial({ color: color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(x, 0.5, 0);
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

        const positions = [
            { x: 0.6, y: -0.1, z: 0.6 },
            { x: -0.6, y: -0.1, z: 0.6 },
            { x: 0.6, y: -0.1, z: -0.6 },
            { x: -0.6, y: -0.1, z: -0.6 }
        ];

        positions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.position.set(pos.x, pos.y, pos.z);
            this.mesh.add(wheel);
        });
    }

    update(keys, track) {
        // Acceleration
        if (keys['w'] || keys['ArrowUp']) {
            this.speed += this.acceleration;
        } else if (keys['s'] || keys['ArrowDown']) {
            this.speed -= this.acceleration;
        }

        // Friction
        this.speed *= this.friction;

        // Steering (only if moving)
        if (Math.abs(this.speed) > 0.01) {
            if (keys['a'] || keys['ArrowLeft']) {
                this.angle += this.turnSpeed * Math.sign(this.speed);
            }
            if (keys['d'] || keys['ArrowRight']) {
                this.angle -= this.turnSpeed * Math.sign(this.speed);
            }
        }

        // Potential new position
        const nextX = this.mesh.position.x + Math.sin(this.angle) * this.speed;
        const nextZ = this.mesh.position.z + Math.cos(this.angle) * this.speed;

        // Collision Detection
        const trackState = track.getTrackState({ x: nextX, z: nextZ }, this.currentT || 0);
        this.currentT = trackState.t; // Update progress

        const trackWidth = 12; // Tube radius was 10, give a bit of wiggle room or strictness

        if (trackState.distance < trackWidth) {
            // Valid Move
            this.mesh.rotation.y = this.angle;
            this.mesh.position.x = nextX;
            this.mesh.position.z = nextZ;
        } else {
            // Collision - Stop or Bounce
            this.speed *= -0.5; // Bounce back
            // Don't update position, just speed
        }
    }
}

class InputHandler {
    constructor() {
        this.keys = {};
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if (e.code === 'Space') {
                window.game.items.useItem(window.game.localKart);
            }
        });
        window.addEventListener('keyup', (e) => this.keys[e.key] = false);
    }
}

// Start the game instance
window.game = new Game();
