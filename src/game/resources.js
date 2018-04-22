import * as PIXI from "pixi.js";
import FontFaceObserver from "fontfaceobserver";

export const fontLoaded = new FontFaceObserver("VT323").load();

export const loader = new PIXI.loaders.Loader();
loader.add("block", "/block.png");
loader.add("cell", "/cell.png");
loader.add("shield", "/shield.png");
loader.add("particle1", "/particle1.png");
loader.add("layer", "/layer.png");

export default new Promise(success => {
  loader.load((l, r) => success(r));
}).then(r => fontLoaded.then(() => r));
