/* TODO
HIGH game over screen
HIGH better particle patterns
MEDIUM fullscreen button
MEDIUM particle absorbed effect
MEDIUM audio (tetris) & gfx
LOW menu screen
*/

import * as PIXI from "pixi.js";
import memoize from "lodash/memoize";
import Spawner from "entity-spawner";
import resources from "./resources";
import { getUserEvents } from "./controls";
import audioSync from "./audio";

const audioTriggers = {
  triggerExplode: 0,
  triggerMelt: 0,
  triggerTurn: 0,
  triggerFall: 0,
  triggerRow: 0
};
const audio = {
  volume: 0,
  musicVolume: 0,
  melodyVolume: 0,
  mix: 0,
  ...audioTriggers
};

let userWantVolume = true;

PIXI.utils.skipHello();

function res(t) {
  return t - Math.floor(t);
}

const GAME_W = 1200;
const GAME_H = 600;

const app = new PIXI.Application({
  width: GAME_W,
  height: GAME_H,
  backgroundColor: 0x000000
});

const widthPerShape = memoize(
  shape => shape.reduce((m, s) => (m > s[0] ? m : s[0]), 0) + 1
);
const offsetPerShape = memoize(
  shape => -shape.reduce((m, s) => (m < s[0] ? m : s[0]), 0)
);

function moveShape(shape, [dx, dy]) {
  return shape.map(([x, y]) => [Math.floor(x + dx), Math.floor(y + dy)]);
}

function generateShapes(shape, centerOffset, offset) {
  const shapes = [centerOffset ? moveShape(shape, centerOffset) : shape];
  for (let i = 1; i < 4; i++) {
    shapes.push(shapes[shapes.length - 1].map(([x, y]) => [-y, x]));
  }
  if (offset) {
    for (let i = 0; i < 4; i++) {
      shapes[i] = moveShape(shapes[i], offset);
    }
  }
  return shapes;
}

resources.then(resources => {
  const pieceInfos = [
    {
      id: "O",
      shapes: [
        [[0, 0], [1, 0], [0, 1], [1, 1]],
        [[0, 0], [1, 0], [0, 1], [1, 1]],
        [[0, 0], [1, 0], [0, 1], [1, 1]],
        [[0, 0], [1, 0], [0, 1], [1, 1]]
      ]
    },
    {
      id: "I",
      shapes: generateShapes(
        [[0, 0], [0, 1], [0, 2], [0, 3]],
        [0.5, -1.5],
        [0.5, 2.5]
      )
    },
    {
      id: "S",
      shapes: generateShapes(
        [[1, 0], [2, 0], [0, 1], [1, 1]],
        [-1, -0.5],
        [0.5, 1.5]
      )
    },
    {
      id: "Z",
      shapes: generateShapes(
        [[0, 0], [1, 0], [1, 1], [2, 1]],
        [-1, -0.5],
        [0, 1.5]
      )
    },
    {
      id: "L",
      shapes: generateShapes(
        [[0, 0], [0, 1], [0, 2], [1, 2]],
        [-1, -0.5],
        [0.5, 1.5]
      )
    },
    {
      id: "J",
      shapes: generateShapes(
        [[1, 0], [1, 1], [0, 2], [1, 2]],
        [-1, -0.5],
        [0.5, 1.5]
      )
    },
    {
      id: "T",
      shapes: generateShapes(
        [[0, 0], [1, 0], [2, 0], [1, 1]],
        [-1, -0.5],
        [0.5, 1.5]
      )
    }
  ];

  function rotateShape(pieceInfo, currentIndex, rot) {
    return (
      (pieceInfo.shapes.length + currentIndex + rot) % pieceInfo.shapes.length
    );
  }

  const TETRIS_W = 10;
  const TETRIS_H = 20;
  const TETRIS_TILE = 20;
  const TETRIS_W_PX = TETRIS_W * TETRIS_TILE;
  const TETRIS_H_PX = TETRIS_H * TETRIS_TILE;
  const yToRow = y => TETRIS_H - y - 1;

  class TetrisBoard extends PIXI.Container {
    constructor() {
      super();
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 20; j++) {
          const cell = PIXI.Sprite.from(resources.cell.texture);
          cell.width = 20;
          cell.height = 20;
          cell.position.x = i * 20;
          cell.position.y = j * 20;
          this.addChild(cell);
        }
      }
    }
  }

  class TetrisBlock extends PIXI.Sprite {
    boardPosition = [0, 0];
    completedTime = 0;
    constructor(pink, frozen = false) {
      super(resources.block.texture);
      this.width = 20;
      this.height = 20;
      if (frozen) this.alpha = 0.5;
      this.setPink(pink);
    }
    setBoardPosition(x, y) {
      this.boardPosition = [x, y];
      this.position.x = x * TETRIS_TILE;
      this.position.y = y * TETRIS_TILE;
    }
    update(dt) {
      const target = this.boardPosition[1] * TETRIS_TILE;
      const dy = target - this.position.y;
      if (dy > 0) {
        this.position.y = Math.min(target, this.position.y + 2 * dt);
      }
      if (dy < 0) {
        this.position.y = Math.max(target, this.position.y - 2 * dt);
      }
      if (this.completedTime) {
        if (Date.now() - this.completedTime > 200) {
          this.parent.removeChild(this);
        } else {
          this.alpha += 0.01 * (1 - this.alpha);
        }
      }
    }
    complete() {
      this.completedTime = Date.now();
      this.tint = 0xffffff;
      this.alpha = 1;
    }
    fallToY(y) {
      this.boardPosition[1] = y;
    }
    setPink(pink) {
      if (this.completedTime) return;
      this.tint = pink ? 0xff0099 : 0x0099ff;
    }
    collidesCircle(p, r) {
      const dx = this.position.x + 10 - p.x;
      const dy = this.position.y + 10 - p.y;
      const dr = r + 10;
      return dx * dx + dy * dy < dr * dr;
    }
  }

  class TetrisPiece extends PIXI.Container {
    constructor(pieceInfo, index) {
      super();
      this.index = index;
      this.pieceInfo = pieceInfo;
      const pink = this.isPink();
      pieceInfo.shapes[index].forEach(([x, y]) => {
        const block = new TetrisBlock(pink);
        block.setBoardPosition(x, y);
        this.addChild(block);
      });
    }
    blur() {
      this.alpha = 0.3;
    }
    focus() {
      this.alpha = 1;
    }
    setBoardPosition(x, y) {
      this.boardPosition = [x, y];
      this.position.x = x * TETRIS_TILE;
      this.position.y = y * TETRIS_TILE;
    }
    setIndex(index) {
      this.index = index;
      const pink = this.isPink();
      this.pieceInfo.shapes[index].forEach(([x, y], i) => {
        const c = this.children[i];
        c.setBoardPosition(x, y);
        c.setPink(pink);
      });
    }
    getShape() {
      return this.pieceInfo.shapes[this.index];
    }
    isPink() {
      return this.index % 2 === 0;
    }
    collidesCircle(p, r) {
      const pr = {
        x: p.x - this.position.x,
        y: p.y - this.position.y
      };
      return this.children.some(c => c.collidesCircle(pr, r));
    }
  }

  class Shield extends PIXI.Container {
    lastHighlight = 0;
    constructor(pink) {
      super();
      this.img = PIXI.Sprite.from(resources.shield.texture);
      this.img.height = TETRIS_H * TETRIS_TILE;
      this.img.width = 4;
      this.img.alpha = 0.4;
      this.addChild(this.img);
      this.setPink(pink);
    }
    update() {
      this.img.alpha += 0.04 * (0.3 - this.img.alpha);
    }
    highlight() {
      this.img.alpha = 0.8;
    }
    setPink(pink) {
      if (this.pink === pink) return;
      this.pink = pink;
      this.img.tint = pink ? 0xff0099 : 0x0099ff;
      this.highlight();
    }
  }

  class Score extends PIXI.Container {
    constructor() {
      super();
      this.text = new PIXI.Text("", {
        fontSize: 32,
        fontFamily: "VT323"
      });
      this.text.anchor.x = 0.5;
      this.addChild(this.text);
    }
    _score = -1;
    setScore(score) {
      if (score !== this._score) {
        this.text.text = "" + score;
      }
    }
    setPink(pink) {
      this.text.style.fill = pink ? 0xff0099 : 0x0099ff;
    }
  }

  class MenuScreen extends PIXI.Container {
    constructor() {
      super();

      this.background = PIXI.Sprite.from(resources.layer.texture);
      this.background.width = TETRIS_W_PX;
      this.background.height = TETRIS_H_PX;
      this.addChild(this.background);

      this.title = new PIXI.Text("Tetrikaruga", {
        fontSize: 36,
        fontFamily: "VT323",
        fill: 0xff0099
      });
      this.title.position.x = 20;
      this.title.position.y = 20;
      this.addChild(this.title);

      this.body = new PIXI.Text(
        "Tetris vs Ikaruga.\n\n\nCONTROLS\n  Arrows/WASD: move\n  Space: rotate",
        {
          fontSize: 16,
          lineHeight: 20,
          fontFamily: "VT323",
          fill: 0x0099ff
        }
      );
      this.body.position.x = 20;
      this.body.position.y = 120;
      this.addChild(this.body);

      this.footer = new PIXI.Text("Press any key to start", {
        fontSize: 18,
        fontFamily: "VT323"
      });
      this.footer.position.x = 20;
      this.footer.position.y = 360;
      this.addChild(this.footer);

      this.out = new PIXI.Text(
        "LD41 “Combine 2 Incompatible Games” – by @greweb\nrc-5",
        {
          fontSize: 16,
          fontFamily: "VT323",
          fill: 0x0099ff
        }
      );
      this.out.position.x = -50;
      this.out.position.y = 440;
      this.addChild(this.out);

      this.setPink(true);
      this.setReady(false);
    }

    setReady(ready) {
      this.footer.alpha = ready ? 1 : 0;
    }

    setPink(pink) {
      this.pink = pink;
      this.footer.style.fill = pink ? 0xff0099 : 0x0099ff;
    }

    lastT = 0;
    update(dt) {
      this.lastT += dt;
      if (this.lastT > 20) {
        this.lastT = res(this.lastT);
        this.setPink(!this.pink);
      }
    }
  }

  class GameOverScreen extends PIXI.Container {
    constructor(game) {
      super();
      this.game = game;

      this.background = PIXI.Sprite.from(resources.layer.texture);
      this.background.width = TETRIS_W_PX;
      this.background.height = TETRIS_H_PX;
      this.addChild(this.background);

      this.title = new PIXI.Text("Game Over", {
        fontSize: 44,
        fontFamily: "VT323"
      });
      this.title.position.x = 20;
      this.title.position.y = 20;
      this.addChild(this.title);

      this.score = new PIXI.Text("Score: " + game.getScore(), {
        fontSize: 32,
        fontFamily: "VT323"
      });
      this.score.position.x = 20;
      this.score.position.y = 160;
      this.addChild(this.score);

      this.best = new PIXI.Text(
        "Best: " + (localStorage.bestScore || game.getScore()),
        {
          fontSize: 32,
          fontFamily: "VT323"
        }
      );
      this.best.position.x = 20;
      this.best.position.y = 220;

      this.addChild(this.best);
      this.footer = new PIXI.Text("Press any key to start", {
        fontSize: 18,
        fontFamily: "VT323"
      });
      this.footer.position.x = 20;
      this.footer.position.y = 360;
      this.addChild(this.footer);

      this.setPink(true);
      this.setReady(false);
    }

    setReady(ready) {
      this.footer.alpha = ready ? 1 : 0;
    }

    setPink(pink) {
      this.pink = pink;
      this.title.style.fill = this.footer.style.fill = this.score.style.fill = this.best.style.fill = pink
        ? 0xff0099
        : 0x0099ff;
    }

    lastT = 0;
    update(dt) {
      this.lastT += dt;
      if (this.lastT > 20) {
        this.lastT = res(this.lastT);
        this.setPink(!this.pink);
      }
    }
  }

  class TetrisGame extends PIXI.Container {
    playerPiece = null;
    nexttPlayerPiece = null;
    _over = false;
    rowCount = 0;
    pieceCount = 0;
    startTime = 0;
    updateTime = 0;

    constructor(onGameOver) {
      super();
      this.onGameOver = onGameOver;
      this.board = new TetrisBoard();
      this.blocks = new PIXI.Container();
      this.blocksTrash = new PIXI.Container();
      //this.shield = new Shield(false);
      this.score = new Score();
      this.score.position.x = TETRIS_W_PX / 2;
      this.score.position.y = TETRIS_H_PX + 20;
      //this.shield.position.x = TETRIS_W_PX;
      this.addChild(this.board);
      this.addChild(this.blocksTrash);
      this.addChild(this.blocks);
      //this.addChild(this.shield);
      this.addChild(this.score);
    }

    start() {
      this.newPlayerPiece();
      this.updateTime = this.startTime = Date.now();
      this._started = true;
    }

    isOver() {
      return this._over;
    }

    isRunning() {
      return !this._over && this._started;
    }

    getRowCount() {
      return this.rowCount;
    }

    getPieceCount() {
      return this.pieceCount;
    }

    getScore() {
      return Math.floor(this.rowCount * 100 + this.pieceCount * 10);
    }

    gameOver() {
      if (this.isOver()) return;
      this._over = true;
      if (this.nextPlayerPiece) this.removeChild(this.nextPlayerPiece);
      if (this.playerPiece) this.removeChild(this.playerPiece);
      localStorage.bestScore = Math.max(
        localStorage.bestScore || 0,
        this.getScore()
      );
      this.onGameOver();
    }

    update(tick) {
      if (!this.isRunning()) return;
      const { playerPiece } = this;
      if (playerPiece) {
        const pink = playerPiece.isPink();
        //this.shield.setPink(pink);
        this.score.setPink(pink);
      }
      //shield.update(tick);
      this.updateTime = Date.now();
      this.score.setScore(this.getScore());

      for (let block of this.blocks.children) {
        block.update(tick);
      }
      for (let block of this.blocksTrash.children) {
        block.update(tick);
      }
    }

    genPlayerPiece() {
      const pieceInfo =
        pieceInfos[Math.floor(Math.random() * pieceInfos.length)];
      const playerPiece = new TetrisPiece(
        pieceInfo,
        Math.floor(Math.random() * 4)
      );
      const x = 4;
      const y = -5;
      playerPiece.setBoardPosition(x, y);
      return playerPiece;
    }

    newPlayerPiece() {
      let playerPiece;
      if (this.nextPlayerPiece) {
        playerPiece = this.nextPlayerPiece;
        this.nextPlayerPiece = null;
      } else {
        playerPiece = this.genPlayerPiece();
        this.addChild(playerPiece);
      }
      playerPiece.focus();
      this.pieceCount++;
      this.playerPiece = playerPiece;
    }

    playerIsPink() {
      const { playerPiece } = this;
      if (!playerPiece) return false;
      return playerPiece.isPink();
    }

    move(dx = 0, dy = 0) {
      const { playerPiece } = this;
      if (!playerPiece) return;
      const shape = playerPiece.getShape();
      let [x, y] = playerPiece.boardPosition;
      x = Math.min(
        TETRIS_W - widthPerShape(shape),
        Math.max(offsetPerShape(shape), x + dx)
      );
      y = Math.max(-4, y);
      const collides = this.shapeCollides(x, y + dy, shape);

      if (!this.nextPlayerPiece && !collides && dy > 0 && y > 0) {
        this.nextPlayerPiece = this.genPlayerPiece();
        this.nextPlayerPiece.blur();
        this.addChild(this.nextPlayerPiece);
      }

      if (!collides) {
        playerPiece.setBoardPosition(x, y + dy);
      } else if (dy > 0) {
        this.removeChild(playerPiece);
        if (collides) {
          [x, y] = playerPiece.boardPosition;
        }
        this.newPlayerPiece();
        this.setPiece(x, y, shape, playerPiece.isPink());
      }
    }

    rotate(clockwise) {
      const { playerPiece } = this;
      if (!playerPiece) return;
      const [x, y] = playerPiece.boardPosition;
      const index = rotateShape(
        playerPiece.pieceInfo,
        playerPiece.index,
        clockwise ? 1 : -1
      );
      const newShape = playerPiece.pieceInfo.shapes[index];
      if (!this.shapeCollides(x, y, newShape)) {
        playerPiece.setIndex(index);
        this.move();
        audio.triggerTurn++;
      }
    }

    fallPlayerPiece() {
      if (!this.playerPiece) return;
      const { playerPiece } = this;
      let { boardPosition: [x, y] } = playerPiece;
      const shape = playerPiece.getShape();
      this.removeChild(playerPiece);
      while (!this.shapeCollides(x, y, shape)) {
        y++;
      }
      y--;
      this.newPlayerPiece();
      this.setPiece(x, y, shape, playerPiece.isPink());
    }

    getBlock(x, y) {
      return this.blocks.children.find(
        c => c.boardPosition[0] === x && c.boardPosition[1] === y
      );
    }

    setBlock(x, y, block) {
      block.setBoardPosition(x, y);
      this.blocks.addChild(block);
    }

    setPiece(x, y, shape, pink) {
      audio.triggerFall++;
      for (let [xi, yi] of shape) {
        this.setBlock(x + xi, y + yi, new TetrisBlock(pink, true));
      }
      let rows = [];
      for (const block of this.blocks.children) {
        const [x, y] = block.boardPosition;
        rows[y] = rows[y] || [];
        rows[y].push(block);
      }
      const withoutFullRows = [];
      const fullRows = [];
      rows.forEach(row => {
        if (row.length === TETRIS_W) {
          fullRows.push(row);
        } else {
          withoutFullRows.push(row);
        }
      });
      if (fullRows.length) {
        this.rowCount += fullRows.length;
        this.blocks.removeChildren();
        withoutFullRows.forEach((row, i) => {
          for (const block of row) {
            block.fallToY(TETRIS_H - withoutFullRows.length + i);
            this.blocks.addChild(block);
          }
        });
        fullRows.forEach(row => {
          audio.triggerRow++;
          for (const block of row) {
            this.blocksTrash.addChild(block);
            block.complete();
          }
        });
      }
      if (withoutFullRows.length >= TETRIS_H) {
        this.gameOver();
      }
    }

    containsParticle(p) {
      const x = p.position.x - this.position.x;
      const y = p.position.y - this.position.y;
      return x >= 0 && y >= 0 && x <= TETRIS_W_PX && y <= TETRIS_H_PX;
    }

    particleIsAbsorbable(p) {
      const { playerPiece } = this;
      if (!playerPiece) return false;
      return p.isPink() === playerPiece.isPink();
    }

    playerPieceCollidesParticle(p) {
      const { playerPiece } = this;
      if (!playerPiece) return false;
      const [x, y] = playerPiece.boardPosition;
      if (p.isPink() !== playerPiece.isPink() && y <= 0) return false;
      if (!this.containsParticle(p)) return false;
      const pr = {
        x: p.position.x - this.position.x,
        y: p.position.y - this.position.y
      };
      return playerPiece.collidesCircle(pr, 4);
    }

    shapeCollides(x, y, shape) {
      for (let [xi, yi] of shape) {
        if (y + yi >= TETRIS_H) return true;
        if (this.getBlock(x + xi, y + yi)) {
          return true;
        }
      }
      return false;
    }

    removeBlockRow(y) {
      this.rows.splice(yToRow(y), 1).forEach(row => {
        row.forEach(block => this.blocks.removeChild(block));
      });
    }
  }

  class Particle extends PIXI.Container {
    melting = 0;
    exploding = 0;
    constructor(pink) {
      super();
      this.sprite = PIXI.Sprite.from(resources.particle1.texture);
      this.addChild(this.sprite);
      this.sprite.width = 10;
      this.sprite.height = 10;
      this.sprite.anchor.x = 0.5;
      this.sprite.anchor.y = 0.5;
      this.setPink(pink);
    }
    setPink(pink) {
      this.pink = pink;
      this.sprite.tint = pink ? 0xff0099 : 0x0099ff;
    }
    isPink() {
      return this.pink;
    }
    setHighlight(highlighted) {
      this.alpha = highlighted ? 1 : 0.4;
    }
    update(tick) {
      if (this.exploding) {
        const p = (Date.now() - this.exploding) / 500;
        if (p > 1) {
          this.parent.removeChild(this);
        } else {
          this.sprite.scale.x = this.sprite.scale.y = 1 + 3 * p;
        }
      } else if (this.melting) {
        const p = (Date.now() - this.melting) / 100;
        if (p > 1) {
          this.parent.removeChild(this);
        } else {
          this.sprite.scale.x = this.sprite.scale.y = 1 - p;
        }
      }
    }
    melt() {
      if (this.melting || this.exploding) return;
      this.melting = Date.now();
      audio.triggerMelt++;
    }
    explode() {
      if (this.melting || this.exploding) return;
      this.exploding = Date.now();
      this.sprite.tint = 0xffffff;
      audio.triggerExplode++;
    }
  }

  function easySpawner() {
    return {
      ang:
        Math.PI +
        (Math.random() < 0.3
          ? Math.random() < 0.5 ? Math.PI / 4 : -Math.PI / 4
          : 0),
      pattern: [
        -2 - Math.floor(1.8 * Math.random()),
        Math.floor(2 + 4 * Math.random())
      ],
      vel: 1,

      randAng: 0,
      game_life: 15000
    };
  }

  function mediumSpawner() {
    return {
      ang:
        Math.PI +
        (Math.random() < 0.3
          ? Math.random() < 0.5 ? Math.PI / 4 : -Math.PI / 4
          : 0),
      pattern: [
        -2 - Math.floor(1.8 * Math.random()),
        Math.floor(2 + 4 * Math.random()),
        -4 - Math.floor(3.8 * Math.random()),
        Math.floor(5 + 4 * Math.random())
      ],
      vel: 2,
      speed: 500,
      spawner_vy: 0.5 * Math.random(),
      game_life: 10000
    };
  }

  function hardSpawner() {
    return {
      ang: Math.PI + (Math.random() < 0.4 ? 2.4 * (Math.random() - 0.5) : 0),
      pattern: [
        -10 - Math.floor(18 * Math.random()),
        Math.floor(20 + 10 * Math.random())
      ],
      vel: 2,
      speed: 200,
      spawner_vy: Math.random(),
      game_life: 10000
    };
  }

  function spawnerByDifficulty(difficulty) {
    if (difficulty > 0.66) return hardSpawner();
    if (difficulty < 0.33) return easySpawner();
    return mediumSpawner();
  }

  class ParticleSystem extends PIXI.Container {
    constructor(topBound, bottomBound) {
      super();
      this.topBound = topBound;
      this.bottomBound = bottomBound;
    }
    spotTotal = 6;
    lastEvent = 0;
    spawners = [];

    findSpot() {
      for (let i = 0; i < 50; i++) {
        const spotI = Math.floor(this.spotTotal * Math.random());
        let exists = false;
        for (const s of this.spawners) {
          if (s.game_spotI === spotI) {
            exists = true;
            continue;
          }
        }
        if (!exists) return spotI;
      }
      return -1;
    }

    bounces(pos) {
      const topOffset = pos.y - this.topBound;
      const bottomOffset = this.bottomBound - pos.y;
      if (topOffset < 0) {
        pos.y -= topOffset;
        return true;
      } else if (bottomOffset < 0) {
        pos.y += bottomOffset;
        return true;
      }
    }

    globalDifficulty = 0;
    setGlobalDifficulty(d) {
      this.globalDifficulty = d;
    }

    spawnersRate = 10000;
    setSpawnersRate(s) {
      this.spawnersRate = s;
    }

    update(tick) {
      const now = Date.now();
      if (now - this.lastEvent > this.spawnersRate) {
        this.lastEvent = now;
        const pink = Math.random() < 0.5;
        const spotI = this.findSpot();
        if (spotI !== -1) {
          const y =
            this.topBound +
            (1 + spotI) /
              (this.spotTotal + 1) *
              (this.bottomBound - this.topBound);
          const spawner = new Spawner({
            pos: [GAME_W, y],
            spawner_vy: 0,
            ...spawnerByDifficulty(this.globalDifficulty * Math.random()),
            spawn: ({ angle, position: [x, y], velocity: [vx, vy] }) => {
              const p = new Particle(pink);
              p.position.x = x;
              p.position.y = y;
              p.velocity = { x: vx, y: vy };
              this.addChild(p);
            }
          });
          spawner.game_createdTime = now;
          spawner.game_spotI = spotI;
          this.spawners.push(spawner);
        }
      }

      for (let spawner of this.spawners) {
        if (now - spawner.game_createdTime > spawner.game_life) {
          const i = this.spawners.indexOf(spawner);
          this.spawners.splice(i, 1);
        } else {
          if (spawner.spawner_vy) {
            spawner.pos[1] += spawner.spawner_vy;
            const pos = { x: spawner.pos[0], y: spawner.pos[1] };
            if (this.bounces(pos)) {
              spawner.pos[1] = pos.y;
              spawner.spawner_vy *= -1;
            }
          }
          spawner.update(now);
        }
      }

      for (let child of this.children) {
        child.position.x += child.velocity.x * tick;
        child.position.y += child.velocity.y * tick;
        if (this.bounces(child.position)) {
          child.velocity.y *= -1;
        }
        child.update(tick);

        if (child.position.x < -10 || child.position.x > GAME_W + 10) {
          this.removeChild(child);
        }
      }
    }

    setHighlights(highlightPinks, highlightBlues) {
      for (const p of this.children) {
        if (p.isPink()) {
          p.setHighlight(highlightPinks);
        } else {
          p.setHighlight(highlightBlues);
        }
      }
    }
  }

  let layer,
    layerTime = 0;

  function setLayer(l) {
    if (layer) app.stage.removeChild(layer);
    layer = l;
    layerTime = Date.now();
    if (l) {
      l.position.x = game.position.x;
      l.position.y = game.position.y;
      app.stage.addChild(l);
    }
  }

  function onGameOver() {
    setLayer(new GameOverScreen(game));
  }

  const games = new PIXI.Container();
  games.update = function(dt) {
    for (const child of this.children) {
      if (child.update) child.update(dt);
    }
  };
  app.stage.addChild(games);

  let game;
  const GAME_POS = {
    x: (GAME_W - TETRIS_W_PX) / 2,
    y: (GAME_H - TETRIS_H_PX) / 2
  };
  function newGame() {
    if (game) {
      games.removeChild(game);
    }
    game = new TetrisGame(onGameOver);
    Object.assign(game.position, GAME_POS);
    games.addChild(game);
  }

  for (let i = 0; i < 6; i++) {
    const neighborGame = new TetrisGame(() => {});
    neighborGame.alpha = 0.5;
    games.addChild(neighborGame);
    const dx = i < 3 ? i - 3 : i - 2;
    neighborGame.position.x = GAME_POS.x + TETRIS_W_PX * dx;
    neighborGame.position.y = GAME_POS.y;
  }

  let lastFallTick = 0;
  let lastRotTick = 0;
  let lastMoveTick = 0;
  let lastMoveDownTick = 0;
  let lastMoveUpTick = 0;

  const particleSystem = new ParticleSystem(
    GAME_POS.y + 5,
    GAME_POS.y + TETRIS_H_PX - 5
  );
  app.stage.addChild(particleSystem);

  /*
  for (let i = 0; i < 300; i++) {
    const p = new Particle(Math.random() < 0.5);
    p.position.x = Math.random() * 1200;
    p.position.y = Math.random() * 600;
    particleSystem.addChild(p);
  }
  */

  window.addEventListener("blur", () => {
    if (app.ticker) app.ticker.stop();
    audio.volume = 0;
    audioSync(audio);
  });

  window.addEventListener("focus", () => {
    if (app.ticker) app.ticker.start();
  });

  newGame();
  setLayer(new MenuScreen());

  app.ticker.add(tick => {
    app.stage.children.forEach(s => {
      if (s.update) s.update(tick);
    });

    const e = getUserEvents();

    if (game.isRunning()) {
      const rowCount = game.getRowCount();
      const pieceCount = game.getPieceCount();

      const RotSpeed = 10;
      let FallSpeed = Math.max(6, 30 * Math.exp(-rowCount / 40));
      const MoveUpSpeed = 6 + rowCount / 5;
      const MoveDownSpeed = 3;
      const MoveSpeed = Math.max(4, 8 - rowCount / 20);

      if (e.rotateDelta && lastRotTick > RotSpeed) {
        lastRotTick = res(lastRotTick);
        game.rotate(e.rotateDelta > 0);
      }
      if (e.keyUpDelta < 0 && lastMoveDownTick > MoveDownSpeed) {
        lastMoveDownTick = res(lastMoveDownTick);
        game.move(0, -e.keyUpDelta);
      }
      if (e.keyUpDelta > 0 && lastMoveUpTick > MoveUpSpeed) {
        lastMoveUpTick = res(lastMoveUpTick);
        game.move(0, -e.keyUpDelta);
      }
      if (e.keyRightDelta && lastMoveTick > MoveSpeed) {
        lastMoveTick = res(lastMoveTick);
        game.move(e.keyRightDelta, 0);
      }

      if (
        lastFallTick > FallSpeed &&
        lastMoveUpTick > FallSpeed &&
        lastMoveDownTick > FallSpeed
      ) {
        lastFallTick = 0;
        game.move(0, 1);
      }

      const newRowCount = game.getRowCount();

      const absorbableCollision = [];
      const nonAbsorbableCollision = [];
      for (let p of particleSystem.children) {
        if (newRowCount !== rowCount) {
          // p.melt();
        } else {
          if (game.playerPieceCollidesParticle(p)) {
            if (game.particleIsAbsorbable(p)) {
              absorbableCollision.push(p);
            } else {
              nonAbsorbableCollision.push(p);
            }
          }
        }
      }

      const pink = game.playerIsPink();
      particleSystem.setHighlights(!pink, pink);

      lastFallTick += tick;
      lastRotTick += tick;
      lastMoveTick += tick;
      lastMoveUpTick += tick;
      lastMoveDownTick += tick;

      absorbableCollision.forEach(p => p.melt());
      nonAbsorbableCollision.forEach(p => p.explode());

      particleSystem.setSpawnersRate(
        Math.max(
          4000,
          10000 + 30000 * Math.exp(-pieceCount / 10) - 100 * pieceCount
        )
      );
      particleSystem.setGlobalDifficulty(1 - 1.5 * Math.exp(-rowCount / 10));

      if (nonAbsorbableCollision.length) {
        game.gameOver();
      }
    } else {
      particleSystem.setHighlights(false, false);
      if (!layer) {
        if (game.isOver()) {
          setLayer(new GameOverScreen(game));
        }
      }
      const ready = Date.now() - layerTime > 2000;
      layer.setReady(ready);
      if (ready) {
        if (e.keyUpDelta || e.keyRightDelta || e.rotateDelta) {
          setLayer(null);
          if (game.isOver()) {
            newGame();
          }
          game.start();
        }
      }
    }

    audio.volume += 0.05 * ((userWantVolume ? 0.5 : 0) - audio.volume);

    if (game.isRunning()) {
      audio.musicVolume += 0.05 * (1 - audio.musicVolume);
      audio.melodyVolume += 0.01 * (1 - audio.melodyVolume);
    } else {
      audio.musicVolume +=
        0.008 * ((game.isOver() ? 0 : 0.5) - audio.musicVolume);
      audio.melodyVolume += 0.04 * (0 - audio.melodyVolume);
    }

    audio.mix += 0.08 * ((game.playerIsPink() ? 0 : 1) - audio.mix);

    audioSync(audio);
    Object.assign(audio, audioTriggers);
  });
});

export default $root => {
  $root.appendChild(app.view);
  return {
    destroy: () => {
      $root.removeChild(app.view);
      app.destroy();
    }
  };
};
