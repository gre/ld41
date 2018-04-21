import * as PIXI from "pixi.js";

const loader = new PIXI.loaders.Loader();
loader.add("block", "/block.png");
loader.add("cell", "/cell.png");
loader.add("particle1", "/particle1.png");

export default loader;
