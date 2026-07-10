// ==========================================
// Web Audio APIによるプロシージャルサウンド生成
// ==========================================
class SoundController {
  constructor() {
    this.ctx = null;
    this.alarmOsc = null;
    this.alarmGain = null;
    this.sprayNoiseNode = null;
    this.sprayGain = null;
    this.fireNoiseNode = null;
    this.fireGain = null;
    this.alarmInterval = null;
    this.isMuted = false;
  }

  init() {
    if (this.ctx) return;
    // ブラウザのセキュリティ制限解除のため、ユーザーアクション後に呼び出す
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  // ホワイトノイズバッファの作成 (火や噴射音のベース)
  createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 1.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // サイレン (火災警報) の開始
  startAlarm() {
    this.init();
    if (this.alarmOsc) return;

    this.alarmGain = this.ctx.createGain();
    this.alarmGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.alarmGain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.5);

    this.alarmOsc = this.ctx.createOscillator();
    this.alarmOsc.type = 'sawtooth';
    this.alarmOsc.frequency.setValueAtTime(600, this.ctx.currentTime);

    // サイレンの音程変更 (ウーウー)
    let state = false;
    this.alarmInterval = setInterval(() => {
      if (!this.alarmOsc || this.isMuted) return;
      const targetFreq = state ? 850 : 580;
      this.alarmOsc.frequency.exponentialRampToValueAtTime(targetFreq, this.ctx.currentTime + 0.8);
      state = !state;
    }, 900);

    this.alarmOsc.connect(this.alarmGain);
    this.alarmGain.connect(this.ctx.destination);
    this.alarmOsc.start();
  }

  stopAlarm() {
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
    if (this.alarmOsc) {
      try {
        this.alarmGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.alarmGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
        const osc = this.alarmOsc;
        setTimeout(() => osc.stop(), 300);
      } catch (e) { }
      this.alarmOsc = null;
      this.alarmGain = null;
    }
  }

  // 燃焼音 (パチパチ・ゴォー) の開始
  startFireSound() {
    this.init();
    if (this.fireNoiseNode) return;

    const noiseBuffer = this.createNoiseBuffer();
    this.fireNoiseNode = this.ctx.createBufferSource();
    this.fireNoiseNode.buffer = noiseBuffer;
    this.fireNoiseNode.loop = true;

    // ゴォーという低音フィルタ
    const lpFilter = this.ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.setValueAtTime(220, this.ctx.currentTime);

    // パチパチという高音用バンドパス
    const bpFilter = this.ctx.createBiquadFilter();
    bpFilter.type = 'bandpass';
    bpFilter.frequency.setValueAtTime(1800, this.ctx.currentTime);
    bpFilter.Q.setValueAtTime(10, this.ctx.currentTime);

    this.fireGain = this.ctx.createGain();
    this.fireGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    // ノイズを低音と高音フィルタに分岐
    this.fireNoiseNode.connect(lpFilter);
    lpFilter.connect(this.fireGain);

    // パチパチ音用のゲインシェービング (ランダムパルス)
    const crackleGain = this.ctx.createGain();
    crackleGain.gain.setValueAtTime(0.02, this.ctx.currentTime);
    this.fireNoiseNode.connect(bpFilter);
    bpFilter.connect(crackleGain);
    crackleGain.connect(this.ctx.destination);

    this.fireGain.connect(this.ctx.destination);
    this.fireNoiseNode.start();

    // パチパチ音の強さをランダムに変更する処理
    this.crackleModulator = setInterval(() => {
      if (this.isMuted) return;
      crackleGain.gain.setValueAtTime(Math.random() > 0.75 ? 0.05 : 0.005, this.ctx.currentTime);
    }, 50);
  }

  setFireVolume(intensity) {
    if (this.fireGain && !this.isMuted) {
      this.fireGain.gain.linearRampToValueAtTime(0.08 * intensity, this.ctx.currentTime + 0.1);
    }
  }

  stopFireSound() {
    if (this.crackleModulator) {
      clearInterval(this.crackleModulator);
      this.crackleModulator = null;
    }
    if (this.fireNoiseNode) {
      try {
        this.fireNoiseNode.stop();
      } catch (e) { }
      this.fireNoiseNode = null;
      this.fireGain = null;
    }
  }

  // 消火器噴射音の開始/停止コントロール
  startSpraySound() {
    this.init();
    if (this.sprayNoiseNode) return;

    const noiseBuffer = this.createNoiseBuffer();
    this.sprayNoiseNode = this.ctx.createBufferSource();
    this.sprayNoiseNode.buffer = noiseBuffer;
    this.sprayNoiseNode.loop = true;

    // 「シュー」という高音フィルタ
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.Q.setValueAtTime(2.0, this.ctx.currentTime);

    this.sprayGain = this.ctx.createGain();
    this.sprayGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.sprayGain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 0.15);

    this.sprayNoiseNode.connect(filter);
    filter.connect(this.sprayGain);
    this.sprayGain.connect(this.ctx.destination);
    this.sprayNoiseNode.start();
  }

  stopSpraySound() {
    if (this.sprayNoiseNode) {
      try {
        const node = this.sprayNoiseNode;
        const gain = this.sprayGain;
        gain.gain.cancelScheduledValues(this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.15);
        setTimeout(() => {
          try { node.stop(); } catch (e) { }
        }, 200);
      } catch (e) { }
      this.sprayNoiseNode = null;
      this.sprayGain = null;
    }
  }

  stopAll() {
    this.stopAlarm();
    this.stopFireSound();
    this.stopSpraySound();
  }
}

const sounds = new SoundController();


// ==========================================
// A-Frame カスタムコンポーネント: 炎システム
// ==========================================
AFRAME.registerComponent('fire-system', {
  schema: {
    intensity: { type: 'number', default: 0.0 }, // 0 (消火) から 1.0 (最大)
    active: { type: 'boolean', default: false }
  },

  init: function () {
    this.particles = [];
    this.maxParticles = 120;
    this.particleGeometry = new THREE.BoxGeometry(0.06, 0.06, 0.06);

    // 炎・煙のカラーグラデーション
    this.colors = [
      new THREE.Color('#ff3a00'), // 赤
      new THREE.Color('#ff9000'), // オレンジ
      new THREE.Color('#ffd000'), // 黄
      new THREE.Color('#d0d0d0')  // 煙(薄いグレー)
    ];

    // パーティクルが所属するグループ
    this.group = new THREE.Group();
    this.el.setObject3D('fire-particles', this.group);
  },

  update: function (oldData) {
    if (this.data.active && this.data.intensity > 0) {
      this.el.setAttribute('visible', true);
    } else if (this.data.intensity <= 0) {
      this.el.setAttribute('visible', false);
    }
  },

  tick: function (time, timeDelta) {
    if (!this.data.active || this.data.intensity <= 0) {
      // 火が消滅中、残存パーティクルがあれば処理
      if (this.particles.length > 0) {
        this.updateParticles(timeDelta);
      }
      return;
    }

    sounds.setFireVolume(this.data.intensity);

    // 火の強度に基づいて新たなパーティクルを放出
    const spawnRate = Math.floor(this.data.intensity * 8);
    for (let i = 0; i < spawnRate; i++) {
      if (this.particles.length < this.maxParticles) {
        this.spawnParticle();
      }
    }

    this.updateParticles(timeDelta);
  },

  spawnParticle: function () {
    const isSmoke = Math.random() < 0.35 + (1.0 - this.data.intensity) * 0.3; // 火が弱まると煙が多くなる

    let color;
    if (isSmoke) {
      // 煙は明るい白〜グレーに変更 (黒さを低減)
      const c = 0.7 + Math.random() * 0.15;
      color = new THREE.Color(c, c, c);
    } else {
      // 炎は炎カラーからランダムに補間
      const idx = Math.floor(Math.random() * 3);
      color = this.colors[idx].clone().addScalar(Math.random() * 0.1 - 0.05);
    }

    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: isSmoke ? 0.7 : 0.9,
      blending: isSmoke ? THREE.NormalBlending : THREE.AdditiveBlending
    });

    const mesh = new THREE.Mesh(this.particleGeometry, material);

    // 開始位置 (ストーブ上のタオル周辺にぶらす)
    mesh.position.set(
      (Math.random() - 0.5) * 0.35,
      (Math.random() - 0.5) * 0.1,
      (Math.random() - 0.5) * 0.15
    );

    // スケール
    const startScale = (0.5 + Math.random() * 0.8) * (isSmoke ? 1.5 : 1.0);
    mesh.scale.set(startScale, startScale, startScale);

    // 速度ベクトル
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.15,
      0.6 + Math.random() * 0.6,
      (Math.random() - 0.5) * 0.15
    );

    // 火力に応じて上昇速度を変更
    velocity.y *= (0.5 + 0.5 * this.data.intensity);

    const particle = {
      mesh: mesh,
      velocity: velocity,
      life: 0,
      maxLife: 1.0 + Math.random() * 1.0, // 寿命数秒
      isSmoke: isSmoke
    };

    this.group.add(mesh);
    this.particles.push(particle);
  },

  updateParticles: function (timeDelta) {
    const dt = timeDelta / 1000;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        // パーティクルの死
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      // 移動
      p.mesh.position.addScaledVector(p.velocity, dt);

      // 徐々に減速、煙は少し左右に大きく漂う
      if (p.isSmoke) {
        p.velocity.x += (Math.random() - 0.5) * 0.1;
        p.velocity.z += (Math.random() - 0.5) * 0.1;
        p.mesh.scale.addScalar(dt * 0.4); // 煙は広がる
      } else {
        p.mesh.scale.addScalar(-dt * 0.3); // 炎は消え入る
      }

      // 透明度の減衰
      const lifeRatio = p.life / p.maxLife;
      p.mesh.material.opacity = (p.isSmoke ? 0.7 : 0.9) * (1.0 - lifeRatio);
    }
  }
});


// ==========================================
// A-Frame カスタムコンポーネント: 消火器・噴射
// ==========================================
AFRAME.registerComponent('extinguisher-component', {
  init: function () {
    this.isEquipped = false;
    this.isSpraying = false;
    this.sprayParticles = [];
    this.maxSprayParticles = 150;
    this.sprayTimeLeft = 60.0; // 60秒の放射時間
    this.usedAgent = 0.0;      // 実際に放射した秒数

    // 消火器の噴射口 (装備用消火器のノズル先端。VR時用にVRモデル、PC時用にカメラを参照するキャッシュを用意)
    this.camera = document.querySelector('#camera');
    this.sprayOriginVR = document.querySelector('#spray-origin-vr');
    this.nozzleVR = document.querySelector('#nozzle-vr');
    this.pcHUD = document.querySelector('#pc-ext-hud');
    this.hudAgentVal = document.querySelector('#hud-agent-val');
    this.hudAgentBar = document.querySelector('#hud-agent-bar');

    this.sprayOrigin = document.querySelector('#spray-origin-vr'); // デフォルト設定
    this.sprayGroup = new THREE.Group();
    this.el.sceneEl.object3D.add(this.sprayGroup);

    // アクションバインド
    this.el.addEventListener('click', () => {
      this.equip();
    });

    // 噴射用マテリアルとジオメトリ設定
    this.sprayGeometry = new THREE.SphereGeometry(0.04, 5, 5);

    // シミュレーション開始ボタンがクリックされたら、確実に自動的に装備を実行する
    const startBtn = document.querySelector('#start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        // フォーカスを確実にブラウザ本体に戻し、キー入力を受付可能にする
        setTimeout(() => {
          this.equip();
          document.body.focus();
        }, 150);
      });
    }

    // 重複を避けるためのSpaceキー噴射ハンドラ (A-Frameの入力フォーカス奪取に対抗するためwindowとdocument両方にバインド)
    const handleSprayStart = (e) => {
      if (!this.isEquipped) return;
      if (e.code === 'Space' || e.key === ' ') {
        // ボタンフォーカスによる意図しないボタン再クリック動作を防止
        if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
          document.activeElement.blur();
        }
        this.startSpraying();
        e.preventDefault();
      }
    };
    const handleSprayEnd = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        // 一度握ったら60秒間放射が止まらないため、キーを離しても停止しない仕様
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleSprayStart);
    window.addEventListener('keyup', handleSprayEnd);
    document.addEventListener('keydown', handleSprayStart);
    document.addEventListener('keyup', handleSprayEnd);

    // VR コントローラートリガーハンドラー
    const rightHand = document.querySelector('#right-hand');
    const leftHand = document.querySelector('#left-hand');
    const triggerHandler = (e) => {
      if (!this.isEquipped) return;
      this.startSpraying();
    };
    const triggerUpHandler = (e) => {
      // 一度トリガーを引いたら全量放射する仕様のため、離しても停止しない
    };

    if (rightHand) {
      rightHand.addEventListener('triggerdown', triggerHandler);
      rightHand.addEventListener('triggerup', triggerUpHandler);
    }
    if (leftHand) {
      leftHand.addEventListener('triggerdown', triggerHandler);
      leftHand.addEventListener('triggerup', triggerUpHandler);
    }
  },

  equip: function () {
    if (this.isEquipped) return;
    this.isEquipped = true;

    // 1. 3Dガイドを非表示にする
    const guide = document.querySelector('#ext-guide');
    if (guide) {
      guide.setAttribute('visible', 'false');
    }

    // 2. 床に置いてある消火器自身を非表示にし、クリック解除
    this.el.setAttribute('visible', 'false');
    this.el.classList.remove('clickable');

    const isVR = this.el.sceneEl.is('vr-mode');

    if (isVR) {
      // 3. (VR用) 右手コントローラーの下にあるVR用3D消火器を表示する
      const vrExt = document.querySelector('#extinguisher-vr');
      if (vrExt) {
        vrExt.setAttribute('visible', 'true');
      }
    } else {
      // 3. (PC用) 2D HUDを画面右下に表示する (3Dのめり込みを100%排除)
      if (this.pcHUD) {
        this.pcHUD.classList.remove('hidden');
      }
    }

    // HUDガイダンス更新
    const hint = document.querySelector('#instruction-hint');
    hint.innerHTML = isVR ? 'VRコントローラーのトリガーを押し続けて噴射してください！' : '画面を長押し（ドラッグ）して、火元に向けて噴射してください！';

    // 案内更新
    document.querySelector('#status-message').innerText = '消火器を装備しました！';
  },

  startSpraying: function () {
    if (this.isSpraying) return;
    this.isSpraying = true;
    sounds.startSpraySound();

    // レバーのアニメーション (VRモードの場合のみ3Dレバーを動かす)
    if (this.el.sceneEl.is('vr-mode')) {
      const lever = document.querySelector('#ext-lever-vr');
      if (lever) {
        lever.setAttribute('rotation', '0 0 0'); // 握りこむ
      }
    }
  },

  stopSpraying: function () {
    if (!this.isSpraying) return;
    this.isSpraying = false;
    sounds.stopSpraySound();

    // レバーを戻す (VRモードの場合のみ)
    if (this.el.sceneEl.is('vr-mode')) {
      const lever = document.querySelector('#ext-lever-vr');
      if (lever) {
        lever.setAttribute('rotation', '-15 0 0');
      }
    }
  },

  tick: function (time, timeDelta) {
    const dt = timeDelta / 1000;

    if (this.isSpraying) {
      // 放射時間を減らし、実際に使用した秒数を増やす
      this.sprayTimeLeft = Math.max(0, this.sprayTimeLeft - dt);
      this.usedAgent += dt;
      app.usedAgent = this.usedAgent; // アプリの統計マネージャー側へ同期

      // 噴射パーティクルの放出
      for (let i = 0; i < 4; i++) {
        if (this.sprayParticles.length < this.maxSprayParticles) {
          this.spawnSprayParticle();
        }
      }

      // ゲームロジック側で消火チェックを行う (Context不払いによるTypeErrorを回避するため引数渡し)
      const isVR = this.el.sceneEl.is('vr-mode');
      app.extinguishCheck(isVR, this.camera, this.sprayOriginVR, this.nozzleVR);

      // タイムアップ (60秒経過したら自動的にストップ)
      if (this.sprayTimeLeft <= 0) {
        this.stopSpraying();
      }
    }

    this.updateSprayParticles(timeDelta);

    // PCモード時、消火エージェントの残量を2D HUDに反映 (残り時間カウントダウンタイプ)
    if (this.isEquipped && !this.el.sceneEl.is('vr-mode')) {
      if (this.hudAgentVal) this.hudAgentVal.textContent = this.sprayTimeLeft.toFixed(1);
      if (this.hudAgentBar) this.hudAgentBar.style.width = (this.sprayTimeLeft / 60.0 * 100) + '%';
    }
  },

  spawnSprayParticle: function () {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.NormalBlending
    });

    const mesh = new THREE.Mesh(this.sprayGeometry, mat);

    const worldPos = new THREE.Vector3();
    const worldDir = new THREE.Vector3();
    const isVR = this.el.sceneEl.is('vr-mode');

    if (isVR) {
      // VRモード: 右手コントローラー下のノズル先端から射出
      if (this.sprayOriginVR) {
        this.sprayOriginVR.object3D.getWorldPosition(worldPos);
        const tempObj = new THREE.Object3D();
        this.sprayOriginVR.object3D.getWorldQuaternion(tempObj.quaternion);
        worldDir.set(0, 0, 1).applyQuaternion(tempObj.quaternion).normalize();
      } else {
        this.el.object3D.getWorldPosition(worldPos);
        worldDir.set(0, 0, -1).applyQuaternion(this.el.object3D.quaternion).normalize();
      }
    } else {
      // PCモード: カメラから前方の照準方向に向けて射出 (3Dノズルめり込みバグの完全排除)
      const camPos = new THREE.Vector3();
      const camDir = new THREE.Vector3();
      this.camera.object3D.getWorldPosition(camPos);
      this.camera.object3D.getWorldDirection(camDir);
      camDir.negate(); // 正面方向へ

      // 画面の右下から出ているように見せるためのオフセット位置計算
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.object3D.quaternion);
      const down = new THREE.Vector3(0, -1, 0).applyQuaternion(this.camera.object3D.quaternion);

      worldPos.copy(camPos)
        .addScaledVector(camDir, 0.4)
        .addScaledVector(right, 0.12)
        .addScaledVector(down, 0.15);

      worldDir.copy(camDir);
    }

    mesh.position.copy(worldPos);

    // 初期スケール
    const startScale = 0.5 + Math.random() * 0.5;
    mesh.scale.set(startScale, startScale, startScale);

    // 速度ベクトル（ノズルの向きに進む）
    // 少しコーン状にランダムに散らす(スプレー効果)
    const scatter = 0.08;
    const velocity = worldDir.clone().multiplyScalar(5.5).add(new THREE.Vector3(
      (Math.random() - 0.5) * scatter * 5,
      (Math.random() - 0.5) * scatter * 5,
      (Math.random() - 0.5) * scatter * 5
    ));

    const particle = {
      mesh: mesh,
      velocity: velocity,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.3
    };

    this.sprayGroup.add(mesh);
    this.sprayParticles.push(particle);
  },

  updateSprayParticles: function (timeDelta) {
    const dt = timeDelta / 1000;

    for (let i = this.sprayParticles.length - 1; i >= 0; i--) {
      const p = this.sprayParticles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.sprayGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.sprayParticles.splice(i, 1);
        continue;
      }

      // 移動・落下（重力の影響を少し加える）
      p.velocity.y -= 0.5 * dt; // じわっと落下する消火ガス
      p.velocity.multiplyScalar(0.97); // 空気抵抗
      p.mesh.position.addScaledVector(p.velocity, dt);

      // 時間とともに広がる
      p.mesh.scale.addScalar(dt * 2.2);

      // フェードアウト
      const ratio = p.life / p.maxLife;
      p.mesh.material.opacity = 0.6 * (1.0 - ratio);
    }
  },

  resetAll: function () {
    this.stopSpraying();
    // すべてのパーティクルをクリア
    for (let p of this.sprayParticles) {
      this.sprayGroup.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    this.sprayParticles = [];
    this.isEquipped = false;
    this.sprayTimeLeft = 60.0; // リセット
    this.usedAgent = 0.0;
    app.usedAgent = 0.0;

    // HUD表示リセット
    if (this.hudAgentVal) this.hudAgentVal.textContent = '60.0';
    if (this.hudAgentBar) this.hudAgentBar.style.width = '100%';

    // 床置き用消火器の表示をオンに戻す
    this.el.setAttribute('visible', 'true');
    this.el.classList.add('clickable');

    // VR用消火器を隠す
    const vrExt = document.querySelector('#extinguisher-vr');
    if (vrExt) {
      vrExt.setAttribute('visible', 'false');
    }

    // PC用HUDを隠す
    if (this.pcHUD) {
      this.pcHUD.classList.add('hidden');
    }

    // 3Dガイドを再表示
    const guide = document.querySelector('#ext-guide');
    if (guide) {
      guide.setAttribute('visible', 'true');
    }
  }
});


// ==========================================
// メインアプリケーションコントローラー
// ==========================================
class FireSimulationApp {
  constructor() {
    this.state = 'INIT'; // INIT, STARTING, FIRE, FAIL, CLEAR

    this.fireIntensity = 0.0;
    this.maxFireIntensity = 1.0;

    // 消火進行時間/使用量監視
    this.simulationStartTime = 0;
    this.fireStartTime = 0;
    this.extinguishStartTime = 0;
    this.isExtinguishing = false;
    this.usedAgent = 0; // 消火剤の使用量パラメータ

    this.dom = {
      startScreen: document.getElementById('start-screen'),
      hud: document.getElementById('hud'),
      clearScreen: document.getElementById('clear-screen'),
      statusMsg: document.getElementById('status-message'),
      hintMsg: document.getElementById('instruction-hint'),
      startBtn: document.getElementById('start-btn'),
      restartBtn: document.getElementById('restart-btn'),
      extTimeTxt: document.getElementById('extinguish-time'),
      agentUsedTxt: document.getElementById('agent-used'),
      uiContainer: document.getElementById('ui-container'),
      failScreen: document.getElementById('fail-screen'),
      failReason: document.getElementById('fail-reason'),
      retryBtn: document.getElementById('retry-btn'),
      clearRank: document.getElementById('clear-rank'),
      hudSprayBtn: document.getElementById('hud-spray-btn')
    };

    this.bindEvents();
  }

  bindEvents() {
    this.dom.startBtn.addEventListener('click', () => this.startSimulation());
    this.dom.restartBtn.addEventListener('click', () => this.resetSimulation());

    // 失敗（ゲームオーバー）画面でのリトライ
    if (this.dom.retryBtn) {
      this.dom.retryBtn.addEventListener('click', () => this.resetSimulation());
    }

    // HUDの「レバーを引く(噴射)」ボタンのクリックイベント (スマホ・PCマウス兼用)
    if (this.dom.hudSprayBtn) {
      this.dom.hudSprayBtn.addEventListener('click', () => {
        const extEl = document.querySelector('#extinguisher');
        if (extEl && extEl.components['extinguisher-component']) {
          const comp = extEl.components['extinguisher-component'];
          if (comp.isEquipped && !comp.isSpraying) {
            comp.startSpraying();
            // ボタンを無効化（スプレー中ホールド表現）
            this.dom.hudSprayBtn.disabled = true;
            this.dom.hudSprayBtn.innerText = '💨 噴射中...';
            this.dom.hudSprayBtn.style.background = '#8c1d1d';
          }
        }
      });
    }
  }

  // アプリ開始
  startSimulation() {
    sounds.init();

    this.dom.startScreen.classList.add('hidden');
    this.dom.hud.classList.remove('hidden');
    this.dom.uiContainer.style.pointerEvents = 'none'; // A-Frameへの入力を許可

    // スマホ用ボタン状態リセット
    if (this.dom.hudSprayBtn) {
      this.dom.hudSprayBtn.disabled = false;
      this.dom.hudSprayBtn.innerText = '💨 レバーを引く (噴射)';
      this.dom.hudSprayBtn.style.background = '#dc2626';
    }

    this.state = 'STARTING';
    this.dom.statusMsg.innerText = 'まもなく電気ストーブの熱でタオルが落下し、火事が発生します！';
    this.dom.hintMsg.innerText = '消火器は自動的に装備されました。そのまま火災発生をお待ちください。';

    this.simulationStartTime = Date.now();

    // 消火器の自動装備 (コンポーネントが初期化済みの場合は即装備。未ロード時はボタンクリック側のリスナーで自動装備)
    const extEl = document.querySelector('#extinguisher');
    if (extEl && extEl.components['extinguisher-component']) {
      extEl.components['extinguisher-component'].equip();
    }
    // フォーカスをbodyにあてて確実にキーイベントを受け取れる状態にする
    document.body.focus();

    // 3Dアセット取得
    this.towelObj = document.querySelector('#towel-wrapper');
    this.heaterElement = document.querySelector('#heater-element');
    this.heaterLight = document.querySelector('#heater-light');
    this.fireSource = document.querySelector('#fire-source');

    // 初期オブジェクト位置設定
    this.towelObj.setAttribute('position', '0 1.9 0');
    this.towelObj.setAttribute('rotation', '0 0 0');
    this.heaterElement.setAttribute('material', 'emissiveIntensity', '0.1');
    this.heaterLight.setAttribute('light', 'intensity', '0.1');

    // 段階的シーケンス
    // 1. ストーブが真っ赤に熱されていく
    setTimeout(() => {
      if (this.state !== 'STARTING') return;
      this.heaterElement.setAttribute('material', 'color', '#ff1100');
      this.heaterElement.setAttribute('material', 'emissiveIntensity', '1.5');
      this.heaterLight.setAttribute('light', 'intensity', '0.8');
    }, 1500);

    // 2. タオルが落下する
    setTimeout(() => {
      if (this.state !== 'STARTING') return;
      this.towelFallAnimation();
    }, 3000);
  }

  // タオル落下のJSアニメーション
  towelFallAnimation() {
    let startY = 1.9;
    let endY = 0.55;
    let duration = 1200; // ms
    let startTime = null;

    const animate = (timestamp) => {
      if (this.state !== 'STARTING') return;
      if (!startTime) startTime = timestamp;
      let progress = (timestamp - startTime) / duration;

      if (progress > 1) progress = 1;

      // 下降と、タオルが吹き飛ばされて奥に少し揺れる放物線表現 (Zも少し推移)
      let currentY = startY - (startY - endY) * progress;
      let currentZ = -((progress - 0.5) * (progress - 0.5) * 0.2) + (0.25 * 0.2); // 山なりに落ちる表現

      this.towelObj.setAttribute('position', `0 ${currentY} ${currentZ}`);
      // 落ちながら少し回転
      this.towelObj.setAttribute('rotation', `${progress * 45} 0 ${Math.sin(progress * Math.PI) * 10}`);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // 落下完了したら出火！
        this.triggerFire();
      }
    };

    requestAnimationFrame(animate);
  }

  // 出火シーケンス
  triggerFire() {
    this.state = 'FIRE';
    this.fireStartTime = Date.now();
    this.fireIntensity = 0.1;

    // HUD & 画面警報のオン
    this.dom.statusMsg.innerText = '【警告】火災発生！火元に照準を合わせてください！';
    this.dom.hintMsg.innerText = '【消火方法】[スペースキー]（VRはトリガー）を長押しして噴射してください！';
    this.dom.hud.classList.add('fire-alarm');

    // 赤い緊急フラッシュ用オーバーレイ追加 (画面上のクリックおよびキーイベントを邪魔しないよう pointer-events を無効化)
    const overlay = document.createElement('div');
    overlay.id = 'alarm-screen-flash';
    overlay.className = 'alarm-overlay';
    overlay.style.pointerEvents = 'none';
    document.body.appendChild(overlay);

    // インタラクションフォーカスを確保してスペースキー押下キー状態を切断しないようにする
    document.body.focus();

    // 警報機とパチパチ音再生
    sounds.startAlarm();
    sounds.startFireSound();

    // 炎パーティクルオン
    this.fireSource.setAttribute('fire-system', {
      active: true,
      intensity: this.fireIntensity
    });

    // 延焼・再燃・ゲームオーバー判定ループ (難易度・ゲーム性拡張)
    this.burnOutTimer = 0; // 最大火災の継続カウント用
    this.fireGrowInterval = setInterval(() => {
      if (this.state !== 'FIRE') {
        clearInterval(this.fireGrowInterval);
        return;
      }

      // 消火中でない（または的が逸れている）場合、火は自動的に勢いを増す (再燃・延焼)
      const extEl = document.querySelector('#extinguisher');
      let isSprayingAndHitting = false;
      let sprayTimeLeft = 60.0;
      if (extEl && extEl.components['extinguisher-component']) {
        const comp = extEl.components['extinguisher-component'];
        sprayTimeLeft = comp.sprayTimeLeft;
        if (comp.isSpraying && this.isExtinguishing) {
          isSprayingAndHitting = true;
        }
      }

      if (!isSprayingAndHitting) {
        if (this.fireIntensity < this.maxFireIntensity) {
          this.fireIntensity = Math.min(this.maxFireIntensity, this.fireIntensity + 0.05);
          this.fireSource.setAttribute('fire-system', 'intensity', this.fireIntensity);
        }
      }

      // 敗北条件1: 延焼拡大（炎レベル1.0に達して3.2秒放置されると全焼ゲームオーバー）
      if (this.fireIntensity >= this.maxFireIntensity) {
        this.burnOutTimer += 400;
        if (this.burnOutTimer >= 3200) {
          clearInterval(this.fireGrowInterval);
          this.triggerFail('burnout');
          return;
        }
        this.dom.statusMsg.innerText = '【警告】火が天井へ燃え広がっています！直ちに消火を！';
      } else {
        this.burnOutTimer = 0; // 火力を下げればタイマーリセット
      }

      // 敗北条件2: ガス欠（60秒フル放射完了までに火を消し止められなかったらゲームオーバー）
      if (sprayTimeLeft <= 0 && this.fireIntensity > 0) {
        clearInterval(this.fireGrowInterval);
        this.triggerFail('agent-empty');
        return;
      }

      // 燃え広がりとともに部屋の明暗も赤く染める
      const firePowerLight = this.fireIntensity * 2.5;
      this.heaterLight.setAttribute('light', {
        intensity: Math.max(0.1, firePowerLight),
        color: '#ff3300'
      });
    }, 400);
  }

  // 消火器の射程と判定チェック
  extinguishCheck(isVR, cameraEl, sprayOriginVR, nozzleVR) {
    if (this.state !== 'FIRE' || this.fireIntensity <= 0) return;

    // コリジョン判定: PC/VR別の照準軸でコリジョンを計算する
    const firePos = new THREE.Vector3();
    const nozzlePos = new THREE.Vector3();
    const nozzleDir = new THREE.Vector3();
    this.fireSource.object3D.getWorldPosition(firePos);

    if (isVR) {
      // VR: 手元銃口のワールド位置と前向き方向
      const nozzle = nozzleVR || document.querySelector('#nozzle-vr');
      const sprayOrigin = sprayOriginVR || document.querySelector('#spray-origin-vr');

      if (nozzle && sprayOrigin) {
        nozzle.object3D.getWorldPosition(nozzlePos);
        const tempObj = new THREE.Object3D();
        sprayOrigin.object3D.getWorldQuaternion(tempObj.quaternion);
        nozzleDir.set(0, 0, 1).applyQuaternion(tempObj.quaternion).normalize();
      }
    } else {
      // PC: カメラのワールド位置とカメラの注視方向
      const camera = cameraEl || document.querySelector('#camera');
      if (camera) {
        camera.object3D.getWorldPosition(nozzlePos);
        camera.object3D.getWorldDirection(nozzleDir);
        nozzleDir.negate(); // 正面向きへ
      }
    }

    // ノズルから火元への向きベクトル
    const toFireVec = new THREE.Vector3().subVectors(firePos, nozzlePos);
    const distance = toFireVec.length();
    toFireVec.normalize();

    // コサイン類似度（内積）で角度を算出
    const dot = nozzleDir.dot(toFireVec);
    const angleRad = Math.acos(Math.min(1, Math.max(-1, dot)));
    const angleDeg = angleRad * (180 / Math.PI);

    // デバッグログまたは条件: 消火器が火元に向いていて(約35度以内)、距離が3.2m以内なら有効
    if (angleDeg < 35 && distance < 3.2) {
      if (!this.isExtinguishing) {
        this.isExtinguishing = true;
        this.extinguishStartTime = Date.now();
      }

      // 消火処理: 火の勢いを徐々に弱める
      this.fireIntensity = Math.max(0, this.fireIntensity - 0.024);
      this.fireSource.setAttribute('fire-system', 'intensity', this.fireIntensity);

      // 火が弱まると、周辺の光も弱くなる
      this.heaterLight.setAttribute('light', 'intensity', Math.max(0.1, this.fireIntensity * 2.0));

      this.dom.statusMsg.innerText = '消火中！火の勢いが衰えています！';

      // 完全に消火された！
      if (this.fireIntensity <= 0) {
        this.triggerClear();
      }
    } else {
      this.isExtinguishing = false;
      this.dom.statusMsg.innerText = '消火剤が火元に届いていません！狙いを定めてください！';
    }
  }

  // 消火成功シーケンス
  triggerClear() {
    this.state = 'CLEAR';

    // タイマークリア
    if (this.fireGrowInterval) {
      clearInterval(this.fireGrowInterval);
    }

    sounds.stopAll();

    // UI切替
    this.dom.hud.classList.add('hidden');
    this.dom.hud.classList.remove('fire-alarm');
    this.dom.clearScreen.classList.remove('hidden');
    this.dom.uiContainer.style.pointerEvents = 'auto'; // UIを操作可能に戻す

    // 赤フラッシュ解除
    const flash = document.getElementById('alarm-screen-flash');
    if (flash) flash.remove();

    // 統計値の算出
    const timeSpent = ((Date.now() - this.fireStartTime) / 1000).toFixed(1);
    this.dom.extTimeTxt.innerText = timeSpent;

    // 消火器側から実際の噴射持続時間（秒数）を取得して表示
    const extEl = document.querySelector('#extinguisher');
    let usedVal = 0.0;
    if (extEl && extEl.components['extinguisher-component']) {
      usedVal = extEl.components['extinguisher-component'].usedAgent;
    }
    this.dom.agentUsedTxt.innerText = usedVal.toFixed(1);

    // 所要時間に基づく消火格付けランク決定 (S / A / B / C)
    let rank = 'C';
    let rankColor = '#4b5563'; // グレー
    if (parseFloat(timeSpent) <= 12.0) {
      rank = 'S';
      rankColor = '#d97706'; // 金
    } else if (parseFloat(timeSpent) <= 18.0) {
      rank = 'A';
      rankColor = '#ea580c'; // 橙
    } else if (parseFloat(timeSpent) <= 30.0) {
      rank = 'B';
      rankColor = '#2563eb'; // 青
    }

    if (this.dom.clearRank) {
      this.dom.clearRank.innerText = rank;
      this.dom.clearRank.style.background = rankColor;
    }

    // 火のベースを綺麗に非表示にする
    this.fireSource.setAttribute('fire-system', {
      active: false,
      intensity: 0
    });
    this.heaterLight.setAttribute('light', 'intensity', '0.1');

    // タオルに炭化焦げマテリアル風の設定（黒くする）
    const towel = document.querySelector('#towel');
    if (towel) {
      towel.setAttribute('color', '#333333');
    }
  }

  // 消火失敗 (ゲームオーバー) シーケンス
  triggerFail(reason) {
    this.state = 'FAIL';

    // タイマークリア
    if (this.fireGrowInterval) {
      clearInterval(this.fireGrowInterval);
    }

    // 噴射と音を完全停止させる
    const extEl = document.querySelector('#extinguisher');
    if (extEl && extEl.components['extinguisher-component']) {
      extEl.components['extinguisher-component'].stopSpraying();
    }
    sounds.stopAll();

    this.dom.hud.classList.add('hidden');
    this.dom.hud.classList.remove('fire-alarm');
    this.dom.uiContainer.style.pointerEvents = 'auto';

    // 赤フラッシュがあれば消去
    const flash = document.getElementById('alarm-screen-flash');
    if (flash) flash.remove();

    // 敗北原因別ビジュアル＆テキスト
    if (reason === 'burnout') {
      this.dom.failReason.innerText = '消火失敗：火が天井まで燃え広がり、全焼しました！直ちに119番通報して避難してください。';
      this.heaterLight.setAttribute('light', 'intensity', '3.5');
      this.fireSource.setAttribute('fire-system', 'intensity', '1.0');
    } else if (reason === 'agent-empty') {
      this.dom.failReason.innerText = '消火失敗：消火ガスの残時間がゼロになりました！無理せず速やかに屋外へ退避してください。';
      this.heaterLight.setAttribute('light', {
        intensity: '1.2',
        color: '#7f7f7f'
      });
    }

    // 警報音を継続してスリル演出
    sounds.startAlarm();

    this.dom.failScreen.classList.remove('hidden');
  }

  // シミュレーションリセット（最初に戻る）
  resetSimulation() {
    // 状態クリア
    this.state = 'INIT';
    this.fireIntensity = 0.0;
    this.usedAgent = 0;
    this.isExtinguishing = false;

    if (this.fireGrowInterval) {
      clearInterval(this.fireGrowInterval);
    }

    sounds.stopAll();

    // 赤フラッシュがあれば消す
    const flash = document.getElementById('alarm-screen-flash');
    if (flash) flash.remove();

    // 3Dオブジェクト状態リセット
    const extinguisherEl = document.querySelector('#extinguisher');
    if (extinguisherEl) {
      const extComp = extinguisherEl.components['extinguisher-component'];
      if (extComp) {
        extComp.resetAll();
      }

      // 床置き消火器の座標・姿勢のみ初期値に戻す
      extinguisherEl.setAttribute('position', '0.6 0.1 -1.4');
      extinguisherEl.setAttribute('rotation', '0 -35 0');
      extinguisherEl.setAttribute('scale', '1 1 1');
    }

    // タオルの色と位置を元に戻す
    const towel = document.querySelector('#towel');
    if (towel) {
      towel.setAttribute('color', '#ffffff');
    }
    if (this.towelObj) {
      this.towelObj.setAttribute('position', '0 1.9 0');
      this.towelObj.setAttribute('rotation', '0 0 0');
    }

    // ヒーター元に戻す
    if (this.heaterElement) {
      this.heaterElement.setAttribute('material', 'color', '#330000');
      this.heaterElement.setAttribute('material', 'emissiveIntensity', '0.1');
    }
    if (this.heaterLight) {
      this.heaterLight.setAttribute('light', 'intensity', '0.1');
    }

    // UIリセット
    this.dom.clearScreen.classList.add('hidden');
    this.dom.failScreen.classList.add('hidden'); // 失敗画面も隠す
    this.dom.startScreen.classList.remove('hidden');
    this.dom.hud.classList.add('hidden');
    this.dom.hud.classList.remove('fire-alarm');
  }
}

// アプリの起動インスタンス
let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new FireSimulationApp();
});
