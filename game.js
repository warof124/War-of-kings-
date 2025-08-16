// ===============================
// War of Kings 3D Demo - Part 1
// Setup, Player, Camera, Controls
// ===============================

// Grab the canvas
const canvas = document.getElementById("renderCanvas");

// Create Babylon engine
const engine = new BABYLON.Engine(canvas, true);

// Create Scene
const createScene = () => {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color3(0, 0, 0);

    // Camera
    const camera = new BABYLON.ArcRotateCamera("camera",
        -Math.PI / 2, Math.PI / 2.5, 20,
        new BABYLON.Vector3(0, 1, 0), scene);
    camera.attachControl(canvas, true);

    // Light
    const light = new BABYLON.HemisphericLight("light",
        new BABYLON.Vector3(1, 1, 0), scene);

    // Ground
    const ground = BABYLON.MeshBuilder.CreateGround("ground",
        { width: 50, height: 50 }, scene);

    // Player (box)
    const player = BABYLON.MeshBuilder.CreateBox("player",
        { size: 1 }, scene);
    player.position.y = 1;
    player.material = new BABYLON.StandardMaterial("playerMat", scene);
    player.material.diffuseColor = new BABYLON.Color3(0, 0, 1);

    // Physics impostor
    player.physicsImpostor = new BABYLON.PhysicsImpostor(
        player, BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 1, restitution: 0.1 }, scene
    );

    // Movement controls
    let moveDirection = new BABYLON.Vector3.Zero();

    // Joystick setup
    const joystick = nipplejs.create({
        zone: document.getElementById("joystick"),
        mode: "static",
        position: { left: "50px", bottom: "50px" },
        color: "white"
    });

    joystick.on("move", (evt, data) => {
        const forward = Math.cos(data.angle.radian) * data.distance / 50;
        const right = Math.sin(data.angle.radian) * data.distance / 50;
        moveDirection.x = right;
        moveDirection.z = forward;
    });

    joystick.on("end", () => {
        moveDirection.set(0, 0, 0);
    });

    // Attack button
    document.getElementById("attackBtn").addEventListener("click", () => {
        console.log("Attack triggered!");
        // We'll add combat logic in Part 2
    });

    // Jump button
    document.getElementById("jumpBtn").addEventListener("click", () => {
        player.physicsImpostor.applyImpulse(
            new BABYLON.Vector3(0, 5, 0),
            player.getAbsolutePosition()
        );
    });

    // Scene update loop
    scene.onBeforeRenderObservable.add(() => {
        player.moveWithCollisions(moveDirection);
    });

    return { scene, player };
};

// Init
const { scene, player } = createScene();

// Run render loop
engine.runRenderLoop(() => {
    scene.render();
});

// Resize
window.addEventListener("resize", () => {
    engine.resize();
});
// ===============================
// War of Kings 3D Demo - Part 2
// Enemies, Boss, Combat, Loot
// (append this below Part 1 in the same file)
// ===============================

// ---- State ----
let enemies = [];        // { mesh, level, hp, speed }
let lootItems = [];      // { mesh, kind } kind: 'med' | 'gold'
let boss = null;         // { mesh, hp, speed, alive }
let totalKills = 0;

// Ensure player meta
player.health = 100;
player.maxHealth = 100;
player.xp = 0;

// Rebind the attack button from Part 1 to real combat now
const _attackBtn = document.getElementById("attackBtn");
if (_attackBtn) {
    _attackBtn.onclick = () => performAttack();
}

// ---- Enemy Spawning ----
function colorForLevel(lvl) {
    switch (lvl) {
        case 1: return new BABYLON.Color3(0.4, 0.8, 1.0); // light blue
        case 2: return new BABYLON.Color3(0.4, 0.9, 0.6); // green
        case 3: return new BABYLON.Color3(1.0, 0.85, 0.4);// amber
        case 4: return new BABYLON.Color3(1.0, 0.6, 0.5); // salmon
        case 5: return new BABYLON.Color3(0.75, 0.25, 0.25); // red
        default: return new BABYLON.Color3(0.9, 0.9, 0.9);
    }
}

function spawnEnemy(level = 1, pos = null) {
    const mesh = BABYLON.MeshBuilder.CreateBox("enemy", { size: 1 }, scene);
    const mat = new BABYLON.StandardMaterial("enemyMat", scene);
    mat.diffuseColor = colorForLevel(level);
    mesh.material = mat;
    mesh.position = pos || new BABYLON.Vector3(
        (Math.random() * 2 - 1) * 22,
        0.5,
        (Math.random() * 2 - 1) * 22
    );
    const hp = 25 + level * 20;
    const speed = 0.015 + level * 0.003;
    enemies.push({ mesh, level, hp, speed });
}

function spawnWave(count = 5) {
    for (let i = 0; i < count; i++) {
        const lvl = 1 + Math.floor(Math.random() * 5); // 1..5
        spawnEnemy(lvl);
    }
}

// Initial wave:
spawnWave(5);

// ---- Boss ----
function spawnBoss() {
    if (boss) return;
    const mesh = BABYLON.MeshBuilder.CreateSphere("boss", { diameter: 3 }, scene);
    const mat = new BABYLON.StandardMaterial("bossMat", scene);
    mat.diffuseColor = new BABYLON.Color3(0.45, 0.12, 0.12);
    mesh.material = mat;
    mesh.position = new BABYLON.Vector3(0, 1.5, -25);
    boss = { mesh, hp: 800, speed: 0.018, alive: true };
    toast("⚠️ Boss has appeared!");
}

// Trigger boss after enough kills
function maybeSpawnBoss() {
    if (totalKills >= 8 && !boss) spawnBoss();
}

// ---- Combat ----
let canSwing = true;
function performAttack() {
    if (!canSwing) return;
    canSwing = false;
    setTimeout(() => (canSwing = true), 220); // attack cooldown

    const p = player.position || player; // Part 1 used player as mesh; we kept it as mesh
    const attackOrigin = player.position ? player.position : player.mesh?.position;

    // strike radius
    const radius = 2.0;

    // hit one closest enemy
    let hitIndex = -1;
    let closestDist = 999;
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        const d = BABYLON.Vector3.Distance(attackOrigin, e.mesh.position);
        if (d < radius && d < closestDist) {
            closestDist = d;
            hitIndex = i;
        }
    }
    if (hitIndex >= 0) {
        enemies[hitIndex].hp -= 30;
        hitEffect(enemies[hitIndex].mesh.position);
        if (enemies[hitIndex].hp <= 0) {
            enemyKilled(enemies[hitIndex], hitIndex);
        }
    }

    // also check boss
    if (boss && boss.alive) {
        const db = BABYLON.Vector3.Distance(attackOrigin, boss.mesh.position);
        if (db < 2.6) {
            boss.hp -= 25;
            hitEffect(boss.mesh.position);
            if (boss.hp <= 0) {
                boss.alive = false;
                toast("👑 Boss defeated! Legendary loot dropped.");
                dropLoot(boss.mesh.position, true);
                boss.mesh.dispose();
                boss = null;
            }
        }
    }
}

function enemyKilled(enemy, index) {
    try { enemy.mesh.dispose(); } catch (e) {}
    enemies.splice(index, 1);
    totalKills++;
    dropLoot(enemy.mesh.position, false, enemy.level);
    toast(`Enemy down (${totalKills} total)`);
    maybeSpawnBoss();
}

// ---- Enemy / Boss AI ----
function updateEnemiesAndBoss() {
    // Enemies pursue and damage player if close
    const playerPos = player.position || player.mesh?.position;
    enemies.forEach((e) => {
        const dir = playerPos.subtract(e.mesh.position);
        dir.y = 0;
        const dist = dir.length();

        if (dist > 1.3) {
            e.mesh.position.addInPlace(dir.normalize().scale(e.speed));
        } else {
            // damage player on contact (simple)
            damagePlayer(0.15 * (1 + e.level * 0.25));
            // small pushback
            e.mesh.position.addInPlace(dir.normalize().scale(-0.02));
        }

        // idle spin
        e.mesh.rotation.y += 0.01;
    });

    // Boss AI
    if (boss && boss.alive) {
        const dir = playerPos.subtract(boss.mesh.position);
        dir.y = 0;
        const dist = dir.length();
        if (dist > 3) {
            boss.mesh.position.addInPlace(dir.normalize().scale(boss.speed));
        } else {
            // heavy hit (rate-limited)
            if (!boss._lastHit || performance.now() - boss._lastHit > 900) {
                damagePlayer(6); // chunky damage
                boss._lastHit = performance.now();
            }
        }
    }
}

// ---- Loot ----
function dropLoot(position, isBoss = false, enemyLevel = 1) {
    // medkit chance
    const medChance = isBoss ? 0.9 : 0.35 + enemyLevel * 0.05; // higher level => more med chance
    if (Math.random() < medChance) {
        const med = BABYLON.MeshBuilder.CreateBox("med", { size: 0.55 }, scene);
        med.position = position.clone().add(new BABYLON.Vector3((Math.random()-0.5)*0.8, 0.4, (Math.random()-0.5)*0.8));
        const mmat = new BABYLON.StandardMaterial("medMat", scene);
        mmat.diffuseColor = new BABYLON.Color3(0.2, 1, 0.4);
        med.material = mmat;
        lootItems.push({ mesh: med, kind: "med" });
    }

    // gold/xp orb
    const gold = BABYLON.MeshBuilder.CreateSphere("gold", { diameter: 0.6 }, scene);
    gold.position = position.clone().add(new BABYLON.Vector3((Math.random()-0.5)*0.8, 0.4, (Math.random()-0.5)*0.8));
    const gmat = new BABYLON.StandardMaterial("goldMat", scene);
    gmat.emissiveColor = new BABYLON.Color3(1.0, 0.85, 0.2);
    gold.material = gmat;
    lootItems.push({ mesh: gold, kind: "gold" });
}

function updateLoot() {
    const ppos = player.position || player.mesh?.position;
    for (let i = lootItems.length - 1; i >= 0; i--) {
        const item = lootItems[i];
        if (!item.mesh || item.mesh.isDisposed()) { lootItems.splice(i,1); continue; }

        // floaty spin
        item.mesh.rotation.y += 0.02;
        item.mesh.position.y = 0.35 + Math.sin(performance.now() * 0.004) * 0.05;

        // pickup
        const d = BABYLON.Vector3.Distance(ppos, item.mesh.position);
        if (d < 1.2) {
            if (item.kind === "med") {
                player.health = Math.min(player.maxHealth, player.health + 35);
                toast("❤️ +35 HP");
            } else if (item.kind === "gold") {
                player.xp += 10;
                toast("🪙 +10 XP");
            }
            try { item.mesh.dispose(); } catch(e) {}
            lootItems.splice(i, 1);
        }
    }
}

// ---- Damage, FX, Toast ----
function damagePlayer(amount) {
    player.health = Math.max(0, player.health - amount);
    if (player.health <= 0) {
        toast("💀 You died! (Reload page to restart)");
    }
}

function hitEffect(pos) {
    const s = BABYLON.MeshBuilder.CreateSphere("hitFX", { diameter: 0.2 }, scene);
    s.position = pos.clone().add(new BABYLON.Vector3(0, 0.6, 0));
    const mat = new BABYLON.StandardMaterial("hitFXMat", scene);
    mat.emissiveColor = new BABYLON.Color3(1, 0.5, 0.2);
    s.material = mat;
    setTimeout(() => { try { s.dispose(); } catch(e){} }, 150);
}

let _toastEl;
function toast(msg) {
    if (!_toastEl) {
        _toastEl = document.createElement("div");
        _toastEl.style.position = "fixed";
        _toastEl.style.left = "50%";
        _toastEl.style.bottom = "16px";
        _toastEl.style.transform = "translateX(-50%)";
        _toastEl.style.background = "rgba(0,0,0,0.65)";
        _toastEl.style.color = "#fff";
        _toastEl.style.padding = "8px 12px";
        _toastEl.style.borderRadius = "8px";
        _toastEl.style.fontFamily = "system-ui, Arial";
        _toastEl.style.zIndex = "9999";
        document.body.appendChild(_toastEl);
    }
    _toastEl.textContent = msg;
    _toastEl.style.display = "block";
    clearTimeout(_toastEl._hide);
    _toastEl._hide = setTimeout(()=> _toastEl.style.display = "none", 1600);
}

// ---- Hook enemy/boss/loot updates into the main loop ----
scene.onBeforeRenderObservable.add(() => {
    updateEnemiesAndBoss();
    updateLoot();
});
// ===============================
// War of Kings 3D Demo - Part 3
// Minimap, Quests, Save/Load
// ===============================

// ---- Minimap (canvas overlay) ----
const minimapCanvas = document.createElement("canvas");
minimapCanvas.width = 150;
minimapCanvas.height = 150;
minimapCanvas.style.position = "fixed";
minimapCanvas.style.top = "12px";
minimapCanvas.style.right = "12px";
minimapCanvas.style.background = "rgba(0,0,0,0.65)";
minimapCanvas.style.border = "2px solid #fff";
minimapCanvas.style.borderRadius = "8px";
minimapCanvas.style.zIndex = "9999";
document.body.appendChild(minimapCanvas);
const mapCtx = minimapCanvas.getContext("2d");

function renderMinimap() {
    mapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    const centerX = minimapCanvas.width/2;
    const centerY = minimapCanvas.height/2;
    const scale = 2.5;

    // player dot
    mapCtx.fillStyle = "blue";
    mapCtx.beginPath();
    mapCtx.arc(centerX, centerY, 5, 0, Math.PI*2);
    mapCtx.fill();

    // enemies
    mapCtx.fillStyle = "red";
    enemies.forEach((e) => {
        const dx = (e.mesh.position.x - player.position.x) / scale;
        const dz = (e.mesh.position.z - player.position.z) / scale;
        mapCtx.beginPath();
        mapCtx.arc(centerX+dx, centerY+dz, 3, 0, Math.PI*2);
        mapCtx.fill();
    });

    // boss
    if (boss && boss.alive) {
        mapCtx.fillStyle = "purple";
        const dx = (boss.mesh.position.x - player.position.x) / scale;
        const dz = (boss.mesh.position.z - player.position.z) / scale;
        mapCtx.beginPath();
        mapCtx.arc(centerX+dx, centerY+dz, 6, 0, Math.PI*2);
        mapCtx.fill();
    }
}

scene.onBeforeRenderObservable.add(() => {
    renderMinimap();
});

// ---- Quests / Missions ----
let questActive = null;

function newQuest() {
    if (!questActive) {
        questActive = {
            desc: "Defeat 3 enemies",
            targetKills: 3,
            startKills: totalKills
        };
        toast("📜 New Quest: " + questActive.desc);
    }
}

function checkQuestProgress() {
    if (questActive) {
        const progress = totalKills - questActive.startKills;
        if (progress >= questActive.targetKills) {
            toast("✅ Quest Complete: " + questActive.desc);
            player.xp += 50;
            questActive = null;
            setTimeout(newQuest, 5000); // new quest after 5s
        }
    }
}

// start first quest after 5s
setTimeout(newQuest, 5000);

scene.onBeforeRenderObservable.add(() => {
    checkQuestProgress();
});

// ---- Save / Load ----
function saveGame() {
    const saveData = {
        hp: player.health,
        xp: player.xp,
        kills: totalKills,
        quest: questActive
    };
    localStorage.setItem("warOfKingsSave", JSON.stringify(saveData));
    toast("💾 Game Saved");
}

function loadGame() {
    const raw = localStorage.getItem("warOfKingsSave");
    if (!raw) {
        toast("⚠️ No save found");
        return;
    }
    const data = JSON.parse(raw);
    player.health = data.hp || 100;
    player.xp = data.xp || 0;
    totalKills = data.kills || 0;
    questActive = data.quest || null;
    toast("📂 Save Loaded");
}

// keyboard shortcuts for testing
window.addEventListener("keydown", (ev) => {
    if (ev.key === "p") saveGame();
    if (ev.key === "l") loadGame();
});
