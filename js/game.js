const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Constants ---
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 7;
const ENEMY_BULLET_SPEED = 4;
const ENEMY_BASE_SPEED = 1; 
const PLAYER_COLOR = '#33ff00';
const BULLET_COLOR = '#fff';

// Weapons
const WEAPON_DEFAULT = 0;
const WEAPON_RAPID = 1;
const WEAPON_SPREAD = 2;
const WEAPON_SUPER_RAPID = 3;
const WEAPON_SUPER_SPREAD = 4;
const WEAPON_BOUNCE = 5;
const WEAPON_DOPPELGANGER = 6;
const WEAPON_SHIELD = 7;
const WEAPON_ROCKET = 8;
const WEAPON_TRIPLE = 9;
const WEAPON_HEALTH = 10;
const WEAPON_LASER = 11;

// Ammo Caps
const AMMO_CAP_BOUNCE = 50;
const AMMO_CAP_SPREAD = 100;
const AMMO_CAP_RAPID = 200;
const AMMO_CAP_ROCKET = 10;
const AMMO_CAP_LASER = 10000; // Max stored time in ms

// Set canvas size
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// --- Utilities ---
function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

function checkRectCollision(r1, r2) {
    return (
        r1.x < r2.x + r2.width &&
        r1.x + r1.width > r2.x &&
        r1.y < r2.y + r2.height &&
        r1.y + r1.height > r2.y
    );
}

// --- Classes ---

class Star {
    constructor() {
        this.x = Math.random() * GAME_WIDTH;
        this.y = Math.random() * GAME_HEIGHT;
        this.size = Math.random() * 2;
        this.speed = Math.random() * 0.5 + 0.1;
        this.brightness = Math.random();
    }

    update() {
        this.y += this.speed;
        if (this.y > GAME_HEIGHT) {
            this.y = 0;
            this.x = Math.random() * GAME_WIDTH;
        }
        if (Math.random() < 0.05) {
            this.brightness = Math.random();
        }
    }

    draw(ctx) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.brightness})`;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = randomRange(-2, 2);
        this.vy = randomRange(-2, 2);
        this.life = 1.0;
        this.decay = randomRange(0.02, 0.05);
        this.color = color;
        this.size = randomRange(2, 4);
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.type = type;
        this.speed = 2;
        this.markedForDeletion = false;
        
        // Visuals
        switch(type) {
            case WEAPON_RAPID: this.color = '#FFFF00'; this.label = 'R'; break;
            case WEAPON_SPREAD: this.color = '#00FFFF'; this.label = 'S'; break;
            case WEAPON_SUPER_RAPID: this.color = '#FF00FF'; this.label = 'SR'; break;
            case WEAPON_SUPER_SPREAD: this.color = '#00FF00'; this.label = 'SS'; break;
            case WEAPON_BOUNCE: this.color = '#FFA500'; this.label = 'B'; break; // Orange
            case WEAPON_DOPPELGANGER: this.color = '#FFFFFF'; this.label = 'D'; break;
            case WEAPON_SHIELD: this.color = '#0000FF'; this.label = 'SH'; break;
            case WEAPON_ROCKET: this.color = '#FF4500'; this.label = 'K'; break;
            case WEAPON_TRIPLE: this.color = '#AAAAAA'; this.label = 'T'; break;
            case WEAPON_HEALTH: this.color = '#00FF00'; this.label = '+'; break;
            case WEAPON_LASER: this.color = '#FF0000'; this.label = 'L'; break;
            default: this.color = '#fff'; this.label = '?';
        }
    }

    update() {
        this.y += this.speed;
        if (this.y > GAME_HEIGHT) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.label, this.x + this.width/2, this.y + this.height/2);
    }
}

class Bullet {
    constructor(x, y, vx, vy, isEnemy = false, isBouncing = false, isRocket = false, isLaser = false, isHoming = false, target = null) {
        this.x = x;
        this.y = y;
        this.width = isRocket ? 8 : (isLaser ? 4 : (isHoming ? 10 : 4));
        this.height = isRocket ? 16 : (isLaser ? GAME_HEIGHT : (isHoming ? 10 : 12));
        this.vx = vx;
        this.vy = vy;
        this.isEnemy = isEnemy;
        this.isBouncing = isBouncing;
        this.isRocket = isRocket;
        this.isLaser = isLaser;
        this.isHoming = isHoming;
        this.target = target;
        this.bounceCount = 0;
        this.maxBounces = 3;
        this.markedForDeletion = false;
        this.hp = isHoming ? 3 : 1;
        
        if (this.isLaser) {
            this.y = 0; 
            this.height = y; 
        }
    }

    update() {
        if (this.isHoming && this.target && !this.target.markedForDeletion) {
            // Homing logic: slowly steer velocity towards target
            const dx = (this.target.x + this.target.width / 2) - this.x;
            const dy = (this.target.y + this.target.height / 2) - this.y;
            const angleToTarget = Math.atan2(dy, dx);
            
            // Current angle
            let currentAngle = Math.atan2(this.vy, this.vx);
            
            // Smoothly interpolate angle (very slow turn for "circles")
            // Simple approach: Adjust velocity vector
            const turnSpeed = 0.05; // Low turn speed
            
            // We can just nudge the velocity towards the target vector
            // Normalize desired direction
            const dist = Math.sqrt(dx*dx + dy*dy);
            const dirX = dx / dist;
            const dirY = dy / dist;
            
            // Speed of missile
            const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
            
            this.vx += dirX * turnSpeed;
            this.vy += dirY * turnSpeed;
            
            // Re-normalize to constant speed
            const newSpeed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
            this.vx = (this.vx / newSpeed) * speed;
            this.vy = (this.vy / newSpeed) * speed;
        }

        this.x += this.vx;
        this.y += this.vy;

        if (this.isLaser) {
            // Laser lasts 1 frame, handled in collision/draw or check manually
            // We'll mark it for deletion in collision check or after 1 frame logic
             this.life = (this.life || 0) + 1;
             if (this.life > 1) this.markedForDeletion = true;
             return;
        }

        if (this.isBouncing) {
            // Bounce off walls
            if (this.x <= 0 || this.x + this.width >= GAME_WIDTH) {
                this.vx *= -1;
                this.bounceCount++;
            }
            if (this.y <= 0) { // Bounce off top
                this.vy *= -1;
                this.bounceCount++;
            }
             // Optional: Bounce off bottom? No, let it fall out.
            
            if (this.bounceCount > this.maxBounces) {
                this.markedForDeletion = true;
            }
        }

        // Screen boundaries for non-bouncing or bouncing falling out bottom
        if (this.y < -50 || this.y > GAME_HEIGHT + 50 || this.x < -50 || this.x > GAME_WIDTH + 50) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx) {
        if (this.isLaser) {
            ctx.fillStyle = '#FF0000'; // Core
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = 'rgba(255, 100, 100, 0.5)'; // Glow
            ctx.fillRect(this.x - 2, this.y, this.width + 4, this.height);
            return;
        }

        if (this.isRocket) {
             ctx.fillStyle = '#FF4500';
             // Body
             ctx.fillRect(this.x, this.y + 4, this.width, this.height - 4);
             // Nose
             ctx.beginPath();
             ctx.moveTo(this.x, this.y + 4);
             ctx.lineTo(this.x + this.width/2, this.y);
             ctx.lineTo(this.x + this.width, this.y + 4);
             ctx.fill();
             // Fins
             ctx.fillStyle = '#880000';
             ctx.fillRect(this.x - 2, this.y + this.height - 4, 2, 4);
             ctx.fillRect(this.x + this.width, this.y + this.height - 4, 2, 4);
             return;
        }

        if (this.isHoming) {
            ctx.fillStyle = '#800080'; // Purple
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
            ctx.fill();
            // Glow
            ctx.fillStyle = 'rgba(255, 0, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2 + 2, 0, Math.PI * 2);
            ctx.fill();

            // Show HP
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(Math.ceil(this.hp), this.x + this.width/2, this.y - 5);
            return;
        }

        ctx.fillStyle = this.isEnemy ? '#ff3333' : (this.isBouncing ? '#FFA500' : BULLET_COLOR);
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Enemy {
    constructor(x, y, type, isBoss = false, hp = 1) {
        this.x = x;
        this.y = y;
        this.isBoss = isBoss;
        
        if (this.isBoss) {
            this.width = 120;
            this.height = 60;
            this.hp = 100;
            this.maxHp = 100;
            this.scoreValue = 1000;
        } else {
            this.width = 30;
            this.height = 20;
            this.hp = hp;
            this.maxHp = hp;
            this.scoreValue = 10 + (type * 10) * hp;
        }

        this.type = type; 
        this.markedForDeletion = false;
        this.canShoot = isBoss || (Math.random() < 0.2); // 20% of normal enemies can shoot
    }

    draw(ctx) {
        let color = '#ff3333';
        
        if (this.isBoss) {
            // Boss visual
            ctx.fillStyle = '#880000';
            ctx.fillRect(this.x, this.y + 15, this.width, this.height - 30);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(this.x + 20, this.y, this.width - 40, this.height);
            // Boss HP Bar
            ctx.fillStyle = '#333';
            ctx.fillRect(this.x, this.y - 10, this.width, 5);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x, this.y - 10, this.width * (this.hp / this.maxHp), 5);
            return;
        }

        // Color based on MaxHP (Tier)
        switch(this.maxHp) {
            case 1: color = '#ff3333'; break;
            case 2: color = '#ffa500'; break;
            case 3: color = '#ffff00'; break;
            case 4: color = '#00ff00'; break;
            case 5: color = '#00ffff'; break;
            case 6: color = '#0000ff'; break;
            default: color = '#ff00ff'; break;
        }
        
        ctx.fillStyle = color;

        // Standard enemies
        if (this.type === 0) {
            ctx.fillRect(this.x + 10, this.y, 10, 5);
            ctx.fillRect(this.x + 5, this.y + 5, 20, 10);
            ctx.fillRect(this.x, this.y + 15, 5, 5);
            ctx.fillRect(this.x + 25, this.y + 15, 5, 5);
            ctx.fillRect(this.x + 10, this.y + 15, 10, 2);
        } else if (this.type === 1) {
            ctx.fillRect(this.x + 5, this.y, 20, 5);
            ctx.fillRect(this.x, this.y + 5, 30, 10);
            ctx.fillRect(this.x + 5, this.y + 15, 5, 5);
            ctx.fillRect(this.x + 20, this.y + 15, 5, 5);
        } else {
            ctx.fillRect(this.x + 10, this.y, 10, 5);
            ctx.fillRect(this.x + 2, this.y + 5, 26, 10);
            ctx.fillRect(this.x + 5, this.y + 15, 5, 5);
            ctx.fillRect(this.x + 20, this.y + 15, 5, 5);
        }
        
        // Eyes
        ctx.fillStyle = 'black';
        ctx.fillRect(this.x + this.width/2 - 6, this.y + 8, 4, 4);
        ctx.fillRect(this.x + this.width/2 + 2, this.y + 8, 4, 4);

        // HP Bar for non-boss tough enemies
        if (!this.isBoss && this.maxHp > 1) {
            const hpWidth = this.width;
            const hpHeight = 3;
            const hpY = this.y - 6;
            
            // Background
            ctx.fillStyle = '#550000';
            ctx.fillRect(this.x, hpY, hpWidth, hpHeight);
            
            // Foreground
            ctx.fillStyle = '#00ff00';
            const currentHpWidth = Math.max(0, (this.hp / this.maxHp) * hpWidth);
            ctx.fillRect(this.x, hpY, currentHpWidth, hpHeight);
        }
    }
}

class Doppelganger {
    constructor(player, offsetX = -80) {
        this.player = player;
        this.width = player.width;
        this.height = player.height;
        this.offsetX = offsetX;
        this.x = player.x + offsetX;
        this.y = player.y;
        this.active = false;
        this.hp = 3; 
    }

    update(deltaTime) {
        if (!this.active) return;
        
        // Smooth follow with offset
        const targetX = this.player.x + this.offsetX;
        this.x += (targetX - this.x) * 0.1;
        
        // Clamp to screen
        if (this.x < 0) this.x = 0;
        if (this.x > GAME_WIDTH - this.width) this.x = GAME_WIDTH - this.width;

        this.y = this.player.y;
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(this.x, this.y + 12, this.width, 12); 
        ctx.fillRect(this.x + 4, this.y + 6, this.width - 8, 6);
        ctx.fillRect(this.x + 14, this.y, 12, 6);
        ctx.globalAlpha = 1.0;
    }
}

class Player {
    constructor(game) {
        this.game = game;
        this.width = 40;
        this.height = 24;
        this.x = GAME_WIDTH / 2 - this.width / 2;
        this.y = GAME_HEIGHT - this.height - 20;
        this.speed = 0;
        this.maxSpeed = PLAYER_SPEED;
        
        this.bulletTimer = 0;
        this.baseBulletInterval = 400; 
        this.bulletInterval = this.baseBulletInterval; 
        
        // Inventory System
        this.weaponType = WEAPON_DEFAULT;
        this.ammo = {
            [WEAPON_RAPID]: 0,
            [WEAPON_SPREAD]: 0,
            [WEAPON_BOUNCE]: 0,
            [WEAPON_ROCKET]: 0,
            [WEAPON_LASER]: 0
        };
        
        // Super Weapon System
        this.superWeaponType = null;
        this.superWeaponDuration = 0;
        
        this.tripleTimer = 0;

        this.hp = 100;
        this.maxHp = 100;
        this.shieldActive = false;
        this.shieldHp = 0;

        this.doppelgangers = [];
    }

    handleKeyDown(e) {
        if (e.code === 'Digit1' || e.code === 'Numpad1' || e.key === '1') this.weaponType = WEAPON_DEFAULT;
        if ((e.code === 'Digit2' || e.code === 'Numpad2' || e.key === '2') && this.ammo[WEAPON_RAPID] > 0) this.weaponType = WEAPON_RAPID;
        if ((e.code === 'Digit3' || e.code === 'Numpad3' || e.key === '3') && this.ammo[WEAPON_SPREAD] > 0) this.weaponType = WEAPON_SPREAD;
        if ((e.code === 'Digit4' || e.code === 'Numpad4' || e.key === '4') && this.ammo[WEAPON_BOUNCE] > 0) this.weaponType = WEAPON_BOUNCE;
        if ((e.code === 'Digit5' || e.code === 'Numpad5' || e.key === '5') && this.ammo[WEAPON_ROCKET] > 0) this.weaponType = WEAPON_ROCKET;
        if ((e.code === 'Digit6' || e.code === 'Numpad6' || e.key === '6') && this.ammo[WEAPON_LASER] > 0) this.weaponType = WEAPON_LASER;
    }

    update(deltaTime) {
        if (this.game.keys['ArrowLeft']) this.speed = -this.maxSpeed;
        else if (this.game.keys['ArrowRight']) this.speed = this.maxSpeed;
        else this.speed = 0;

        this.x += this.speed;
        if (this.x < 0) this.x = 0;
        if (this.x > GAME_WIDTH - this.width) this.x = GAME_WIDTH - this.width;

        // Super Weapon Timer
        if (this.superWeaponDuration > 0) {
            this.superWeaponDuration -= deltaTime;
            if (this.superWeaponDuration <= 0) {
                this.superWeaponType = null;
                // Recalculate fire rate based on selected weapon
                this.updateFireRate(); 
            }
        }

        // Triple Weapon Timer
        if (this.tripleTimer > 0) {
            this.tripleTimer -= deltaTime;
            if (this.tripleTimer <= 0) {
                this.doppelgangers.forEach(d => d.active = false);
                this.doppelgangers = [];
            }
        }

        // Doppelgangers
        this.doppelgangers.forEach(d => d.update(deltaTime));

        // Shooting
        this.updateFireRate(); // Ensure interval is correct every frame (simplified)

        if (this.game.keys['Space']) {
            if (this.bulletTimer > this.bulletInterval) {
                this.shoot();
                this.doppelgangers.forEach(d => {
                    if (d.active) this.shoot(d);
                });
                this.bulletTimer = 0;
            }
        }
        this.bulletTimer += deltaTime;
    }

    updateFireRate() {
        if (this.superWeaponType === WEAPON_SUPER_RAPID) {
            this.bulletInterval = 60;
        } else if (this.superWeaponType === WEAPON_SUPER_SPREAD) {
            this.bulletInterval = 400;
        } else if (this.weaponType === WEAPON_RAPID) {
            this.bulletInterval = 150;
        } else if (this.weaponType === WEAPON_BOUNCE) {
            this.bulletInterval = 300;
        } else if (this.weaponType === WEAPON_ROCKET) {
            this.bulletInterval = 600;
        } else if (this.weaponType === WEAPON_LASER) {
            this.bulletInterval = 50;
        } else {
            this.bulletInterval = this.baseBulletInterval;
        }
    }

    activateCheat() {
        this.ammo[WEAPON_RAPID] = Infinity;
        this.ammo[WEAPON_SPREAD] = Infinity;
        this.ammo[WEAPON_BOUNCE] = Infinity;
        this.ammo[WEAPON_ROCKET] = Infinity;
        this.ammo[WEAPON_LASER] = Infinity;
        this.game.sounds.powerup(); 
    }

    setWeapon(type) {
        if (type === WEAPON_DOPPELGANGER) {
            this.doppelgangers = [new Doppelganger(this, -80)];
            this.doppelgangers[0].active = true;
            this.doppelgangers[0].hp = 3;
            return;
        }

        if (type === WEAPON_TRIPLE) {
            this.doppelgangers = [
                new Doppelganger(this, -80),
                new Doppelganger(this, 80)
            ];
            this.doppelgangers.forEach(d => {
                d.active = true;
                d.hp = 3;
            });
            this.tripleTimer = 10000;
            return;
        }

        if (type === WEAPON_HEALTH) {
            this.hp = Math.min(this.maxHp, this.hp + 20); // Regain 20 HP
            this.game.sounds.powerup(); // Generic sound
            return;
        }

        if (type === WEAPON_SHIELD) {
            this.shieldActive = true;
            this.shieldHp = 50; 
            return;
        }

        // Super Weapons (Time Limited, Forced)
        if (type === WEAPON_SUPER_RAPID) {
            this.superWeaponType = WEAPON_SUPER_RAPID;
            this.superWeaponDuration = 5000;
            return;
        } 
        if (type === WEAPON_SUPER_SPREAD) {
            this.superWeaponType = WEAPON_SUPER_SPREAD;
            this.superWeaponDuration = 8000;
            return;
        }

        // Standard Weapons (Ammo based)
        if (type === WEAPON_RAPID) {
            if (this.ammo[WEAPON_RAPID] !== Infinity) this.ammo[WEAPON_RAPID] = Math.min(AMMO_CAP_RAPID, this.ammo[WEAPON_RAPID] + 40);
        } else if (type === WEAPON_SPREAD) {
            if (this.ammo[WEAPON_SPREAD] !== Infinity) this.ammo[WEAPON_SPREAD] = Math.min(AMMO_CAP_SPREAD, this.ammo[WEAPON_SPREAD] + 20);
        } else if (type === WEAPON_BOUNCE) {
            if (this.ammo[WEAPON_BOUNCE] !== Infinity) this.ammo[WEAPON_BOUNCE] = Math.min(AMMO_CAP_BOUNCE, this.ammo[WEAPON_BOUNCE] + 15);
        } else if (type === WEAPON_ROCKET) {
            if (this.ammo[WEAPON_ROCKET] !== Infinity) this.ammo[WEAPON_ROCKET] = Math.min(AMMO_CAP_ROCKET, this.ammo[WEAPON_ROCKET] + 2);
        } else if (type === WEAPON_LASER) {
            if (this.ammo[WEAPON_LASER] !== Infinity) this.ammo[WEAPON_LASER] = Math.min(AMMO_CAP_LASER, this.ammo[WEAPON_LASER] + 5000);
        } else {
            // Default? usually not picked up
        }
    }

    shoot(sourceEntity = null) {
        const isDoppelganger = sourceEntity !== null;
        const sourceX = isDoppelganger ? sourceEntity.x : this.x;
        const sourceY = isDoppelganger ? sourceEntity.y : this.y;
        const centerX = sourceX + this.width / 2 - 2;
        
        const createBullet = (vx, vy, bounce = false, rocket = false, laser = false) => new Bullet(centerX, sourceY, vx, vy, false, bounce, rocket, laser);

        // Determine actual weapon to fire
        let activeWeapon = this.weaponType;
        if (this.superWeaponType) {
            activeWeapon = this.superWeaponType;
        } else {
            // Check ammo for standard weapons
            if (activeWeapon !== WEAPON_DEFAULT) {
                if (this.ammo[activeWeapon] > 0) {
                    if (!isDoppelganger) {
                        if (activeWeapon === WEAPON_LASER) {
                            this.ammo[activeWeapon] -= 50;
                        } else {
                            this.ammo[activeWeapon]--; // Only player consumes ammo
                        }
                    }
                    if (this.ammo[activeWeapon] <= 0) {
                        this.weaponType = WEAPON_DEFAULT; // Auto-downgrade
                    }
                } else {
                    activeWeapon = WEAPON_DEFAULT;
                }
            }
        }

        // Fire logic
        if (activeWeapon === WEAPON_SPREAD) {
            this.game.bullets.push(createBullet(0, -BULLET_SPEED));
            this.game.bullets.push(createBullet(-2, -6));
            this.game.bullets.push(createBullet(2, -6));
            this.game.sounds.shootSpread();
        } else if (activeWeapon === WEAPON_SUPER_SPREAD) {
            this.game.bullets.push(createBullet(0, -BULLET_SPEED));
            this.game.bullets.push(createBullet(-1.5, -6.5));
            this.game.bullets.push(createBullet(1.5, -6.5));
            this.game.bullets.push(createBullet(-3, -6));
            this.game.bullets.push(createBullet(3, -6));
            this.game.sounds.shootSuper();
        } else if (activeWeapon === WEAPON_BOUNCE) {
             this.game.bullets.push(createBullet(0, -BULLET_SPEED, true));
             this.game.bullets.push(createBullet(-3, -5, true));
             this.game.bullets.push(createBullet(3, -5, true));
             this.game.sounds.shootBounce();
        } else if (activeWeapon === WEAPON_RAPID) {
            this.game.bullets.push(createBullet(0, -BULLET_SPEED));
            this.game.sounds.shootRapid();
        } else if (activeWeapon === WEAPON_SUPER_RAPID) {
            this.game.bullets.push(createBullet(0, -BULLET_SPEED));
            this.game.sounds.shootSuper();
        } else if (activeWeapon === WEAPON_ROCKET) {
            this.game.bullets.push(createBullet(0, -(BULLET_SPEED + 3), false, true));
            this.game.sounds.shootSuper();
        } else if (activeWeapon === WEAPON_LASER) {
            this.game.bullets.push(createBullet(0, 0, false, false, true));
            this.game.sounds.shootRapid();
        } else {
            this.game.bullets.push(createBullet(0, -BULLET_SPEED));
            this.game.sounds.shoot();
        }
    }

    draw(ctx) {
        let drawColor = PLAYER_COLOR;
        const effectiveWeapon = this.superWeaponType || this.weaponType;

        if (effectiveWeapon === WEAPON_RAPID) drawColor = '#FFFF00';
        else if (effectiveWeapon === WEAPON_SUPER_RAPID) drawColor = '#FF00FF';
        else if (effectiveWeapon === WEAPON_SPREAD) drawColor = '#00FFFF';
        else if (effectiveWeapon === WEAPON_SUPER_SPREAD) drawColor = '#00FF00';
        else if (effectiveWeapon === WEAPON_BOUNCE) drawColor = '#FFA500';
        
        ctx.fillStyle = drawColor;
        ctx.fillRect(this.x, this.y + 12, this.width, 12);
        ctx.fillRect(this.x + 4, this.y + 6, this.width - 8, 6);
        ctx.fillRect(this.x + 14, this.y, 12, 6);
        
        this.doppelgangers.forEach(d => d.draw(ctx));

        if (this.shieldActive && this.shieldHp > 0) {
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 + Math.sin(Date.now() / 200) * 0.2})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = `rgba(0, 255, 255, 0.1)`;
            ctx.fill();
        }
    }
}

class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterVolume = 0.3;
    }

    playTone(freq, type, duration, vol = 1.0) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(vol * this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    shoot() {
        this.playTone(400, 'square', 0.1, 0.5);
        setTimeout(() => this.playTone(300, 'square', 0.1, 0.5), 50);
    }

    shootRapid() {
        this.playTone(600, 'sawtooth', 0.05, 0.4);
    }

    shootSpread() {
        this.playTone(300, 'triangle', 0.15, 0.6);
        setTimeout(() => this.playTone(200, 'triangle', 0.15, 0.4), 30);
    }

    shootBounce() {
        this.playTone(500, 'sine', 0.1, 0.6);
        setTimeout(() => this.playTone(800, 'sine', 0.1, 0.3), 50);
    }

    shootSuper() {
        this.playTone(800, 'square', 0.05, 0.6);
        setTimeout(() => this.playTone(200, 'sawtooth', 0.1, 0.6), 50);
    }

    enemyShoot() {
        this.playTone(200, 'sawtooth', 0.1, 0.3);
    }

    explosion() {
        this.playTone(100, 'sawtooth', 0.3, 0.8);
        this.playTone(50, 'square', 0.4, 0.8);
    }

    powerup() {
        this.playTone(600, 'sine', 0.1, 0.5);
        setTimeout(() => this.playTone(900, 'sine', 0.2, 0.5), 100);
    }

    damage() {
        this.playTone(150, 'sawtooth', 0.2, 0.8);
        this.playTone(100, 'sawtooth', 0.2, 0.8);
    }
    
    shieldHit() {
        this.playTone(800, 'square', 0.05, 0.4);
    }
}

class Game {
    constructor() {
        this.width = GAME_WIDTH;
        this.height = GAME_HEIGHT;
        this.keys = {};
        this.player = new Player(this);
        this.enemies = [];
        this.powerUps = [];
        this.particles = [];
        this.stars = [];
        this.bullets = []; // Unified bullet list (marked with isEnemy)
        
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.highScore = localStorage.getItem('invadersHighScore') || 0;
        this.gameOver = false;
        
        this.enemyDirection = 1;
        this.enemySpeed = ENEMY_BASE_SPEED;
        this.isBossLevel = false;

        this.sounds = new SoundManager();
        this.shake = 0;
        this.cheatBuffer = '';
        this.paused = false;

        this.initInput();
        this.initStars();
        this.startLevel();
    }

    initStars() {
        for(let i=0; i<100; i++) {
            this.stars.push(new Star());
        }
    }

    initInput() {
        window.addEventListener('keydown', e => {
            if (e.code === 'KeyP' || e.key.toLowerCase() === 'p') {
                this.paused = !this.paused;
                return;
            }

            if (e.key.length === 1) {
                this.cheatBuffer += e.key;
                if (this.cheatBuffer.length > 20) this.cheatBuffer = this.cheatBuffer.slice(-20);
                if (this.cheatBuffer.endsWith('branch of gold')) {
                    this.player.activateCheat();
                    this.cheatBuffer = '';
                }
            } else {
                this.cheatBuffer = '';
            }

            this.keys[e.code] = true;
            this.keys[e.key] = true;
            if (this.gameOver && e.code === 'Enter') this.restart();
            if (!this.gameOver) this.player.handleKeyDown(e);
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
            this.keys[e.key] = false;
        });
    }

    startLevel() {
        this.enemies = [];
        this.powerUps = [];
        this.bullets = []; 
        this.enemySpeed = ENEMY_BASE_SPEED + (this.level * 0.1);
        
        // Boss Level every 5 levels
        if (this.level % 5 === 0) {
            this.isBossLevel = true;
            // Spawn Boss
            const boss = new Enemy(GAME_WIDTH/2 - 60, 50, 0, true);
            boss.hp = 50 + (this.level * 10);
            boss.maxHp = boss.hp;
            this.enemies.push(boss);
        } else {
            this.isBossLevel = false;
            const rows = 4 + Math.min(this.level, 3);
            const cols = 8 + Math.min(this.level, 4);
            const startX = 50;
            const startY = 50;
            
            // Difficulty Calculation
            // Level 1: 0 steps. base=1, rem=0. All 1.
            // Level 2: 1 step. base=1, rem=1. Row 0 is 2.
            const difficultySteps = this.level - 1;
            const baseHp = 1 + Math.floor(difficultySteps / rows);
            const remainder = difficultySteps % rows;

            for (let r = 0; r < rows; r++) {
                let hp = baseHp;
                if (r < remainder) hp++;

                for (let c = 0; c < cols; c++) {
                    // Prevent overlapping grid with boundaries
                    const x = startX + c * 50;
                    if (x > GAME_WIDTH - 60) break;
                    
                    this.enemies.push(new Enemy(
                        x,
                        startY + r * 40,
                        r % 3,
                        false,
                        hp
                    ));
                }
            }
        }
    }

    createExplosion(x, y, color, count = 15) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    restart() {
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.gameOver = false;
        this.player = new Player(this);
        this.startLevel();
    }

    update(deltaTime) {
        this.stars.forEach(star => star.update());

        if (this.paused) return;

        if (this.shake > 0) this.shake -= deltaTime * 0.5;
        if (this.shake < 0) this.shake = 0;

        if (this.gameOver) return;

        this.player.update(deltaTime);
        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => p.life > 0);
        
        this.powerUps.forEach(p => p.update());
        this.powerUps = this.powerUps.filter(p => !p.markedForDeletion);
        
        this.bullets.forEach(b => b.update());
        this.bullets = this.bullets.filter(b => !b.markedForDeletion);

        this.updateEnemies();
        this.checkCollisions();
        this.updateUI();

        // Level Clear
        if (this.enemies.length === 0) {
            this.level++;
            // Bonus for life
            this.score += 1000;
            this.startLevel();
        }
    }

    updateEnemies() {
        let hitWall = false;
        let reachBottom = false;

        this.enemies.forEach(enemy => {
            // Boss Movement
            if (enemy.isBoss) {
                enemy.x += Math.sin(Date.now() / 500) * 3;
                
                const shootChance = 0.05 + (this.level * 0.005);

                if (Math.random() < shootChance) { // Boss shoots frequently
                     this.bullets.push(new Bullet(
                        enemy.x + enemy.width/2, 
                        enemy.y + enemy.height, 
                        randomRange(-2, 2), 
                        ENEMY_BULLET_SPEED, 
                        true
                    ));
                    this.sounds.enemyShoot();
                }

                // Homing Missile (Level 10+)
                const existingHoming = this.bullets.some(b => b.isEnemy && b.isHoming && !b.markedForDeletion);
                if (this.level >= 10 && !existingHoming && Math.random() < 0.005) { 
                     this.bullets.push(new Bullet(
                        enemy.x + enemy.width/2, 
                        enemy.y + enemy.height, 
                        0, 
                        1.5, 
                        true, 
                        false, 
                        false, 
                        false, 
                        true, 
                        this.player
                    ));
                    this.sounds.enemyShoot(); 
                }
                return; 
            }

            // Normal Enemy Movement
            enemy.x += this.enemySpeed * this.enemyDirection;
            if (enemy.x + enemy.width > this.width || enemy.x < 0) {
                hitWall = true;
            }
            if (enemy.y + enemy.height > this.player.y) {
                reachBottom = true;
            }

            // Normal Enemy Shooting
            if (enemy.canShoot && Math.random() < 0.002) { // Low chance per frame
                this.bullets.push(new Bullet(
                    enemy.x + enemy.width/2, 
                    enemy.y + enemy.height, 
                    0, 
                    ENEMY_BULLET_SPEED, 
                    true
                ));
                this.sounds.enemyShoot();
            }
        });

        if (hitWall) {
            this.enemyDirection *= -1;
            this.enemies.forEach(enemy => {
                if (!enemy.isBoss) enemy.y += 20;
            });
        }

        if (reachBottom) {
            this.handlePlayerDeath();
        }
    }

    checkCollisions() {
        // Player Bullets vs Homing Missiles
        const playerBullets = this.bullets.filter(b => !b.isEnemy && !b.markedForDeletion);
        const homingMissiles = this.bullets.filter(b => b.isEnemy && b.isHoming && !b.markedForDeletion);
        
        playerBullets.forEach(pb => {
            homingMissiles.forEach(hm => {
                if (pb.markedForDeletion || hm.markedForDeletion) return;
                
                if (checkRectCollision(pb, hm)) {
                    if (!pb.isLaser && !pb.isRocket) pb.markedForDeletion = true;
                    
                    if (pb.isRocket) {
                        pb.markedForDeletion = true;
                        this.createExplosion(pb.x, pb.y, '#FF4500', 20);
                        hm.hp -= 3; 
                    } else if (pb.isLaser) {
                         hm.hp -= 0.5; 
                    } else {
                         hm.hp -= 1;
                    }

                    this.createExplosion(hm.x + hm.width/2, hm.y + hm.height/2, '#800080', 3);
                    
                    if (hm.hp <= 0) {
                        hm.markedForDeletion = true;
                        this.createExplosion(hm.x + hm.width/2, hm.y + hm.height/2, '#800080', 15);
                        this.score += 50;
                    }
                }
            });
        });

        // Bullets vs Enemies / Player
        this.bullets.forEach(bullet => {
            if (bullet.markedForDeletion) return;

            if (bullet.isEnemy) {
                let hitShield = false;
                
                // Shield Collision Check (Circle vs Rect approx)
                if (this.player.shieldActive) {
                    const shieldX = this.player.x + this.player.width/2;
                    const shieldY = this.player.y + this.player.height/2;
                    const shieldRadius = this.player.width; // Approx radius

                    const bulletCenterX = bullet.x + bullet.width/2;
                    const bulletCenterY = bullet.y + bullet.height/2;

                    const dx = bulletCenterX - shieldX;
                    const dy = bulletCenterY - shieldY;
                    const dist = Math.sqrt(dx*dx + dy*dy);

                    if (dist < shieldRadius + bullet.width/2) {
                        hitShield = true;
                        bullet.markedForDeletion = true;
                        this.takeDamage(10);
                    }
                }

                if (!hitShield) {
                    // Check collision with Player Body
                    if (checkRectCollision(bullet, this.player)) {
                        bullet.markedForDeletion = true;
                        this.takeDamage(10); 
                    }
                }

                // Check collision with Doppelganger
                this.player.doppelgangers.forEach(d => {
                    if (d.active && checkRectCollision(bullet, d)) {
                         bullet.markedForDeletion = true;
                         d.hp--;
                         this.createExplosion(bullet.x, bullet.y, '#fff', 5);
                         if (d.hp <= 0) {
                             d.active = false;
                             this.createExplosion(d.x, d.y, '#fff', 20);
                         }
                    }
                });

            } else {
                // Player Bullet vs Enemies
                let rocketHit = false;
                this.enemies.forEach(enemy => {
                    if (enemy.markedForDeletion || bullet.markedForDeletion) return;
                    
                    if (checkRectCollision(bullet, enemy)) {
                        if (!bullet.isLaser && !bullet.isRocket) {
                             bullet.markedForDeletion = true;
                        } else if (bullet.isRocket) {
                             bullet.markedForDeletion = true;
                        }
                        // Laser does not delete itself on hit

                        if (bullet.isRocket) {
                            rocketHit = true;
                            // Explosion Logic
                            this.createExplosion(bullet.x, bullet.y, '#FF4500', 50);
                            this.sounds.explosion();
                            
                            // Damage Area
                            this.enemies.forEach(e => {
                                const dx = (e.x + e.width/2) - bullet.x;
                                const dy = (e.y + e.height/2) - bullet.y;
                                const dist = Math.sqrt(dx*dx + dy*dy);
                                if (dist < 100) {
                                    if (e.isBoss) {
                                        e.hp -= 25; 
                                        if (e.hp <= 0) {
                                            e.markedForDeletion = true;
                                            this.score += e.scoreValue;
                                            this.dropPowerUp(e.x, e.y);
                                        }
                                    } else {
                                        e.markedForDeletion = true;
                                        this.score += e.scoreValue;
                                    }
                                    this.createExplosion(e.x + e.width/2, e.y + e.height/2, '#FF4500', 10);
                                }
                            });
                        } else if (bullet.isLaser) {
                            // Laser Damage
                            const damage = 5; // 5 damage per tick (20 ticks/sec = 100 DPS)
                             if (enemy.isBoss) {
                                enemy.hp -= damage;
                                this.createExplosion(bullet.x, enemy.y + enemy.height, '#FF0000', 2);
                                if (enemy.hp <= 0) {
                                    enemy.markedForDeletion = true;
                                    this.createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#ff0000', 50);
                                    this.sounds.explosion();
                                    this.score += enemy.scoreValue;
                                    this.dropPowerUp(enemy.x, enemy.y); 
                                }
                            } else {
                                enemy.hp -= damage;
                                this.createExplosion(bullet.x, enemy.y + enemy.height, '#FF0000', 2);
                                if (enemy.hp <= 0) {
                                    enemy.markedForDeletion = true;
                                    this.createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#ff3333');
                                    this.sounds.explosion();
                                    this.score += enemy.scoreValue;
                                    if (Math.random() < 0.08) {
                                        this.dropPowerUp(enemy.x, enemy.y);
                                    }
                                }
                            }
                        } else {
                            if (enemy.isBoss) {
                                enemy.hp -= 2; // Damage
                                this.createExplosion(bullet.x, bullet.y, '#ffaa00', 3);
                                this.sounds.damage();
                                if (enemy.hp <= 0) {
                                    enemy.markedForDeletion = true;
                                    this.createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#ff0000', 50);
                                    this.sounds.explosion();
                                    this.score += enemy.scoreValue;
                                    this.dropPowerUp(enemy.x, enemy.y); 
                                }
                            } else {
                                enemy.hp -= 1; // Normal bullet damage
                                this.createExplosion(bullet.x, bullet.y, '#ffaa00', 3); // Hit effect

                                if (enemy.hp <= 0) {
                                    enemy.markedForDeletion = true;
                                    this.createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#ff3333');
                                    this.sounds.explosion();
                                    this.score += enemy.scoreValue;
                                    
                                    // High score update
                                    if (this.score > this.highScore) {
                                        this.highScore = this.score;
                                        localStorage.setItem('invadersHighScore', this.highScore);
                                    }

                                    // Speed up
                                    this.enemySpeed += 0.005;

                                    // Drop Chance
                                    if (Math.random() < 0.08) { // 8% chance
                                        this.dropPowerUp(enemy.x, enemy.y);
                                    }
                                }
                            }
                        }
                    }
                });
                
                if (rocketHit) return;
            }
        });

        // PowerUps Collection
        this.powerUps.forEach(pu => {
            if (pu.markedForDeletion) return;
            if (checkRectCollision(pu, this.player)) {
                pu.markedForDeletion = true;
                this.player.setWeapon(pu.type);
                this.score += 50;
                this.sounds.powerup();
            }
        });

        // Player vs Enemy Body
        this.enemies.forEach(enemy => {
            if (checkRectCollision(enemy, this.player)) {
                this.handlePlayerDeath();
            }
        });

        // Cleanup
        this.enemies = this.enemies.filter(e => !e.markedForDeletion);
    }

    dropPowerUp(x, y) {
        const available = [];
        // Common
        available.push({ type: WEAPON_RAPID, weight: 30 });
        available.push({ type: WEAPON_SPREAD, weight: 25 });

        // Uncommon
        available.push({ type: WEAPON_BOUNCE, weight: 10 });
        available.push({ type: WEAPON_HEALTH, weight: 10 }); 
        available.push({ type: WEAPON_SHIELD, weight: 8 });
        available.push({ type: WEAPON_ROCKET, weight: 8 });
        
        // Rare
        available.push({ type: WEAPON_DOPPELGANGER, weight: 5 });
        

        if (this.level >= 5) {
            available.push({ type: WEAPON_SUPER_RAPID, weight: 8 });
            available.push({ type: WEAPON_SUPER_SPREAD, weight: 8 });
        }

        if (this.level >= 10) {
            available.push({ type: WEAPON_TRIPLE, weight: 1 }); 
        }

        if (this.level > 15) {
            available.push({ type: WEAPON_LASER, weight: 5 });
        }

        // Weighted random choice
        const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * totalWeight;
        
        let type = WEAPON_RAPID; // Fallback
        for (const item of available) {
            random -= item.weight;
            if (random <= 0) {
                type = item.type;
                break;
            }
        }

        this.powerUps.push(new PowerUp(x, y, type));
    }

    takeDamage(amount) {
        if (this.player.shieldActive) {
            this.player.shieldHp -= amount;
            this.sounds.shieldHit();
            if (this.player.shieldHp <= 0) {
                this.player.shieldActive = false;
                this.player.shieldHp = 0;
                this.createExplosion(this.player.x + this.player.width/2, this.player.y + this.player.height/2, '#0000FF', 10); // Shield break effect
                this.sounds.explosion();
            } else {
                // Shield hit effect (smaller blue pop)
                this.createExplosion(this.player.x + this.player.width/2, this.player.y + this.player.height/2, '#00FFFF', 5);
            }
        } else {
            this.player.hp -= amount;
            this.createExplosion(this.player.x + this.player.width/2, this.player.y + this.player.height/2, '#ff3333', 5); // Blood/Sparks
            this.sounds.damage();
            this.shake = 15;
            
            // Flash screen red
            document.body.style.backgroundColor = '#330000';
            setTimeout(() => document.body.style.backgroundColor = '#0d0d0d', 50);

            if (this.player.hp <= 0) {
                this.handlePlayerDeath();
            }
        }
        this.updateUI();
    }

    handlePlayerDeath() {
        this.createExplosion(this.player.x + this.player.width/2, this.player.y + this.player.height/2, '#33ff00', 30);
        this.sounds.explosion();
        this.shake = 30;
        this.lives--;
        // Clear screen projectiles
        this.bullets = [];
        this.powerUps = [];
        this.player.doppelgangers = [];
        
        if (this.lives <= 0) {
            this.gameOver = true;
        } else {
            // Respawn delay or just reset position?
            this.player.x = GAME_WIDTH/2 - this.player.width/2;
            this.player.hp = this.player.maxHp; // Reset HP for new life
            this.player.shieldActive = false;
            // Note: We don't reset weapon inventory on death, only current weapon/ammo logic handles itself
            this.player.superWeaponType = null;
            this.player.superWeaponDuration = 0;
            // Optionally keep selected weapon or reset? Let's reset to default
            this.player.weaponType = WEAPON_DEFAULT;
        }
        this.updateUI();
    }

    updateArsenal() {
        const list = document.getElementById('arsenal-list');
        if (!list) return;

        let html = '';
        
        const weapons = [
            { id: WEAPON_DEFAULT, name: 'DEFAULT', key: '1' },
            { id: WEAPON_RAPID, name: 'RAPID', key: '2', color: '#FFFF00' },
            { id: WEAPON_SPREAD, name: 'SPREAD', key: '3', color: '#00FFFF' },
            { id: WEAPON_BOUNCE, name: 'BOUNCE', key: '4', color: '#FFA500' },
            { id: WEAPON_ROCKET, name: 'ROCKET', key: '5', color: '#FF4500' },
            { id: WEAPON_LASER, name: 'LASER', key: '6', color: '#FF0000' }
        ];

        weapons.forEach(w => {
            let ammo = 'INF';
            if (this.player.ammo[w.id] === Infinity) {
                ammo = 'INF';
            } else if (w.id === WEAPON_LASER) {
                ammo = (this.player.ammo[w.id] / 1000).toFixed(1) + 's';
            } else if (w.id !== WEAPON_DEFAULT) {
                ammo = this.player.ammo[w.id] || 0;
            }
            
            const activeClass = (this.player.weaponType === w.id) ? 'active' : '';
            const colorStyle = w.color ? `color: ${w.color}` : '';
            
            html += `
                <div class="weapon-item ${activeClass}" style="${colorStyle}">
                    <span class="weapon-name">[${w.key}] ${w.name}</span>
                    <span class="weapon-ammo">${ammo}</span>
                </div>
            `;
        });
        
        if (this.player.superWeaponType) {
             const time = Math.ceil(this.player.superWeaponDuration / 1000);
             let name = 'SUPER';
             if (this.player.superWeaponType === WEAPON_SUPER_RAPID) name = 'HYPER';
             if (this.player.superWeaponType === WEAPON_SUPER_SPREAD) name = 'OMEGA';
             
             html += `
                <div class="weapon-item active" style="color: #FF00FF; border-color: #FF00FF; margin-top: 10px;">
                    <span class="weapon-name">★ ${name}</span>
                    <span class="weapon-ammo">${time}s</span>
                </div>
             `;
        }
        
        if (this.player.tripleTimer > 0) {
             const time = Math.ceil(this.player.tripleTimer / 1000);
             html += `
                <div class="weapon-item active" style="color: #AAAAAA; border-color: #AAAAAA; margin-top: 10px;">
                    <span class="weapon-name">TRIPLE</span>
                    <span class="weapon-ammo">${time}s</span>
                </div>
             `;
        }

        list.innerHTML = html;
    }

    updateUI() {
        this.updateArsenal();
        document.getElementById('scoreVal').innerText = this.score;
        document.getElementById('highScoreVal').innerText = this.highScore;
        document.getElementById('levelVal').innerText = this.level;
        document.getElementById('livesVal').innerText = Math.max(0, this.lives);

        // Update Health Bar
        const hpPercent = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
        document.getElementById('health-bar-fill').style.width = `${hpPercent}%`;
        
        // Shield Indicator
        const shieldInd = document.getElementById('shield-indicator');
        if (this.player.shieldActive) {
            shieldInd.style.display = 'block';
            shieldInd.innerText = `[SHIELD: ${this.player.shieldHp}]`;
        } else {
            shieldInd.style.display = 'none';
        }

        let weaponName = 'DEFAULT';
        let color = '#fff';
        let activeWeapon = this.player.weaponType;
        let ammoCount = '';

        if (this.player.superWeaponType) {
            activeWeapon = this.player.superWeaponType;
            const secs = Math.ceil(this.player.superWeaponDuration / 1000);
            ammoCount = ` (${secs}s)`;
        } else if (activeWeapon !== WEAPON_DEFAULT) {
            if (this.player.ammo[activeWeapon] === Infinity) {
                ammoCount = ' [INF]';
            } else if (activeWeapon === WEAPON_LASER) {
                 ammoCount = ` [${(this.player.ammo[activeWeapon]/1000).toFixed(1)}s]`;
            } else {
                 ammoCount = ` [${this.player.ammo[activeWeapon]}]`;
            }
        }
        
        switch(activeWeapon) {
            case WEAPON_RAPID: weaponName = 'RAPID'; color = '#FFFF00'; break;
            case WEAPON_SPREAD: weaponName = 'SPREAD'; color = '#00FFFF'; break;
            case WEAPON_SUPER_RAPID: weaponName = 'HYPER'; color = '#FF00FF'; break;
            case WEAPON_SUPER_SPREAD: weaponName = 'OMEGA'; color = '#00FF00'; break;
            case WEAPON_BOUNCE: weaponName = 'BOUNCE'; color = '#FFA500'; break;
            case WEAPON_ROCKET: weaponName = 'ROCKET'; color = '#FF4500'; break;
            case WEAPON_LASER: weaponName = 'LASER'; color = '#FF0000'; break;
            default: weaponName = 'DEFAULT'; color = '#fff'; break;
        }

        const activeDoppelgangers = this.player.doppelgangers.filter(d => d.active).length;
        if (activeDoppelgangers === 1) weaponName += " + DUAL";
        else if (activeDoppelgangers >= 2) weaponName += " + TRIPLE";

        const wVal = document.getElementById('weaponVal');
        wVal.innerText = weaponName + ammoCount;
        wVal.style.color = color;
    }

    draw() {
        // Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.save();
        if (this.shake > 0) {
            ctx.translate(Math.random() * this.shake - this.shake/2, Math.random() * this.shake - this.shake/2);
        }

        // Stars
        this.stars.forEach(star => star.draw(ctx));

        // Game Objects
        if (!this.gameOver) {
            this.player.draw(ctx);
            this.powerUps.forEach(pu => pu.draw(ctx));
            this.enemies.forEach(enemy => enemy.draw(ctx));
            this.bullets.forEach(b => b.draw(ctx));
        }

        // Particles
        this.particles.forEach(p => p.draw(ctx));
        
        ctx.restore();

        if (this.paused) {
             ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
             ctx.fillRect(0, 0, this.width, this.height);
             ctx.fillStyle = '#fff';
             ctx.textAlign = 'center';
             ctx.font = '40px "Courier New"';
             ctx.fillText('PAUSED', this.width/2, this.height/2);
        }

        // Game Over Screen
        if (this.gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, this.width, this.height);
            
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.font = '50px "Courier New"';
            ctx.fillText('GAME OVER', this.width/2, this.height/2 - 20);
            
            ctx.font = '20px "Courier New"';
            ctx.fillText(`Final Score: ${this.score}`, this.width/2, this.height/2 + 30);
            
            ctx.fillStyle = '#33ff00';
            ctx.fillText('Press ENTER to Restart', this.width/2, this.height/2 + 80);
        }
    }
}

// --- Main Loop ---
const game = new Game();
let lastTime = 0;

function animate(timeStamp) {
    const deltaTime = timeStamp - lastTime;
    lastTime = timeStamp;

    game.update(deltaTime);
    game.draw();
    
    requestAnimationFrame(animate);
}

animate(0);