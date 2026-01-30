import * as THREE from 'three';

export class ItemSystem {
    constructor(scene, track) {
        this.scene = scene;
        this.track = track;
        this.itemBoxes = [];
        this.activeItems = []; // Shells, bananas on track
        this.currentItem = null;

        // Item Enums
        this.ITEMS = ['MUSHROOM', 'GREEN_SHELL', 'BANANA'];

        this.initItemBoxes();
    }

    initItemBoxes() {
        // Place boxes at specific T values on the track
        const locations = [0.2, 0.5, 0.8];
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });

        locations.forEach(t => {
            const point = this.track.curve.getPointAt(t);
            const box = new THREE.Mesh(geometry, material);
            box.position.copy(point);
            box.position.y = 1; // Float above track

            // Add a simple animation property
            box.userData = { t: t, active: true, rotationSpeed: 0.05 };

            this.scene.add(box);
            this.itemBoxes.push(box);
        });
    }

    update(delta) {
        // Animate boxes
        this.itemBoxes.forEach(box => {
            if (box.visible) {
                box.rotation.x += 0.02;
                box.rotation.y += 0.02;
            }
        });

        // Update active items (shells moving)
        this.activeItems.forEach((item, index) => {
            if (item.type === 'GREEN_SHELL') {
                item.mesh.position.add(item.velocity);
                // Simple cleanup if far away (improvements needed for track following)
                if (item.mesh.position.length() > 500) {
                    this.scene.remove(item.mesh);
                    this.activeItems.splice(index, 1);
                }
            }
        });
    }

    checkCollisions(kart) {
        const kartPos = kart.mesh.position;
        const kartRadius = 1.0;

        // 1. Check Item Boxes
        this.itemBoxes.forEach(box => {
            if (box.visible && box.position.distanceTo(kartPos) < 2.0) {
                box.visible = false;
                setTimeout(() => box.visible = true, 5000); // Respawn after 5s
                this.giveRandomItem();
            }
        });

        // 2. Check collisions with hazards (Bananas, Shells)
        this.activeItems.forEach((item, index) => {
            if (item.mesh.position.distanceTo(kartPos) < 2.0 && item.ownerId !== kart.id) {
                console.log("Hit item!", item.type);
                this.scene.remove(item.mesh);
                this.activeItems.splice(index, 1);

                // Effect on kart
                if (item.type === 'MUSHROOM') {
                    // Start speed boost (handled in useItem generally, but if we ran into one dropped?)
                    // Usually you don't run into mushrooms.
                } else {
                    // Spin out
                    kart.speed = 0;
                }
            }
        });
    }

    giveRandomItem() {
        if (this.currentItem) return; // Already have one

        const rand = Math.floor(Math.random() * this.ITEMS.length);
        this.currentItem = this.ITEMS[rand];
        this.updateUI();
    }

    useItem(kart) {
        if (!this.currentItem) return;

        console.log("Used item:", this.currentItem);

        switch (this.currentItem) {
            case 'MUSHROOM':
                kart.speed += 0.5; // Boost
                break;
            case 'GREEN_SHELL':
                this.spawnShell(kart);
                break;
            case 'BANANA':
                this.spawnBanana(kart);
                break;
        }

        this.currentItem = null;
        this.updateUI();
    }

    spawnShell(kart) {
        const geometry = new THREE.SphereGeometry(0.5, 8, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const shell = new THREE.Mesh(geometry, material);

        shell.position.copy(kart.mesh.position);
        shell.position.y = 0.5;

        // Move forward
        const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), kart.angle);
        const velocity = dir.multiplyScalar(0.5); // Fast

        this.scene.add(shell);
        this.activeItems.push({ type: 'GREEN_SHELL', mesh: shell, velocity: velocity, ownerId: kart.id });
    }

    spawnBanana(kart) {
        const geometry = new THREE.ConeGeometry(0.3, 1, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0xffff00 });
        const banana = new THREE.Mesh(geometry, material);

        // Place behind
        const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), kart.angle);
        banana.position.copy(kart.mesh.position).add(dir.multiplyScalar(2));
        banana.position.y = 0.5;

        this.scene.add(banana);
        this.activeItems.push({ type: 'BANANA', mesh: banana, ownerId: kart.id });
    }

    updateUI() {
        const el = document.getElementById('item-icon');
        if (el) {
            el.innerText = this.currentItem ? this.currentItem[0] : '?'; // Simple letter for now
        }
    }
}
