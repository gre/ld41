import * as PIXI from "pixi.js";
import memoize from "lodash/memoize";
import loader from "./loader";
import { getUserEvents } from "./controls";

PIXI.utils.skipHello();

const app = new PIXI.Application({
  width: 800,
  height: 600,
  backgroundColor: 0x000000
});

const widthPerShape = memoize(
  shape => shape.reduce((m, s) => (m > s[0] ? m : s[0]), 0) + 1
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

loader.load((loader, resources) => {
  const pieceInfos = [
    {
      id: "O",
      shapes: generateShapes(
        [[0, 0], [1, 0], [0, 1], [1, 1]],
        [-0.5, -0.5],
        [1.5, 1.5]
      )
    },
    {
      id: "I",
      shapes: generateShapes(
        [[0, 0], [0, 1], [0, 2], [0, 3]],
        [0.5, -1.5],
        [1.5, 2.5]
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
    setPink(pink) {
      this.tint = pink ? 0xff0099 : 0x0099ff;
    }
  }

  class TetrisPiece extends PIXI.Container {
    constructor(pieceInfo, index, pink) {
      super();
      this.index = index;
      this.pieceInfo = pieceInfo;
      pieceInfo.shapes[index].forEach(([x, y]) => {
        const block = new TetrisBlock(pink);
        block.setBoardPosition(x, y);
        this.addChild(block);
      });
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
  }

  class TetrisGame extends PIXI.Container {
    rows = [];
    playerPiece = null;

    constructor(onGameOver) {
      super();
      this.onGameOver = onGameOver;
      this.board = new TetrisBoard();
      this.blocks = new PIXI.Container();
      this.addChild(this.board);
      this.addChild(this.blocks);
      this.newPlayerPiece();
    }

    newPlayerPiece() {
      const pieceInfo =
        pieceInfos[Math.floor(Math.random() * pieceInfos.length)];
      const playerPiece = new TetrisPiece(pieceInfo, 0, true);
      const x = 4;
      const y = 0;
      playerPiece.setBoardPosition(x, y);
      this.addChild(playerPiece);
      this.playerPiece = playerPiece;
      if (this.shapeCollides(x, y, playerPiece.getShape())) {
        this.onGameOver();
      }
    }

    move(dx = 0, dy = 0) {
      // TODO dy
      const { playerPiece } = this;
      const shape = playerPiece.getShape();
      let [x, y] = playerPiece.boardPosition;
      x = Math.min(TETRIS_W - widthPerShape(shape), Math.max(0, x + dx));
      if (!this.shapeCollides(x, y, shape)) {
        playerPiece.setBoardPosition(x, y);
      }
    }

    rotate(clockwise) {
      const { playerPiece } = this;
      const [x, y] = playerPiece.boardPosition;
      const index = rotateShape(
        playerPiece.pieceInfo,
        playerPiece.index,
        clockwise ? 1 : -1
      );
      const newShape = playerPiece.pieceInfo.shapes[index];
      if (!this.shapeCollides(x, y, newShape)) {
        playerPiece.setIndex(index);
      }
    }

    fallPlayerPiece() {
      if (!this.playerPiece) return;
      const { playerPiece } = this;
      let { boardPosition: [x, y] } = playerPiece;
      const shape = playerPiece.getShape();
      this.removeChild(playerPiece);
      this.playerPiece = null;
      while (!this.shapeCollides(x, y, shape)) {
        y++;
      }
      y--;
      this.setPiece(x, y, shape, playerPiece.isPink());
      this.newPlayerPiece();
    }

    getBlock(x, y) {
      return (this.rows[yToRow(y)] || [])[x];
    }

    setBlock(x, y, block) {
      const rowI = yToRow(y);
      let row = this.rows[rowI];
      if (!row) row = this.rows[rowI] = [];
      row[x] = block;
      block.setBoardPosition(x, y);
      this.blocks.addChild(block);
    }

    setPiece(x, y, shape, pink) {
      for (let [xi, yi] of shape) {
        this.setBlock(x + xi, y + yi, new TetrisBlock(pink, true));
      }
      this.rows.forEach(row => {
        if (row.length === TETRIS_W) {
          this.removeBlockRow(this.rows.indexOf(row));
        }
      });
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

  function onGameOver() {
    console.log("GAME OVER");
  }

  const game = new TetrisGame(onGameOver);

  app.stage.addChild(game);

  game.position.x = 20;
  game.position.y = 100;

  let lastFallTick = 0;

  app.ticker.add(tick => {
    lastFallTick += tick;
    if (lastFallTick > 30) {
      lastFallTick = 0;
      game.move(0, 1);
    }
    const e = getUserEvents();
    if (e.rotateDelta) {
      game.rotate(e.rotateDelta > 0);
    }
    if (e.keyRightDelta || e.keyUpDelta) {
      game.move(e.keyRightDelta, -e.keyUpDelta);
    }
    if (e.action1) {
      game.fallPlayerPiece();
    }
  });

  for (let i = 0; i < 50; i++) {
    const p = PIXI.Sprite.from(resources.particle1.texture);
    p.tint = Math.random() < 0.5 ? 0x0099ff : 0xff0099;
    p.width = 10;
    p.height = 10;

    p.position.x =
      600 + 1200 * Math.random() * Math.random() * (Math.random() - 0.5);
    p.position.y =
      300 + 1200 * Math.random() * Math.random() * (Math.random() - 0.5);

    app.stage.addChild(p);
  }
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
