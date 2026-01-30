import { firebaseConfig } from './firebase-config.js';

export class Network {
    constructor() {
        this.app = null;
        this.db = null;
        this.roomRef = null;
        this.playerRef = null;
        this.playerId = null;

        this.callbacks = {
            onPlayerJoined: () => { },
            onPlayerMoved: () => { },
            onPlayerLeft: () => { }
        };

        this.init();
    }

    init() {
        // Initialize Firebase
        if (window.firebaseModules && firebaseConfig.apiKey !== "YOUR_API_KEY") {
            try {
                this.app = window.firebaseModules.initializeApp(firebaseConfig);
                this.db = window.firebaseModules.getDatabase(this.app);
                console.log("Firebase initialized");
            } catch (e) {
                console.error("Firebase initialization failed:", e);
            }
        }
    }

    generateId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }

    async joinRoom(roomId, playerName, color) {
        if (!this.db) return null;

        this.playerId = this.generateId();
        this.roomRef = window.firebaseModules.ref(this.db, 'rooms/' + roomId);
        this.playerRef = window.firebaseModules.ref(this.db, 'rooms/' + roomId + '/players/' + this.playerId);

        // precise initial state
        const initialData = {
            id: this.playerId,
            name: playerName,
            color: color,
            x: 0,
            z: 0,
            angle: 0,
            speed: 0,
            lastUpdate: Date.now()
        };

        await window.firebaseModules.set(this.playerRef, initialData);

        // Remove on disconnect
        window.firebaseModules.onDisconnect(this.playerRef).remove();

        // Listen for other players
        const playersRef = window.firebaseModules.ref(this.db, 'rooms/' + roomId + '/players');

        window.firebaseModules.onValue(playersRef, (snapshot) => {
            const players = snapshot.val() || {};
            Object.values(players).forEach(p => {
                if (p.id !== this.playerId) {
                    this.callbacks.onPlayerMoved(p);
                }
            });

            // Handle disconnects by comparing keys could be complex here, 
            // but for simple movement receiving the whole state is okay for small player counts.
            // Better: use onChildAdded, onChildChanged.
        });

        window.firebaseModules.onChildAdded(playersRef, (data) => {
            if (data.key !== this.playerId) {
                this.callbacks.onPlayerJoined(data.val());
            }
        });

        window.firebaseModules.onChildRemoved(playersRef, (data) => {
            if (data.key !== this.playerId) {
                this.callbacks.onPlayerLeft(data.key);
            }
        });

        // Loop update for changed
        window.firebaseModules.onChildChanged(playersRef, (data) => {
            if (data.key !== this.playerId) {
                this.callbacks.onPlayerMoved(data.val());
            }
        });

        return this.playerId;
    }

    updateState(state) {
        if (!this.playerRef) return;
        window.firebaseModules.update(this.playerRef, state);
    }
}
