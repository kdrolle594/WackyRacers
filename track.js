import * as THREE from 'three';

export class Track {
    constructor(scene) {
        this.scene = scene;
        this.curve = null;
        this.tubeGeometry = null;
        this.mesh = null;
        this.colliders = []; // Array of objects to collide with (walls)

        this.init();
    }

    init() {
        // Define track points
        const points = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(50, 0, 0),
            new THREE.Vector3(100, 0, 50),
            new THREE.Vector3(100, 0, 100),
            new THREE.Vector3(50, 0, 150),
            new THREE.Vector3(0, 0, 150),
            new THREE.Vector3(-50, 0, 100),
            new THREE.Vector3(-50, 0, 50),
        ];

        // Create a closed curve
        this.curve = new THREE.CatmullRomCurve3(points, true);

        // Create geometry (Road)
        const pointsCount = 100;
        this.tubeGeometry = new THREE.TubeGeometry(this.curve, pointsCount, 10, 8, true);

        // Material
        const textureLoader = new THREE.TextureLoader();
        // Use a simple grid pattern or color for now
        const material = new THREE.MeshStandardMaterial({
            color: 0x444444,
            side: THREE.DoubleSide,
            wireframe: false
        });

        this.mesh = new THREE.Mesh(this.tubeGeometry, material);
        this.mesh.position.y = 0.1; // Slightly above ground to avoid z-fighting
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);

        // Visualizing the path line (optional)
        const lineGeo = new THREE.BufferGeometry().setFromPoints(this.curve.getPoints(100));
        const lineMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const line = new THREE.Line(lineGeo, lineMat);
        line.position.y = 0.2;
        this.scene.add(line);

        // Generate Walls (Simple approach: cylinder at specific intervals or extrude a shape)
        // For simple collision, we can check distance from the curve center.
    }

    getTrackState(position, lastT = 0) {
        // Search local area around lastT to find closest point
        // This relies on the track being a loop and kart moving forward
        const samples = 100; // Number of samples to check around lastT
        const range = 0.1; // Check +/- 10% of track length

        let bestT = lastT;
        let minDst = Infinity;

        // Check a range around the last known position
        for (let i = -samples / 2; i < samples / 2; i++) {
            let t = lastT + (i / samples) * range;
            if (t < 0) t += 1;
            if (t > 1) t -= 1;

            const point = this.curve.getPointAt(t);
            const dst = new THREE.Vector3(position.x, 0, position.z).distanceTo(new THREE.Vector3(point.x, 0, point.z));

            if (dst < minDst) {
                minDst = dst;
                bestT = t;
            }
        }

        // Also check if we just started (lastT = 0 might need global search if we are lost)
        // But for this game, local search is usually fine.

        return {
            t: bestT,
            distance: minDst,
            center: this.curve.getPointAt(bestT)
        };
    }

    // Check if a position is on the track
    isOnTrack(position) {
        // Find closest point on curve
        // This is expensive to do exactly, so we make an approximation or use a predefined look-up.
        // For this simple demo, we assume the kart is somewhat near the track.

        // 0. Approximate t
        const p = position.clone();
        p.y = 0; // Ignore height

        // We can iterate over logical segments to find nearest point
        // Or simpler: just keep kart valid radius from "center" if map was circular. 
        // But since it's a curve, we need a better check.

        // Simplest "Wacky" collision:
        // Use the closest point on the curve.

        // Optimization: rely on the fact the kart moves continuously. Cache last 't'.
        return true; // Placeholder for now
    }

    // Get spawn point
    getSpawnPoint(offset) {
        return this.curve.getPointAt(0).add(new THREE.Vector3(offset, 1, 0));
    }
}
